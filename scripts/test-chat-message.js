#!/usr/bin/env node
/**
 * Insert a fake DM into oilPlotMessages for testing the envelope indicator.
 *
 * Usage:
 *   node scripts/test-chat-message.js <plotKey> <yourClerkUserId>
 *
 * Example:
 *   node scripts/test-chat-message.js 3_5 user_2abc123
 */

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, serverTimestamp } = require("firebase/firestore");

const plotKey = process.argv[2];
const targetUserId = process.argv[3];

if (!plotKey || !targetUserId) {
  console.error("Usage: node scripts/test-chat-message.js <plotKey> <yourClerkUserId>");
  console.error("Example: node scripts/test-chat-message.js 3_5 user_2abc123");
  process.exit(1);
}

const app = initializeApp({
  apiKey: "AIzaSyCTfNk-F92lXgcyvpu1FILXCFzZMn-ABs0",
  projectId: "hailmary-3ff6c",
});

const db = getFirestore(app);

async function main() {
  const docRef = await addDoc(collection(db, "oilPlotMessages"), {
    plotKey,
    fromUserId: "test-player-999",
    fromUsername: "OilBaron42",
    threadUserId: targetUserId,
    text: "Hey! Wanna trade plots? I've got deep deposits over at 7,2 🛢️",
    timestamp: serverTimestamp(),
  });
  console.log(`✅ Test message created: ${docRef.id}`);
  console.log(`   plotKey: ${plotKey}`);
  console.log(`   to: ${targetUserId}`);
  console.log(`   from: OilBaron42 (test-player-999)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
