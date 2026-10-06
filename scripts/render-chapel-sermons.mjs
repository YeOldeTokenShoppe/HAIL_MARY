// Render the chaplain's greetings and sermons ONCE with ElevenLabs, for upload to the SitePal
// account's Audio Manager (2026-10-06). Live TTS through SitePal billed a render
// per play, per player, with two fetches each (see the request log of that day),
// so the sermons ship as recorded tracks instead: sayAudio(name) plays an
// uploaded track with lipsync and no TTS.
//
//   ELEVENLABS_API_KEY=… node scripts/render-chapel-sermons.mjs [--vendor <id>|all] [outDir]
//
// --vendor picks whose lines to render (default chapel; "all" = every vendor
// with track names), each in that vendor's own ElevenLabs voice. Writes
// outDir/<track>.mp3 (default ./sermons-out, git-ignored) plus manifest.txt
// (track name → vendor → text). Then, in SitePal:
// Audio Manager → upload each MP3 and name it EXACTLY as the file (without
// .mp3) → flip `sermonsUseTracks: true` on the chapel config in
// src/lib/vendorSitePal.js. Re-run only when a sermon's text changes.
//
// Without a key it prints the manifest and exits, which is also the quick way
// to read the current set.

import fs from "node:fs";
import path from "node:path";
import { VENDOR_SITEPAL_CONFIG } from "../src/lib/vendorSitePal.js";

const argv = process.argv.slice(2);
const vi = argv.indexOf("--vendor");
const want = vi >= 0 ? argv.splice(vi, 2)[1] : "chapel";
const vendorIds = want === "all" ? Object.keys(VENDOR_SITEPAL_CONFIG) : [want];
// Every line that names a track, per vendor: greetings (all pools) then sermons.
const sermons = [];
for (const id of vendorIds) {
  const c = VENDOR_SITEPAL_CONFIG[id];
  if (!c) { console.error(`unknown vendor "${id}" — have: ${Object.keys(VENDOR_SITEPAL_CONFIG).join(", ")}`); process.exit(1); }
  const pools = Array.isArray(c.greetings) ? { returning: c.greetings } : (c.greetings || {});
  const lines = [
    ...["first", "returning", "frequent"].flatMap((k) => (pools[k] || []).filter((g) => g && g.audio)),
    ...(c.sermons || []).filter((x) => x && x.audio),
  ];
  lines.forEach((l) => sermons.push({ ...l, vendor: id, voiceId: c.voice?.voice }));
}
const voiceId = sermons.length === 1 ? sermons[0].voiceId : (vendorIds.length === 1 ? VENDOR_SITEPAL_CONFIG[vendorIds[0]].voice?.voice : "per vendor");
const outDir = path.resolve(argv[0] || "sermons-out");
const key = process.env.ELEVENLABS_API_KEY;
const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

fs.mkdirSync(outDir, { recursive: true });
const manifest = sermons.map((s) => `${s.audio}\t${s.vendor}\t${s.text}`).join("\n") + "\n";
fs.writeFileSync(path.join(outDir, "manifest.txt"), manifest);
console.log(`${sermons.length} lines (greetings + sermons) for ${vendorIds.join(", ")}, voice ${voiceId}\n`);
console.log(manifest);

if (!key) {
  console.log("No ELEVENLABS_API_KEY in the environment — manifest written, nothing rendered.");
  process.exit(0);
}

let chars = 0;
for (const [i, s] of sermons.entries()) {
  const name = s.audio;
  const file = path.join(outDir, `${name}.mp3`);
  if (fs.existsSync(file)) { console.log(`skip ${name} (exists)`); continue; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${s.voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: s.text,
      model_id: model,
      // Steady pulpit delivery: higher stability than the unicorn's dreamy wander.
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
  });
  if (!res.ok) { console.error(`${name}: HTTP ${res.status} ${await res.text()}`); process.exitCode = 1; continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  chars += s.text.length;
  console.log(`wrote ${name}.mp3  (${(buf.length / 1024).toFixed(0)} KB, ${s.text.length} chars)`);
}
console.log(`\ndone — ${chars} characters rendered into ${outDir}`);
