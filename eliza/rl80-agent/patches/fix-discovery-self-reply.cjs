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
      // Summon whitelist — must contain BOTH @rl80token AND $RL80
      function isSummon(t) {
        const text = (t.text || "");
        const lower = text.toLowerCase();
        // Require both @rl80token AND $rl80 in the same tweet
        if (lower.includes("@rl80token") && lower.includes("$rl80")) return true;
        return false;
      }
      // Combine, deduplicate, and only keep summons (skip own tweets)
      const ownUsername = twitterUsername?.toLowerCase();
      const seenIds = new Set();
      const mentionCandidates = [];
      for (const tweet of [...(mentionResult.tweets || []), ...cashtagTweets]) {
        if (seenIds.has(tweet.id)) continue;
        if (tweet.username?.toLowerCase() === ownUsername) continue;
        if (isSummon(tweet)) {
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
  const originalMax = `|| process.env.TWITTER_MAX_ENGAGEMENTS_PER_RUN || "10"`;
  const patchedMax = `|| process.env.TWITTER_MAX_ENGAGEMENTS_PER_RUN || "50"`;

  const maxOccurrences = (content.match(/\|\| process\.env\.TWITTER_MAX_ENGAGEMENTS_PER_RUN \|\| "10"/g) || []).length;
  if (maxOccurrences > 0) {
    content = content.replaceAll(originalMax, patchedMax);
    patchCount++;
    console.log(`[patch] Applied: increased max engagements to 50 (${maxOccurrences} occurrences)`);
  } else {
    console.warn('[patch] WARNING: max engagements default changed — limit patch skipped');
  }
} else {
  console.log('[patch] Mention handler patches already applied');
}

// =============================================================
// PATCH 3: Increase tweet max length from 280 to 1000 (Premium+)
// =============================================================
if (!content.includes('PATCH: increased tweet max length')) {
  // 3a: The main constant
  const orig3a = 'var TWEET_MAX_LENGTH = 280;';
  const patch3a = 'var TWEET_MAX_LENGTH = 1000; // PATCH: increased tweet max length';
  if (content.includes(orig3a)) {
    content = content.replace(orig3a, patch3a);
    patchCount++;
    console.log('[patch] Applied: TWEET_MAX_LENGTH 280 → 1000');
  }

  // 3b: Prompt length instructions
  const promptPatches = [
    ['- Length: 50-280 characters (keep it punchy)', '- Length: 200-700 characters'],
    ['under 280 characters, without emojis, no questions', 'under 700 characters, without emojis, no questions'],
    ['- Is under 280 characters', '- Is under 700 characters'],
  ];
  for (const [orig, patched] of promptPatches) {
    const count = (content.match(new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > 0) {
      content = content.replaceAll(orig, patched);
      patchCount++;
      console.log(`[patch] Applied: prompt length "${orig.substring(0, 40)}..." → updated (${count} occurrences)`);
    }
  }

  // 3c: All remaining hardcoded 280 limits in truncation logic
  // Replace ".length > 280" and ".length <= 280" patterns
  const before280 = content;
  content = content.replace(/\.length > 280\)/g, '.length > 1000)');
  content = content.replace(/\.length <= 280\)/g, '.length <= 1000)');
  content = content.replace(/to 280 characters/g, 'to 1000 characters');
  if (content !== before280) {
    patchCount++;
    console.log('[patch] Applied: all hardcoded 280 truncation limits → 1000');
  }
} else {
  console.log('[patch] Tweet max length patch already applied');
}

if (patchCount > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch] All patches applied successfully (${patchCount} changes)`);
} else {
  console.log('[patch] No changes needed');
}
