// Is the /trade temple actually on screen right now?
//
// CyborgTempleScene loads its GLB imperatively and drops it into the root
// scene, and it can leave again without the page hearing about it: a Suspense
// re-suspension destroys that subtree's effects (which tears the temple down
// and re-parses the GLB on the way back), the LT TV swap unmounts it outright,
// and a dev Fast Refresh does the same. Anything that renders ALONGSIDE the
// temple rather than under it — TickerDisplay3's ring, the loading screen —
// has to ask the scene graph rather than trust a one-shot "loaded" event.
//
// Shared so there's exactly one definition of "the temple is up".

// Name hung on the group holding the loaded temple.
export const TEMPLE_ANCHOR_NAME = 'TempleAnchor';

// Would this anchor actually draw? It must hold a loaded model, have no hidden
// ancestor (R3F hides a suspended tree by flipping visible=false on its
// objects), and — the subtle one — still climb all the way to THIS scene.
// Unmounting the temple detaches its whole group, which leaves the anchor with
// a perfectly good parent that simply isn't in the scene anymore; checking
// `parent` alone reads that orphan as present.
export const isAnchorDrawing = (anchor, scene) => {
  if (!anchor || anchor.children.length === 0) return false;
  let node = anchor;
  let root = anchor;
  while (node) {
    if (node.visible === false) return false;
    root = node;
    node = node.parent;
  }
  return root === scene;
};

// Caches the resolved anchor in `templeRef` (caller-owned, so it survives
// across frames) and re-hunts whenever the cached one stops drawing.
//
// The search is deliberately NOT throttled. An earlier version only looked
// every 15th frame, which meant a freshly mounted temple could go unnoticed for
// longer than the caller's grace period and flash the loading screen over a
// perfectly good scene. The cost is fine as written: the search only runs while
// the anchor is missing, and while it's missing the graph is small (no temple
// in it). Once found, this is a few pointer hops per frame.
export const isTempleShowing = (templeRef, scene) => {
  if (!scene) return false;
  if (isAnchorDrawing(templeRef.current, scene)) return true;
  // getObjectByName only searches the live graph, so a detached anchor can't
  // come back this way — only a freshly mounted temple can.
  templeRef.current = scene.getObjectByName(TEMPLE_ANCHOR_NAME) || null;
  return isAnchorDrawing(templeRef.current, scene);
};
