/**
 * Patches for @elizaos/plugin-twitter:
 *
 * 1. Discovery self-reply fix — skip own tweets in discovery results
 * 2. Mention handler — use mentions timeline API (primary) + search fallback
 * 3. Summon filter — respond to @rl80token mentions, $RL80 cashtag, "hey rl80"
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

  // Build the patched code as an array of lines joined, to avoid template escaping hell
  const patchedMentionsLines = [
    '      // PATCH: always fetch latest mentions without cursor',
    '      // Strategy: use mentions timeline API (reliable) + search fallback',
    '      let mentionTweets = [];',
    '      // Primary: use v2 mentions timeline (most reliable for @mentions)',
    '      try {',
    '        const userId = this.client.profile?.id;',
    '        if (userId) {',
    '          const v2Client = this.client.twitterClient.auth.getV2Client();',
    '          const mentionsTimeline = await v2Client.v2.userMentionTimeline(userId, {',
    '            max_results: 50,',
    '            "tweet.fields": ["id", "text", "created_at", "author_id", "referenced_tweets", "entities", "public_metrics"],',
    '            "user.fields": ["id", "name", "username", "profile_image_url"],',
    '            expansions: ["author_id", "referenced_tweets.id"]',
    '          });',
    '          for await (const tweet of mentionsTimeline) {',
    '            const author = mentionsTimeline.includes?.users?.find(u => u.id === tweet.author_id);',
    '            mentionTweets.push({',
    '              id: tweet.id,',
    '              text: tweet.text || "",',
    '              timestamp: tweet.created_at ? new Date(tweet.created_at).getTime() : Date.now(),',
    '              userId: tweet.author_id || "",',
    '              username: author?.username || "",',
    '              name: author?.name || "",',
    '              conversationId: tweet.id,',
    '              hashtags: tweet.entities?.hashtags?.map(h => h.tag) || [],',
    '              mentions: tweet.entities?.mentions?.map(m => ({ id: m.id || "", username: m.username || "", name: "" })) || [],',
    '              photos: [],',
    '              urls: tweet.entities?.urls?.map(u => u.url) || [],',
    '              thread: [],',
    '              permanentUrl: author?.username ? "https://x.com/" + author.username + "/status/" + tweet.id : ""',
    '            });',
    '          }',
    '          logger5.info("Mentions timeline returned " + mentionTweets.length + " tweets");',
    '        }',
    '      } catch (e) {',
    '        logger5.warn("Mentions timeline API failed, falling back to search:", e.message || e);',
    '      }',
    '      // Fallback: search for @mentions if timeline returned nothing',
    '      if (mentionTweets.length === 0) {',
    '        try {',
    '          const mentionResult = await this.client.fetchSearchTweets(',
    '            "@" + twitterUsername,',
    '            50,',
    '            1 /* Latest */',
    '          );',
    '          mentionTweets = mentionResult.tweets || [];',
    '          logger5.info("Search fallback returned " + mentionTweets.length + " tweets");',
    '        } catch (e) {',
    '          logger5.warn("Search fallback also failed:", e.message || e);',
    '        }',
    '      }',
    '      // Also search for $RL80 cashtag summons',
    '      let cashtagTweets = [];',
    '      try {',
    '        const cashtagResult = await this.client.fetchSearchTweets(',
    '          "$RL80",',
    '          50,',
    '          1 /* Latest */',
    '        );',
    '        cashtagTweets = cashtagResult.tweets || [];',
    '      } catch (e) {',
    '        // Cashtag search may fail on some API tiers',
    '      }',
    '      // Summon whitelist — @rl80token mention OR $RL80 cashtag',
    '      function isSummon(t) {',
    '        var text = (t.text || "");',
    '        var lower = text.toLowerCase();',
    '        if (lower.includes("@rl80token")) return true;',
    '        if (lower.includes("$rl80")) return true;',
    '        return false;',
    '      }',
    '      // Combine, deduplicate, and only keep summons (skip own tweets)',
    '      var ownUsername = twitterUsername?.toLowerCase();',
    '      var seenIds = new Set();',
    '      var mentionCandidates = [];',
    '      for (var tweet of [...mentionTweets, ...cashtagTweets]) {',
    '        if (seenIds.has(tweet.id)) continue;',
    '        if (tweet.username?.toLowerCase() === ownUsername) continue;',
    '        if (isSummon(tweet)) {',
    '          seenIds.add(tweet.id);',
    '          mentionCandidates.push(tweet);',
    '        }',
    '      }',
  ];
  const patchedMentions = patchedMentionsLines.join('\n');

  if (content.includes(originalMentions)) {
    content = content.replace(originalMentions, patchedMentions);
    patchCount++;
    console.log('[patch] Applied: mention handler — removed cursor, added $RL80 cashtag search');
  } else {
    console.warn('[patch] WARNING: handleMentions signature changed — mention cursor patch skipped');
  }

  // 2b: Sort mentions DESCENDING (newest first) so new tweets get priority
  const originalSort = '.sort((a, b) => a.id.localeCompare(b.id)).filter';
  const patchedSort = '.sort((a, b) => b.id.localeCompare(a.id)).filter';  // PATCH: newest first
  if (content.includes(originalSort)) {
    content = content.replace(originalSort, patchedSort);
    patchCount++;
    console.log('[patch] Applied: sort mentions newest-first');
  } else {
    console.warn('[patch] WARNING: mention sort changed — sort patch skipped');
  }

  // 2c: Increase max interactions per run from 10 to 50
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
