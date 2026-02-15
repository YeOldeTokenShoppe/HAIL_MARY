/**
 * Patches for @elizaos/plugin-twitter:
 *
 * 1. Discovery self-reply fix — skip own tweets in discovery results
 * 2. Mention handler — remove cursor, fetch fresh, process ALL mentions
 * 3. Mention handler — also search for $RL80 cashtag as a summon mechanism
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
let patchCount = 0;

// =============================================================
// PATCH 1: Skip own tweets in discovery scoreTweet()
// =============================================================
if (!content.includes('PATCH: skip own tweets in discovery')) {
  const original1 = `  scoreTweet(tweet, source) {
    if (tweet.isRetweet) {
      return {
        tweet,
        relevanceScore: 0,
        engagementType: "skip"
      };
    }`;

  const patched1 = `  scoreTweet(tweet, source) {
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

  if (content.includes(original1)) {
    content = content.replace(original1, patched1);
    patchCount++;
    console.log('[patch] Applied: discovery self-reply fix');
  } else {
    console.warn('[patch] WARNING: scoreTweet signature changed — discovery patch skipped');
  }
} else {
  console.log('[patch] Discovery self-reply fix already applied');
}

// =============================================================
// PATCH 2: Mention handler — no cursor, fetch fresh, search $RL80 too
// =============================================================
if (!content.includes('PATCH: always fetch latest mentions without cursor')) {
  // 2a: Replace entire handleMentions to also search for $RL80
  const originalMentions = `      const cachedCursor = await this.runtime.getCache(cursorKey);
      const searchResult = await this.client.fetchSearchTweets(
        \`@\${twitterUsername}\`,
        20,
        1 /* Latest */,
        String(cachedCursor)
      );
      const mentionCandidates = searchResult.tweets;
      if (mentionCandidates.length > 0 && searchResult.previous) {
        await this.runtime.setCache(cursorKey, searchResult.previous);
      } else if (!searchResult.previous && !searchResult.next) {
        await this.runtime.setCache(cursorKey, "");
      }`;

  const patchedMentions = `      // PATCH: always fetch latest mentions without cursor
      // Search for @mentions
      const mentionResult = await this.client.fetchSearchTweets(
        \`@\${twitterUsername}\`,
        50,
        1 /* Latest */
      );
      // Also search for $RL80 cashtag summons
      let cashtagTweets = [];
      try {
        const cashtagResult = await this.client.fetchSearchTweets(
          "$RL80",
          50,
          1 /* Latest */
        );
        cashtagTweets = cashtagResult.tweets || [];
      } catch (e) {
        // Cashtag search may fail on some API tiers — that's OK
      }
      // Spam/pump filter
      const SPAM_PATTERNS = /\\b(guaranteed|100x|1000x|next gem|hidden gem|pump|moonshot|presale|airdrop|whitelist|dm me|send me|giveaway|free mint)\\b/i;
      function isSpamTweet(t) {
        const text = (t.text || "").toLowerCase();
        // Mass @mentions (3+ different @usernames) = spam
        const mentions = text.match(/@\\w+/g) || [];
        const uniqueMentions = new Set(mentions);
        if (uniqueMentions.size >= 3) return true;
        // Pump/spam keywords
        if (SPAM_PATTERNS.test(t.text || "")) return true;
        // Tons of cashtags (3+) = pump signal
        const cashtags = text.match(/\\$[a-zA-Z]+/g) || [];
        if (cashtags.length >= 3) return true;
        return false;
      }
      // Combine, deduplicate, and filter spam
      const seenIds = new Set();
      const mentionCandidates = [];
      for (const tweet of [...(mentionResult.tweets || []), ...cashtagTweets]) {
        if (!seenIds.has(tweet.id) && !isSpamTweet(tweet)) {
          seenIds.add(tweet.id);
          mentionCandidates.push(tweet);
        }
      }`;

  if (content.includes(originalMentions)) {
    content = content.replace(originalMentions, patchedMentions);
    patchCount++;
    console.log('[patch] Applied: mention handler — removed cursor, added $RL80 cashtag search');
  } else {
    console.warn('[patch] WARNING: handleMentions signature changed — mention cursor patch skipped');
  }

  // 2b: Increase max interactions per run from 10 to 50
  const originalMax = `TWITTER_MAX_ENGAGEMENTS_PER_RUN") || "10"`;
  const patchedMax = `TWITTER_MAX_ENGAGEMENTS_PER_RUN") || "50"`;

  if (content.includes(originalMax)) {
    content = content.replace(originalMax, patchedMax);
    patchCount++;
    console.log('[patch] Applied: increased max mention engagements to 50');
  } else {
    console.warn('[patch] WARNING: max engagements default changed — limit patch skipped');
  }
} else {
  console.log('[patch] Mention handler patches already applied');
}

if (patchCount > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch] All patches applied successfully (${patchCount} changes)`);
} else {
  console.log('[patch] No changes needed');
}
