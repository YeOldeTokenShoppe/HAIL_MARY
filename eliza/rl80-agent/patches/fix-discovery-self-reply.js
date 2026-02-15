/**
 * Patch: Fix TwitterDiscoveryClient self-tweet engagement
 *
 * ElizaOS discovery service doesn't filter out the bot's own tweets
 * from search results, causing it to quote-tweet its own posts.
 * This patch adds a self-tweet check to the scoreTweet() method.
 *
 * Applied via postinstall script in package.json.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@elizaos',
  'plugin-twitter',
  'dist',
  'index.js'
);

if (!fs.existsSync(filePath)) {
  console.log('[patch] @elizaos/plugin-twitter not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

// Check if already patched
if (content.includes('PATCH: skip own tweets in discovery')) {
  console.log('[patch] Discovery self-reply fix already applied');
  process.exit(0);
}

const original = `  scoreTweet(tweet, source) {
    if (tweet.isRetweet) {
      return {
        tweet,
        relevanceScore: 0,
        engagementType: "skip"
      };
    }`;

const patched = `  scoreTweet(tweet, source) {
    if (tweet.isRetweet) {
      return {
        tweet,
        relevanceScore: 0,
        engagementType: "skip"
      };
    }
    // PATCH: skip own tweets in discovery
    if (this.client.profile?.id && tweet.userId === this.client.profile.id) {
      return { tweet, relevanceScore: 0, engagementType: "skip" };
    }
    if (this.client.profile?.username && tweet.username?.toLowerCase() === this.client.profile.username.toLowerCase()) {
      return { tweet, relevanceScore: 0, engagementType: "skip" };
    }`;

if (!content.includes(original)) {
  // The file was already manually patched or the source changed —
  // revert any manual patch and try again
  console.log('[patch] Could not find exact match for scoreTweet. Checking if manually patched...');
  if (content.includes('PATCH: skip own tweets in discovery')) {
    console.log('[patch] Already patched');
    process.exit(0);
  }
  console.error('[patch] WARNING: scoreTweet signature changed — patch may need updating');
  process.exit(0);
}

content = content.replace(original, patched);
fs.writeFileSync(filePath, content, 'utf8');
console.log('[patch] Discovery self-reply fix applied successfully');
