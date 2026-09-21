#!/usr/bin/env node
// The dashboard as a page you can keep open in a tab.
//
// Written by `lt-tv-status.mjs --html`. It is a SNAPSHOT: the moment it is
// written it stops being true, so it says when it was made and how to refresh
// it, rather than looking live and being stale. The terminal view is the one
// that is always current, and this says so too.
//
// Self-contained on purpose — no build step, no server, no network. It is a
// file you double-click, which is the only kind of dashboard that is still
// working in six months.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_OUT = "content/lt-tv/status.html";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const STAGE = {
  planned: { label: "Planned", note: "no script yet" },
  written: { label: "Written", note: "not recorded" },
  recorded: { label: "Recorded", note: "not on the slate" },
  "on-air": { label: "On air", note: "playable" },
};

function episodeCard(e) {
  const files = e.files.length
    ? e.files
        .map(
          (f) =>
            `<li><code>${esc(f.path)}</code><span class="what">${esc(f.what)}</span></li>`,
        )
        .join("")
    : `<li class="none">No files yet.</li>`;

  const clips = e.clips.length
    ? `<div class="block"><h4>SitePal clip names <span class="caveat">not checked against the Audio Manager</span></h4>
         <ul class="plain">${e.clips.map((c) => `<li><code>${esc(c)}</code></li>`).join("")}</ul></div>`
    : "";

  const warnings = e.warnings.length
    ? `<div class="block warn"><h4>${e.warnings.length} warning(s) from the script step</h4>
         <ul class="plain">${e.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`
    : "";

  // A working copy left behind under an old name sits beside the episode it
  // belongs to, with the same title on it. Saying so is the whole difference
  // between "why is this here twice" and one command.
  const stray = e.strandedFrom
    ? `<div class="block warn"><h4>Filed under ${esc(e.strandedFrom)}, which is not on the guide</h4>
         ${e.rehome
           ? `<p class="then">The guide has this episode as <code>${esc(e.rehome)}</code> — this is the working copy, under its old name.</p>
              <pre>npm run lt:rename -- ${esc(e.id)} ${esc(e.rehome)}</pre>`
           : `<p class="then">Nothing on the guide matches it.</p>`}</div>`
    : "";

  const next = e.next.run
    ? `<div class="block next"><h4>Next — ${esc(e.next.why)}</h4>
         <pre>${esc(e.next.run)}</pre>
         ${e.next.then ? `<p class="then">then ${esc(e.next.then)}</p>` : ""}</div>`
    : `<div class="block next done"><h4>Nothing to do — ${esc(e.next.why)}</h4></div>`;

  return `<article class="ep ${e.stage}">
    <header>
      <span class="badge">${STAGE[e.stage].label}<em>${STAGE[e.stage].note}</em></span>
      <div class="names"><h3>${esc(e.title)}</h3><code class="id">${esc(e.id)}</code></div>
      <div class="meta">${e.lines ? `${e.lines} lines` : ""}${
        e.runtime ? ` · ${esc(e.runtime)}${e.runtimeIsEstimate ? " est." : ""}` : ""
      }</div>
    </header>
    ${e.summary ? `<p class="summary">${esc(e.summary)}</p>` : ""}
    ${stray}
    ${next}
    <div class="block"><h4>Files</h4><ul class="files">${files}</ul></div>
    ${clips}
    ${warnings}
  </article>`;
}

