EL GAMBUSINO — ONE MORE SWING, VERSION 2

Three parallax layers, each 1254 x 1254 pixels, with matching canvas sizes and origins:
1. 01-background.png — opaque painted mine interior, split timbers and notched gold-veined support pillar.
2. 02-el-gambusino.png — transparent crouched prospector AND foreshortened pickaxe, including both gripping hands.
3. 03-foreground.png — transparent lantern, gold ore and falling chips.

Stack in that order. Keep the pickaxe with the character so both hands and the tool remain connected during motion.
Keep card text and frame in the existing fixed UI above the artwork.
Preserve transparent margins. The pickaxe and knee deliberately extend beyond canvas edges.
Use a common overscan scale and small parallax offsets to avoid exposing image edges.
Suggested starting values at a 400 px art width: common scale 1.06; background +/-2 px, character +/-5 px, foreground +/-9 px.

concept-master.png is the original full illustration used as the source for layer generation.
preview.html displays the actual three-layer stack at rest.
combined-preview.png is its browser-rendered preview; use the full-resolution layer PNGs for the game.
Generated separation reconstructs occluded regions and can differ slightly from the concept master.

Tool: built-in image_gen. Complete master and layer prompts: prompts.txt.
