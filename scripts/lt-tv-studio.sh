#!/bin/bash
#
# Starts the site on this machine and opens the LT TV studio in a browser.
#
# Normally you do not run this by hand — double-click "Open LT TV Studio.command"
# in the repo folder, which is a wrapper around this file. `npm run lt:studio`
# does the same thing from a terminal.
#
# WHY THE STUDIO IS LOCAL ONLY, and not a password-protected page on the live
# site: what this pipeline produces is source code. An episode reaches /trade
# because its record is committed under src/content/lt-tv/episodes/ and
# imported by index.js at build time. A server that wrote that file into its
# own container would change nothing — the container is rebuilt from git, and
# the write goes with it. Half the working files (content/lt-tv/) are
# gitignored and exist only on the machine that made them.
#
# So a hosted studio is not this studio behind a password; it is a different
# system that commits to GitHub or keeps episodes in Firestore. See
# docs/lt-tv.md.

set -u

say() { printf '\n%s\n' "$*"; }

pause_then_exit() {
  say "$1"
  read -r -p "Press return to close this window. "
  exit "${2:-1}"
}

# The repo root is one level up from scripts/.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || pause_then_exit "Could not find the repo folder."

if [ ! -f package.json ]; then
  pause_then_exit "This does not look like the HAIL_MARY folder — no package.json here."
fi

if ! command -v npm >/dev/null 2>&1; then
  pause_then_exit "npm is not installed, so the site cannot start. Install Node.js and try again."
fi

if [ ! -d node_modules ]; then
  say "First run in this folder — installing dependencies. This takes a few minutes."
  npm install || pause_then_exit "npm install failed. The messages above say why."
fi

LOG="$(mktemp -t lt-tv-studio)"
trap 'rm -f "$LOG"' EXIT

say "Starting the site. The studio opens by itself once it is ready."

npm run dev 2>&1 | tee "$LOG" &

# Next prints the address it settled on, which is not always port 3000 — if an
# older dev server is still running it quietly moves to 3001. Read the address
# back out of the log rather than assuming, because opening the wrong port
# shows you a stale server and looks exactly like the page being missing.
URL=""
for _ in $(seq 1 120); do
  URL="$(grep -Eo 'http://localhost:[0-9]+' "$LOG" | head -1)"
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  say "The site did not report an address. The messages above say why."
else
  say "Studio: $URL/lt-tv"
  if command -v open >/dev/null 2>&1; then
    open "$URL/lt-tv"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL/lt-tv"
  fi
  say "Leave this window open while you work. Close it to stop the site."
fi

wait