export function renderStatusPage(status, now = new Date()) {
  const shows = status.shows
    .map(
      (s) => `<section class="show">
        <h2>${esc(s.title)}</h2>
        ${
          s.episodes.length
            ? s.episodes.map(episodeCard).join("")
            : `<p class="none">Nothing on the slate yet.</p>`
        }
      </section>`,
    )
    .join("");

  const orphans = status.orphans.length
    ? `<section class="show"><h2>Not attached to any show</h2>${status.orphans.map(episodeCard).join("")}</section>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LT TV — where every episode is</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfaf8; --panel: #fff; --ink: #1a1a1a; --dim: #6b6b6b; --line: #e6e3dd;
        --planned: #9a9a9a; --written: #b8860b; --recorded: #2f6fb0; --onair: #2e7d44;
    --code: #f3f1ec;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #16161a; --panel: #1e1e24; --ink: #ececec; --dim: #9a9a9a; --line: #2e2e36;
      --planned: #7a7a7a; --written: #d1a03a; --recorded: #6ba3de; --onair: #5fbe7d;
      --code: #26262e;
    }
  }
  :root[data-theme="dark"] {
    --bg: #16161a; --panel: #1e1e24; --ink: #ececec; --dim: #9a9a9a; --line: #2e2e36;
    --planned: #7a7a7a; --written: #d1a03a; --recorded: #6ba3de; --onair: #5fbe7d;
    --code: #26262e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.55 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  .wrap { max-width: 860px; margin: 0 auto; padding: 40px 16px 80px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; letter-spacing: -0.01em; }
  .asof { color: var(--dim); font-size: .85rem; margin: 0 0 6px; }
  .asof code { background: none; padding: 0; }
  h2 { font-size: 1.05rem; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  h3 { font-size: 1rem; margin: 0; }
  h4 { font-size: .78rem; margin: 0 0 6px; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); font-weight: 600; }
  code { background: var(--code); padding: 1px 5px; border-radius: 4px; font-size: .85em;
         font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  pre { background: var(--code); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem; }
  .ep { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
        padding: 16px 18px; margin-bottom: 14px; border-left: 4px solid var(--planned); }
  .ep.written  { border-left-color: var(--written); }
  .ep.recorded { border-left-color: var(--recorded); }
  .ep.on-air   { border-left-color: var(--onair); }
  .ep header { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: baseline; }
  .names { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; flex: 1 1 auto; }
  .id { color: var(--dim); }
  .badge { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
           color: var(--planned); display: flex; flex-direction: column; min-width: 78px; }
  .badge em { font-style: normal; font-weight: 400; text-transform: none; letter-spacing: 0;
              color: var(--dim); font-size: .72rem; }
  .written .badge  { color: var(--written); }
  .recorded .badge { color: var(--recorded); }
  .on-air .badge   { color: var(--onair); }
  .meta { color: var(--dim); font-size: .82rem; }
  .summary { color: var(--dim); margin: 8px 0 0; }
  .block { margin-top: 14px; }
  .next pre { border-left: 3px solid var(--recorded); }
  .next.done h4 { color: var(--onair); }
  .then { color: var(--dim); font-size: .85rem; margin: 6px 0 0; }
  .warn h4 { color: var(--written); }
  ul { margin: 0; padding: 0; list-style: none; }
  .files li { padding: 5px 0; border-bottom: 1px dashed var(--line); }
  .files li:last-child { border-bottom: 0; }
  .what { display: block; color: var(--dim); font-size: .8rem; margin-top: 2px; }
  .plain li { padding: 2px 0; font-size: .88rem; }
  .none { color: var(--dim); }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line);
           color: var(--dim); font-size: .85rem; }
</style></head>
<body><div class="wrap">
  <h1>LT TV — where every episode is</h1>
  <p class="asof">A snapshot taken ${esc(now.toISOString().replace("T", " ").slice(0, 16))} UTC.
     Refresh it with <code>node scripts/lt-tv-status.mjs --html</code>.</p>
  ${shows}
  ${orphans}
  <footer>
    Read from the slate, the staging area and the audio directory — never from a
    record of what a previous run did. The one thing it cannot see is SitePal:
    the Audio Manager lives outside the repo, so a clip name here means the
    record asks for that name, not that the upload exists.
  </footer>
</div></body></html>
`;
}

export async function writeStatusPage(status, out = DEFAULT_OUT) {
  const path = resolve(out);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderStatusPage(status));
  return path;
}
