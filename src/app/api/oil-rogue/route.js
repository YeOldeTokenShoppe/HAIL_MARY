import { NextResponse } from "next/server";
import {
  db, collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc,
  deleteField, serverTimestamp,
} from "@/lib/firebaseServer";

// Rogue character catalog (server-side mirror for consequence logic)
const CONSEQUENCE_MAP = {
  dinosaur: "delete_addon",
  blueDemon: "delete_addon",
  troll: "graffiti",
  crudingo: "poop",
};

// ── A* on corridor intersections ─────────────────────────────────────────────
// Every cell has a pumpjack. The rogue walks on the grid lines (corridors
// between cells). Nodes are the (gridSize+1)×(gridSize+1) intersection points.
// Intersection (ix, iy) sits at the corner where cells (ix-1,iy-1), (ix,iy-1),
// (ix-1,iy), (ix,iy) meet.
//
// The path is: edge intersection → corridor intersections → target cell center.

function astarCorridors(startIx, startIy, endIx, endIy, gridSize) {
  const key = (x, y) => `${x}_${y}`;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const nodes = gridSize + 1; // intersections per axis

  const open = [{ x: startIx, y: startIy, g: 0, f: 0, parent: null }];
  const closed = new Set();

  const h = (x, y) => Math.abs(x - endIx) + Math.abs(y - endIy);
  open[0].f = h(startIx, startIy);

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const cur = open.splice(bestIdx, 1)[0];
    const ck = key(cur.x, cur.y);

    if (cur.x === endIx && cur.y === endIy) {
      const path = [];
      let node = cur;
      while (node) { path.unshift([node.x, node.y]); node = node.parent; }
      return path;
    }

    closed.add(ck);

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= nodes || ny < 0 || ny >= nodes) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;

      const ng = cur.g + 1;
      const existing = open.find((n) => n.x === nx && n.y === ny);
      if (existing) {
        if (ng < existing.g) {
          existing.g = ng;
          existing.f = ng + h(nx, ny);
          existing.parent = cur;
        }
      } else {
        open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny), parent: cur });
      }
    }
  }
  return null;
}

