import { FieldValue } from "firebase-admin/firestore";
import { STARTER_SET, normalizeCollection, countCollection } from "@/game/terminal-traders/collection";

// Server-authoritative card ownership. cardCollections/{userId} is written
// ONLY here via the Admin SDK (firestore.rules block all client writes), so a
// forged "I own the foil" write is impossible — every card traces back to a
// grant recorded in cardGrants. Same trust model as burn-offering credits.
//
// Doc shape: cardCollections/{userId} = {
//   cards: { [cardId]: count },
//   total: number,
//   starterGrantedAt, updatedAt
// }

export async function getCollection(db, userId) {
  const snap = await db.collection("cardCollections").doc(userId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const cards = normalizeCollection(data.cards);
  return {
    cards,
    total: countCollection(cards),
    starterGrantedAt: data.starterGrantedAt?.toMillis?.() || null,
  };
}

// Idempotent: grants the starter set exactly once per user, guarded by a
// transaction on the collection doc so double-fired requests can't double the
// starter cards.
export async function ensureCollection(db, userId) {
  const docRef = db.collection("cardCollections").doc(userId);
  const granted = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists) return false;
    tx.set(docRef, {
      cards: { ...STARTER_SET },
      total: countCollection(STARTER_SET),
      starterGrantedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("cardGrants").doc(), {
      userId,
      source: "starter",
      cards: { ...STARTER_SET },
      at: FieldValue.serverTimestamp(),
    });
    return true;
  });
  const collection = await getCollection(db, userId);
  return { ...collection, starterGranted: granted };
}

// Write a card grant inside a caller-owned transaction, so routes can make
// the grant atomic with their own idempotency doc (e.g. pack-purchase's
// one-claim-per-txHash). `cardCounts` is { cardId: positiveInt }; unknown ids
// are dropped. `source` names the granting flow for the audit trail.
export function grantCardsInTx(tx, db, userId, cardCounts, source) {
  const cards = normalizeCollection(cardCounts);
  if (Object.keys(cards).length === 0) {
    throw new Error("grantCards: nothing valid to grant");
  }
  const increments = {};
  for (const [id, count] of Object.entries(cards)) {
    increments[id] = FieldValue.increment(count);
  }
  tx.set(
    db.collection("cardCollections").doc(userId),
    {
      cards: increments,
      total: FieldValue.increment(countCollection(cards)),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(db.collection("cardGrants").doc(), {
    userId,
    source: String(source || "unknown"),
    cards,
    at: FieldValue.serverTimestamp(),
  });
  return cards;
}

// Standalone grant (reward hooks etc. — anything without its own transaction).
export async function grantCards(db, userId, cardCounts, source) {
  await db.runTransaction(async (tx) => {
    grantCardsInTx(tx, db, userId, cardCounts, source);
  });
  return getCollection(db, userId);
}
