# One-minute ElevenLabs dialogue test

This test generates one short conversation and turns it into:

- `master-dialogue.mp3`: the complete conversation for review
- `john-sitepal-balanced.wav`: John speaks while everything else is silent
- `gr80-sitepal-balanced.wav`: GR80 speaks while everything else is silent
- `voice-segments.json`: the timing information returned by ElevenLabs
- `talk-show-timing.json`: compact line starts, ends, speakers, and duration

For the complete repeatable episode workflow—including emotion brackets,
artifact/stub troubleshooting, SitePal uploads, animation cues, and listener
gaze—see [`../docs/talk-show-production.md`](../docs/talk-show-production.md).

## Run the test

Open Terminal, change to this folder, and run:

```bash
./run_test.sh
```

The script asks for the ElevenLabs API key without displaying it. The key is used
for that run only and is not saved in this folder.

Generated files appear in the `output` folder. Upload the two SitePal files to
their respective characters. The live talk show starts both balanced tracks
together; their complementary silence reconstructs the conversation while each
avatar lip-syncs only its own lines. The master MP3 is for review/reference.

The SitePal tracks are uncompressed WAV files. Each one begins with complete
silence, admits only that character's reported speech segments, and applies a
short fade at every boundary to prevent clicks or stray sounds between lines.
They remove 120 milliseconds at the start of each ElevenLabs speaker handoff,
where the transitional artifacts occur, but only 10 milliseconds at the end so
final syllables remain intact. These files are only for driving SitePal's mouth
animation; use the master dialogue file for the audible soundtrack.

## Voice assignment

- Connor: `IcFWazAaBzXNwLWpySgF`
- Saint GR80: `JBFqnCBsd6RMkjVDRZzb`

To change a voice, update its ID in both `dialogue.json` and the `SPEAKERS`
mapping near the top of `process_dialogue.py`.