// Find nearest intersection on the grid border to a target cell
function findEntryIntersection(targetCol, targetRow, gridSize, sortOrder) {
  const nodes = gridSize + 1;
  const candidates = [];

  // All border intersections
  for (let i = 0; i < nodes; i++) {
    candidates.push([i, 0], [i, nodes - 1]); // top and bottom edges
  }
  for (let i = 1; i < nodes - 1; i++) {
    candidates.push([0, i], [nodes - 1, i]); // left and right edges
  }

  // Target cell center is between intersections (col, row) and (col+1, row+1)
  // Nearest corner intersections to the cell center
  const cx = targetCol + 0.5;
  const cy = targetRow + 0.5;

  candidates.sort((a, b) => {
    const da = Math.abs(a[0] - cx) + Math.abs(a[1] - cy);
    const db = Math.abs(b[0] - cx) + Math.abs(b[1] - cy);
    return sortOrder === "far" ? db - da : da - db;
  });

  return candidates;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { password, characterType, autoTarget } = body;
    let { targetCol, targetRow } = body;

    // Admin auth
    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || password !== correct) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!characterType) {
      return NextResponse.json({ ok: false, error: "Missing characterType" }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ ok: false, error: "Firestore unavailable" }, { status: 503 });
    }

    // ── Load grid settings ──────────────────────────────────────────────────
    const settingsDoc = await getDoc(doc(db, "oilGame", "settings"));
    const gridSize = settingsDoc.exists() ? (settingsDoc.data().gridSize || 10) : 10;

    // ── Load all pumpConfigs → build info map for targeting ──────────────────
    const configsSnap = await getDocs(collection(db, "pumpConfigs"));
    const configMap = new Map(); // "col_row" → { hasFence, hasAddons, addonSlots, hasCamera, userId, docId, config }

    configsSnap.forEach((d) => {
      const data = d.data();
      const c = data.col;
      const r = data.row;
      if (c == null || r == null) return;
      const cfg = data.config || {};
      const addons = cfg.addons || {};
      const addonKeys = Object.keys(addons);
      configMap.set(`${c}_${r}`, {
        hasFence: !!cfg.fenceType,
        hasAddons: addonKeys.length > 0,
        addonSlots: addonKeys,
        hasCamera: !!cfg.showCamera,
        userId: data.userId || null,
        docId: d.id,
        config: cfg,
      });
    });

    // ── Auto-target selection ───────────────────────────────────────────────
    let plotDocId = null;
    let plotConfig = null;
    let targetUserId = null;
    let consequence = { type: "none" };

    if (autoTarget) {
      const isFlyingRogue = (CONSEQUENCE_MAP[characterType] || "none") === "poop";
      const candidates = [];
      if (isFlyingRogue) {
        // Flying rogues bypass fences and don't need addons, but only target occupied pads
        for (const [key, info] of configMap) {
          const [col, row] = key.split("_").map(Number);
          candidates.push({ col, row, ...info });
        }
      } else {
        for (const [key, info] of configMap) {
          if (info.hasAddons && !info.hasFence) {
            const [col, row] = key.split("_").map(Number);
            candidates.push({ col, row, ...info });
          }
        }
      }
      if (candidates.length === 0) {
        return NextResponse.json({
          ok: false,
          error: "No valid targets — all rigs are fenced or have no addons",
        }, { status: 400 });
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      targetCol = pick.col;
      targetRow = pick.row;
      plotDocId = pick.docId;
      plotConfig = pick.config;
      targetUserId = pick.userId;
    } else {
      if (targetCol == null || targetRow == null) {
        return NextResponse.json({ ok: false, error: "Missing targetCol/targetRow" }, { status: 400 });
      }
      const cellKey = `${targetCol}_${targetRow}`;
      if (configMap.has(cellKey)) {
        const info = configMap.get(cellKey);
        plotDocId = info.docId;
        plotConfig = info.config;
        targetUserId = info.userId;
      }
    }

    // ── Pathfinding on corridor intersections ───────────────────────────────
    // Target cell's four corner intersections
    const targetCorners = [
      [targetCol, targetRow],         // top-left
      [targetCol + 1, targetRow],     // top-right
      [targetCol, targetRow + 1],     // bottom-left
      [targetCol + 1, targetRow + 1], // bottom-right
    ];

    // Find entry: nearest border intersection → nearest target corner
    const entryCandidates = findEntryIntersection(targetCol, targetRow, gridSize, "near");
    let pathIn = null;
    let entryNode = null;
    let arrivalCorner = null;

    for (const ec of entryCandidates) {
      for (const tc of targetCorners) {
        const p = astarCorridors(ec[0], ec[1], tc[0], tc[1], gridSize);
        if (p) {
          pathIn = p;
          entryNode = ec;
          arrivalCorner = tc;
          break;
        }
      }
      if (pathIn) break;
    }

    if (!pathIn) {
      return NextResponse.json({ ok: false, error: "No reachable path to target" }, { status: 400 });
    }

    // Find exit: from arrival corner → far border intersection (different from entry)
    const exitCandidates = findEntryIntersection(targetCol, targetRow, gridSize, "far");
    let pathOut = null;

    for (const ec of exitCandidates) {
      // Skip if same as entry node
      if (ec[0] === entryNode[0] && ec[1] === entryNode[1]) continue;
      const p = astarCorridors(arrivalCorner[0], arrivalCorner[1], ec[0], ec[1], gridSize);
      if (p) { pathOut = p; break; }
    }
    // Fallback: reverse entry path
    if (!pathOut) {
      pathOut = [...pathIn].reverse();
    }

    // ── Build final path ────────────────────────────────────────────────────
    // pathIn: border intersection → ... → arrival corner (corridors)
    // cell center: target cell
    // pathOut: arrival corner → ... → border intersection (corridors)
    //
    // The rogue enters the target cell from the arrival corner, goes to cell center,
    // then returns to the arrival corner and exits via corridors. No diagonals.

    const fullPath = [];

    // Entry intersections (corridor walking to arrival corner)
    for (const [ix, iy] of pathIn) {
      fullPath.push({ type: "intersection", ix, iy });
    }

    // Target cell center
    fullPath.push({ type: "cell", c: targetCol, r: targetRow });

    // Exit: back to arrival corner then out via corridors
    // pathOut starts at arrival corner — include all nodes
    for (const [ix, iy] of pathOut) {
      fullPath.push({ type: "intersection", ix, iy });
    }

    // Debug string
    const pathDebug = fullPath.map((n) =>
      n.type === "cell" ? `[${n.c},${n.r}]` : `(${n.ix},${n.iy})`
    ).join(" → ");

    // ── Apply consequence ───────────────────────────────────────────────────
    const consequenceType = CONSEQUENCE_MAP[characterType] || "none";

    if (consequenceType === "delete_addon" && plotConfig?.addons) {
      const addonKeys = Object.keys(plotConfig.addons);
      if (addonKeys.length > 0) {
        const victimSlot = addonKeys[Math.floor(Math.random() * addonKeys.length)];
        const victimAddon = plotConfig.addons[victimSlot];
        consequence = {
          type: "delete_addon",
          addonSlot: victimSlot,
          addonId: victimAddon.id,
          plotDocId: plotDocId || null,
        };
        // Deletion deferred to client-side when rogue reaches target (weapon phase)
      }
    } else if (consequenceType === "graffiti" && plotDocId) {
      consequence = { type: "graffiti", plotDocId };
      // Applied client-side when rogue reaches target
    } else if (consequenceType === "poop" && plotDocId) {
      consequence = { type: "poop", plotDocId };
      // Applied client-side when rogue reaches target
    }

    // ── Write rogue event ───────────────────────────────────────────────────
    const eventRef = await addDoc(collection(db, "rogueEvents"), {
      characterType,
      targetCol,
      targetRow,
      targetUserId: targetUserId || null,
      path: fullPath,
      addonSlot: consequence.addonSlot || null,
      status: "active",
      consequence,
      createdAt: serverTimestamp(),
    });

    // ── Telegram alert ──────────────────────────────────────────────────────
    let telegramSent = false;
    if (targetUserId && plotConfig?.showCamera) {
      try {
        const tgDoc = await getDoc(doc(db, "oilTelegram", targetUserId));
        if (tgDoc.exists()) {
          const { chatId } = tgDoc.data();
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (botToken && chatId) {
            let alertText = `🚨 SECURITY ALERT — Plot (${targetCol}, ${targetRow})\nA ${characterType.toUpperCase()} was spotted on your property!`;
            if (consequence.type === "delete_addon") {
              alertText += `\nYour ${(consequence.addonId || "item").toUpperCase()} was eaten! 💀`;
            } else if (consequence.type === "graffiti") {
              alertText += `\nIt left graffiti on your pad! 🎨`;
            } else if (consequence.type === "poop") {
              alertText += `\nIt pooped on your plot! 💩`;
            }
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: alertText }),
            });
            telegramSent = true;
          }
        }
      } catch (tgErr) {
        console.error("[oil-rogue] Telegram alert failed:", tgErr.message);
      }
    }

    return NextResponse.json({
      ok: true,
      eventId: eventRef.id,
      targetCol,
      targetRow,
      pathLength: fullPath.length,
      pathDebug,
      consequence,
      telegramSent,
    });
  } catch (err) {
    console.error("[oil-rogue] POST error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { password, eventId } = await req.json();

    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || password !== correct) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    if (!eventId || !db) {
      return NextResponse.json({ ok: false, error: "Missing eventId or DB unavailable" }, { status: 400 });
    }

    await updateDoc(doc(db, "rogueEvents", eventId), {
      status: "done",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[oil-rogue] PATCH error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
