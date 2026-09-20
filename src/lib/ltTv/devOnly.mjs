// The studio page exists only while you are developing.
//
// It reads the repo's working files and runs pipeline steps, neither of which
// has any meaning on a deployed server — there is no checkout there, and a
// button that spends an ElevenLabs render should not be reachable from the
// internet. So every studio route refuses outside development, and the page
// itself 404s, which is also why it needs no password: it is not there.
//
// Checked at request time rather than at build time on purpose. A constant
// folded at build time is a constant somebody can get wrong once; this is the
// actual condition, asked every time.

export const IS_DEV = () => process.env.NODE_ENV === "development";

/** null when allowed, or the Response to return when not. */
export function refuseOutsideDev() {
  if (IS_DEV()) return null;
  return Response.json(
    { error: "The LT TV studio only runs in development." },
    { status: 404 },
  );
}
