EL GATO — THE HELPFUL KNOCK
Three-layer parallax study

CANVAS
All three layer files: 1024 x 1536 pixels, PNG.
Use a shared top-left origin (0, 0), matching dimensions, and Normal/source-over blending.
Keep the transparent margins. Do not auto-trim the cutouts or fit each layer to its visible bounds.

STACK ORDER (BACK TO FRONT)
01-background.png — Fully opaque reconstructed courtyard and paving.
02-center.png — Cat body, head, tail, resting paw, hind paws, table and coins. Transparent courtyard area. Felt and wood reconstructed behind removed foreground objects.
03-foreground.png — Reaching foreleg and paw, falling calamity card, motion streaks, and the traders' hands/cards/sleeves. Transparent everywhere else.

MOTION STARTING POINT
At full source resolution, try foreground +/-6 px horizontally and +/-4 px vertically; move the center by 30% of that amount; keep the background still. These offsets were inspected in rendered proofs. The shoulder is a shared join, so keep movement gentle and all foreground components together.
Apply a shared 1.03 scale or equivalent overscan to the three layers during movement, clipping them inside the same card aperture, to conceal the original canvas edges. Tune after adding the final card frame.

PREVIEWS
composite-preview.png — Exact alpha stack of the saved layer files at rest.
layers-preview.png — Background, center and foreground, left to right. Checkerboard is for this overview only; it is not baked into the actual transparent layer PNGs.
preview.html — Optional local layer toggles and pointer-driven motion preview. Open alongside the image files in a browser. The static stack and motion extremes were checked locally; the interactive browser view could not be opened in this environment.
original-reference.png — Original selected artwork, for comparison.

PROVENANCE
This is a first-pass generative separation made with the built-in image_gen tool. Hidden areas were reconstructed, and small details differ from the original. The upper foreleg attachment was refined after checking the first composite. Generation prompts are in prompts.json. Original artwork is unchanged.
