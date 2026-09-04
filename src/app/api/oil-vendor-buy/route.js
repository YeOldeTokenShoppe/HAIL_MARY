import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { VENDOR_GOODS } from "@/lib/oilVendor";

// Buy a boardwalk good with oil from the un-banked tank. The acting user is the
// verified Clerk session — never the body — and the price is the shared
// constant, never a client amount. One transaction: tank ≥ price → tank −price,
// supplies.<good> +1, a purchase record for the ledger.
//   POST { item: "holyWater", username? }
//   → { ok, item, price, tankOil, count }  |  409 { error: "not_enough_oil", tankOil, price }
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const good = VENDOR_GOODS[body.item];
    if (!good) return NextResponse.json({ error: "unknown_item" }, { status: 400 });
    const username = typeof body.username === "string" ? body.username.trim().slice(0, 40) : null;

    const db = getAdminDb();
    const drillRef = db.collection("oilDrills").doc(userId);
    const purchaseRef = db.collection("vendorPurchases").doc();
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(drillRef);
      if (!snap.exists) throw Object.assign(new Error("no_drill"), { status: 404 });
      const drill = snap.data() || {};
      const tank = typeof drill.tankOil === "number" ? drill.tankOil : 0;
      if (tank < good.price) return { ok: false, tankOil: tank };
      const count = (drill.supplies?.[good.supply] || 0) + 1;
      const update = {
        tankOil: tank - good.price,
        [`supplies.${good.supply}`]: count,
        vendorSpend: FieldValue.increment(good.price),
        [`bought.${good.id}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (username) update.username = username;
      t.update(drillRef, update);
      t.set(purchaseRef, {
        userId, username: username || drill.username || null,
        item: good.id, vendor: good.vendor, price: good.price,
        tankBefore: tank, tankAfter: tank - good.price,
        at: FieldValue.serverTimestamp(),
      });
      return { ok: true, tankOil: tank - good.price, count };
    });
    if (!result.ok) return NextResponse.json({ error: "not_enough_oil", tankOil: result.tankOil, price: good.price }, { status: 409 });
    return NextResponse.json({ ok: true, item: good.id, price: good.price, tankOil: result.tankOil, count: result.count });
  } catch (err) {
    const status = err?.status || 500;
    if (status === 500) console.error("[oil-vendor-buy]", err?.message || err);
    return NextResponse.json({ error: err?.message || "failed" }, { status });
  }
}
