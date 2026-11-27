# In-House Talking Face: Build Brief

Nov 26, 2026 · @Michelle

## Goal and scope

Build one reusable talking-face component in the HAIL\_MARY repo and move one character, the rides attendant, onto it. SitePal stays live on every other page until that swap works.

This brief is written to be handed to a coding agent working in the repo. Michelle makes the product decisions listed at the end.

**In scope for version 1**

- A 2D layered portrait animated by one fragment shader: mouth, blink, brow, head sway.
- ElevenLabs voices, with mouth shapes driven by ElevenLabs timing data.
- Named expressions (smile, frown, surprised, scowl) set by one call.
- A small API shaped like the SitePal calls the site already uses.

**Out of scope for version 1**

- 3D heads, and SitePal-style head turns in depth.
- The Our Lady character. She is not using SitePal today.
- Live microphone input.

**Done when** the rides attendant speaks an ElevenLabs line on one production page with the SitePal script not loaded, on desktop and on a phone.

## What exists today

A working single-file prototype already does the hard part: [Talking Trader Lip-Sync Test](https://claude.ai/artifact/QVd8FQiQquoxSPJubgjDnX). Its source file, `talking-face-prototype.html`, comes with this brief and is the starting point for the shader.

**What it does**

- Animates one flat 1176 x 1338 image of the rides attendant in a WebGL fragment shader. No libraries.
- Opens the mouth along the mouth line in the artwork. The lips do most of the moving; the chin and beard follow at about a third of the travel.
- Changes mouth width with the sound: wider on bright sounds, rounder on dark ones.
- Blinks, sways and nods, and holds five expressions: neutral, smile, frown, surprised, scowl.
- Drives the mouth from an audio file (loudness plus spectral brightness) or from the browser's built-in voice (timing estimated from the words).

**Michelle's verdict after testing:** timing is good, and it is a good rough version, not yet as good as SitePal. An early build looked like a marionette because the whole jaw moved; separating lip travel from jaw travel fixed most of that.

**What it does not do yet**

- Feature positions were hand-placed by reading pixel coordinates off the image.
- Mouth shapes come from loudness, so lips do not close on m, b and p.
- The mic is masked out of the warp because the image is flat. Layers remove the need for that.

## Step zero: inventory the SitePal usage

Before writing any new code, list every place the repo uses SitePal. Michelle uses it on the `/trade` page and the `/hailmary` pages; confirm there are no others.

Search the repo for these terms. They are search hints recalled from SitePal's API, not a verified list, so trust what the code shows over this list.

- Embed and loader: `sitepal`, `oddcast`, `vhost`, `AC_VHost_Embed`
- Speech: `sayText`, `sayAudio`, `stopSpeech`
- Expressions: `setFacialExpression`
- Callbacks: `vh_sceneLoaded`, `vh_talkStarted`, `vh_talkEnded`, `vh_audioProgress`

Record the result as a table in the first pull request: page, character, calls used, voice or engine IDs, expressions used, and where each line of dialogue comes from (hard-coded, a data file, or generated at runtime).

That table decides the API in the section below and tells Michelle how much dialogue is scripted. Remove nothing at this step.

## Architecture

Seven small pieces, each replaceable on its own. Everything character-specific lives in a config file, so a new trader needs no new code.

| Piece | What it does | Notes |
| --- | --- | --- |
| `TalkingFace` component | Client-only React component. Owns a canvas, the WebGL program and the frame loop. Takes a character ID. | Plain WebGL on its own canvas is enough. Inside an existing R3F scene, use the same shader as a material on a plane. |
| Character config | Layer image paths and the positions of the mouth, eye, brow and head pivot. | One file per character. Format in the next section. |
| Layer compositing | Draws face, then beard, then props, from separate transparent PNGs. | The face layer gets the mouth warp and the mouth interior. The beard layer shifts down by the jaw amount. Props are drawn last with no warp. Head sway applies to all three. |
| Mouth drivers | Each frame, produce two numbers: `open` (0 to 1) and `wide` (-1 round to +1 wide). | Two drivers: a cue timeline built from ElevenLabs timing, and the prototype's loudness driver as a fallback for any other audio. |
| Expression mixer | Blends named presets into mouth curve, brow, squint, and a resting mouth shape. | Ease toward the target at about 9 per second, as in the prototype. |
| Voice route | Server-only route that calls ElevenLabs and returns audio plus timing. | Keeps the API key off the client. |
| Line cache | Pre-generated audio and cue files for scripted lines, served as static files. | Scripted lines then cost nothing per play. |

**Rules for the component**

- Pause the frame loop when the canvas is off screen, and release the WebGL context on unmount. Several faces on one page must not each run flat out.
- Cap device pixel ratio at 2.
- Honour `prefers-reduced-motion`: keep the mouth, drop the idle sway.
- Take all timing from the audio clock, never from wall-clock time, so the mouth cannot drift from the voice.

## Character config

One file per character holds everything the shader needs. The values below are the rides attendant's real numbers from the prototype, in pixels of the 1176 x 1338 source image with the origin at the top left.

```json
{
  "id": "rides-attendant",
  "size": [1176, 1338],
  "layers": { "face": "face.png", "beard": "beard.png", "props": "props.png" },
  "mouth": {
    "center": [552, 833],
    "halfWidth": 100,
    "lipDrop": 40,
    "lipLift": 10,
    "jawDrop": 12,
    "jawBlend": 115,
    "lateralFalloff": [130, 260]
  },
  "eye": { "x": [636, 724], "top": 510, "height": 54, "skinSampleY": 594 },
  "brow": { "centerX": 690, "falloffX": [110, 170], "y": [400, 548], "travel": 14 },
  "smile": { "travel": 16, "bandY": [25, 75], "falloffX": [120, 175] },
  "head": { "center": [590, 680], "radius": [540, 740], "pivot": [590, 1400] },
  "masks": [
    { "shape": "ellipse", "center": [835, 945], "radius": [105, 85], "note": "mic; delete once props are their own layer" }
  ],
  "voice": { "elevenLabsVoiceId": "TODO" }
}
```

**How to read it**

- `mouth.center` is the middle of the mouth line in the art. `lipDrop` and `lipLift` are how far the lower and upper lip travel at full open. `jawDrop` is how far the chin and beard travel; keep it well under `lipDrop` or the marionette look returns.
- `eye` describes the one visible eye. The blink slides skin sampled at `skinSampleY` down over it.
- `brow` is the band that slides up or down. Down covers the top of the eye for a scowl.
- `head.pivot` sits below the image so the head tilts from the neck.

**Expression presets** (shared defaults; a character may override any of them)

| Expression | Mouth curve | Brow | Squint | Resting open | Mouth width |
| --- | --- | --- | --- | --- | --- |
| neutral | 0 | 0 | 0 | 0 | 0 |
| smile | 1 | 0.25 | 0.3 | 0.12 | 0.9 |
| frown | -1 | -0.5 | 0.1 | 0 | -0.2 |
| surprised | 0 | 1 | 0 | 0.45 | -0.9 |
| scowl | -0.45 | -1 | 0.25 | 0 | 0 |

A character with two visible eyes needs a second `eye` entry, so make `eye` and `brow` arrays from the start.

## Voice pipeline

ElevenLabs returns timing for every character of the text along with the audio, and that timing is what turns loudness-driven flapping into real mouth shapes.

**Server route**

- Add a server-only route, for example `POST /api/voice`, taking a character ID and the text.
- It calls ElevenLabs' [speech-with-timing endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps): `POST /v1/text-to-speech/{voice_id}/with-timestamps`. The response carries the audio plus an `alignment` object with `characters`, `character_start_times_seconds` and `character_end_times_seconds`. Check the current docs for the exact response fields before coding against them.
- The API key stays in a server environment variable. It must never reach the browser.
- Every call spends money, so cap text length, rate-limit the route, and cache results by a hash of voice, settings and text.

**Timing to mouth cues**

Convert the character timings to a list of cues, each `{ t, open, wide }`, then interpolate between cues every frame.

| Letters | Mouth | open | wide |
| --- | --- | --- | --- |
| m, b, p | Lips closed | 0 | 0 |
| f, v | Nearly closed | 0.15 | 0.3 |
| a | Open | 1.0 | 0.2 |
| e, i, y | Wide | 0.6 | 0.9 |
| o, u, w | Round | 0.5 | -0.9 |
| Other consonants | Slightly open | 0.3 | 0 |
| Space, punctuation | Rest | 0 | 0 |

- Smooth between cues over roughly 60 ms, and show each cue about 40 ms before its sound. Mouths lead the voice slightly.
- Letters are an approximation because English spelling is not phonetic. That is fine for stylized faces. If it ever is not, the upgrade is a text-to-phoneme library feeding the same cue list.

**Scripted lines are pre-generated**

- Add a script that reads a manifest of lines per character and writes `public/voice/<character>/<lineId>.mp3` and a matching `.json` of cues.
- Skip any line whose text and voice settings have not changed.
- At runtime, a scripted line loads those two files. No ElevenLabs call happens while a visitor plays.

**Browser audio**

- Browsers block audio until the visitor taps or clicks. Create or resume the audio context on the first interaction, and queue any line requested before that.

## Public API

The component exposes four things, shaped so each existing SitePal call has a one-line replacement.

```ts
type Cue = { t: number; open: number; wide: number };

type SayInput =
  | { lineId: string }                    // pre-generated, scripted line
  | { text: string }                      // live line through the voice route
  | { audioUrl: string; cues?: Cue[] };   // any audio; loudness driver if no cues

type TalkingFaceHandle = {
  say(input: SayInput, opts?: { queue?: boolean }): Promise<void>; // resolves when the line ends
  stop(): void;
  setExpression(
    name: "neutral" | "smile" | "frown" | "surprised" | "scowl",
    opts?: { seconds?: number; amount?: number }
  ): void;
  on(event: "ready" | "speechstart" | "speechend", fn: () => void): () => void; // returns unsubscribe
};
```

- A new `say` interrupts the current line unless `queue` is true.
- `setExpression` with `seconds` returns to neutral afterwards. Expressions hold while the character talks.

**Replacing SitePal calls**

The left column uses the SitePal names as recalled; correct it from the step-zero inventory.

| SitePal today | In-house replacement |
| --- | --- |
| `sayText(...)` | `say({ text })`, or `say({ lineId })` if the line is scripted |
| `sayAudio(...)` | `say({ lineId })` or `say({ audioUrl })` |
| `stopSpeech()` | `stop()` |
| `setFacialExpression(...)` | `setExpression(name, { seconds, amount })` |
| `vh_sceneLoaded` | `on("ready", ...)` |
| `vh_talkStarted`, `vh_talkEnded` | `on("speechstart", ...)`, `on("speechend", ...)` |

If the inventory shows an expression or call that has no row here, add it to this table before building it.

## Rigging page

A development-only page lets Michelle place a new character's features by clicking, so no trader is ever rigged by typing pixel numbers.

- Lives at a dev route such as `/dev/rig`, and is excluded from production builds.
- Loads a character's layers and shows the live face beside the controls.
- Drag handles set the two ends of the mouth line, the eye box, the brow band, and the head pivot.
- Sliders hold the mouth open and preview each expression while placing.
- A copy button outputs the finished config in the format above.

**Done when** Michelle can rig a second trader in under five minutes without editing code.

## Build order

Nine milestones, each a small pull request with a check Michelle can see for herself. SitePal code stays in place until the last one.

1. **Inventory.** Complete step zero.
   - Check: the usage table exists and covers `/trade` and `/hailmary`.
2. **Port the prototype.** Build `TalkingFace` with the flat image, the loudness driver and the rides attendant config.
   - Check: side by side with the prototype, the same audio clip looks the same.
3. **Layers.** Switch to separate face, beard and props images.
   - Check: the mic mask is deleted and nothing smears at full mouth open.
4. **Voice route and cue driver.** Add the server route and drive the mouth from ElevenLabs timing.
   - Check: on "Step right up, buy my map", the lips visibly close on the b, m and p sounds.
5. **Pre-generated lines.** Add the generation script and the line cache.
   - Check: a scripted line plays with no request to ElevenLabs in the network tab.
6. **API and first swap.** Finish the public API and replace SitePal for the rides attendant on one page, behind an environment flag.
   - Check: with the flag on and the SitePal script blocked, the page still works.
7. **Rigging page.** Build it and rig a second trader with it.
   - Check: the five-minute test in the rigging section.
8. **Phone pass.** Test iOS Safari and Android Chrome.
   - Check: audio starts after the first tap and the face holds 30 frames per second on a mid-range phone.
9. **Migrate and remove.** Move the remaining characters on `/trade` and `/hailmary`, then delete the SitePal embed.
   - Check: no SitePal request on any page. Michelle cancels the subscription.

**Ground rules for the coding agent**

- Do not modify, re-export or rename art files.
- Do not remove or change SitePal code before milestone 9.
- Keep the shader values in the config, not hard-coded, from milestone 2 onward.
- Stop and ask when the inventory contradicts this brief.

## Known limits and open decisions

Version 1 will be good for stylized traders and will still trail SitePal in three ways.

- **No head turn in depth.** The head tilts and nods as a flat image. Matching SitePal's turn means projecting the art onto a simple 3D face mesh, a later upgrade per character.
- **Approximate mouth shapes.** Letter-based cues are close, not exact.
- **Subtle expressions on some faces.** An eyepatch and a mustache hide most of what a smile moves. Presets can be pushed further per character.

**Decisions for Michelle**

- [ ] Which page and character get the first swap? Suggested: the rides attendant, since he is already rigged.
- [ ] Is dialogue mostly scripted or mostly generated live? The inventory will show this. Mostly scripted moves milestone 5 ahead of milestone 4's live path.
- [ ] Should the open mouth show teeth in this art style? The prototype does.
- [ ] Which ElevenLabs voice ID belongs to each trader?
- [ ] Does any page need the SitePal-style head turn? If yes, plan the 3D-mesh upgrade for that character.

## Sources

- [ElevenLabs: Create speech with timing](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- [SitePal: third-party voices require the Platinum plan](https://www.sitepal.com/documentation/voices)
