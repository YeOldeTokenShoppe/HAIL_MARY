"use client";

import Soundfont from "soundfont-player";
import { useCallback, useEffect, useRef, useState } from "react";

/* ===================== YOUR WHEEL MAPS ===================== */

// Pitch ratios you already shared (kept for section ordering & possible future use)
const wheelPitchMap: Record<string, number> = {

  'wheel_section':    1.0,    // G2
  'wheel_section001': 1.122,  // A2 ✓
  'wheel_section002': 1.189,  // A#2/Bb2 ✓
  'wheel_section003': 1.260,  // B2
  'wheel_section004': 1.335,  // C3 ✓
  'wheel_section005': 1.414,  // C#3/Db3
  'wheel_section006': 1.498,  // D3 ✓
  'wheel_section007': 1.587,  // D#3/Eb3
  'wheel_section008': 1.682,  // E3 ✓
  'wheel_section009': 1.782,  // F3 ✓
  'wheel_section010': 1.888,  // F#3/Gb3
  'wheel_section011': 2.0,    // G3 ✓
  'wheel_section012': 2.119,  // G#3/Ab3
  'wheel_section013': 2.245,  // A3 ✓
  'wheel_section014': 2.378,  // A#3/Bb3 ✓
  'wheel_section015': 2.520   // B3
};

const SECTION_IDS = Object.keys(wheelPitchMap);

// Default per-section note for click-to-sing (tune to taste)
const DEFAULT_SECTION_TO_NOTE: Record<string, string> = {
  wheel_section:"E3", wheel_section001:"F3",  wheel_section002:"F#3", wheel_section003:"G3",
  wheel_section004:"G#3", wheel_section005:"A3", wheel_section006:"A#3", wheel_section007:"B3",
  wheel_section008:"C4",  wheel_section009:"C#4",wheel_section010:"D4",  wheel_section011:"D#4",
  wheel_section012:"E4",  wheel_section013:"F4", wheel_section014:"F#4", wheel_section015:"G4",
};

/* =============== OPENING SECTION (FROM YOUR EVENT LIST) =============== */

export type EventRow = { bar:number; beat:number; note:string; len?:[number,number,number,number] };

export const OPENING_ROWS: EventRow[] = [
  // Bar 1
  { bar:1, beat:1, note:"A2", len:[1,0,0,0] },
  { bar:1, beat:1, note:"D3", len:[1,0,0,0] },
  { bar:1, beat:1, note:"F3", len:[1,0,0,0] },

  // Bar 2
  { bar:2, beat:1, note:"G2",  len:[0,2,0,0] },
  { bar:2, beat:1, note:"C3",  len:[0,2,0,0] },
  { bar:2, beat:1, note:"E3",  len:[0,2,0,0] },

  { bar:2, beat:3, note:"A#2", len:[0,2,0,0] },
  { bar:2, beat:3, note:"D3",  len:[0,2,0,0] },
  { bar:2, beat:3, note:"G3",  len:[0,2,0,0] },

  // Bar 3
  { bar:3, beat:1, note:"A2", len:[1,0,0,0] },
  { bar:3, beat:1, note:"D3", len:[1,0,0,0] },
  { bar:3, beat:1, note:"F3", len:[1,0,0,0] },

  // Bar 4
  { bar:4, beat:1, note:"G2", len:[0,2,0,0] },
  { bar:4, beat:1, note:"C3", len:[0,2,0,0] },
  { bar:4, beat:1, note:"E3", len:[0,2,0,0] },

  { bar:4, beat:3, note:"A#2", len:[0,2,0,0] },
  { bar:4, beat:3, note:"D3",  len:[0,2,0,0] },
  { bar:4, beat:3, note:"G3",  len:[0,2,0,0] },

  // Bar 5
  { bar:5, beat:1, note:"A2", len:[1,0,0,0] },
  { bar:5, beat:1, note:"D3", len:[1,0,0,0] },
  { bar:5, beat:1, note:"F3", len:[1,0,0,0] },

  // Bar 6
  { bar:6, beat:1, note:"C3", len:[0,2,0,0] },
  { bar:6, beat:1, note:"E3", len:[0,2,0,0] },
  { bar:6, beat:1, note:"G3", len:[0,2,0,0] },

  { bar:6, beat:3, note:"E3",  len:[0,2,0,0] },
  { bar:6, beat:3, note:"G3",  len:[0,2,0,0] },
  { bar:6, beat:3, note:"A#3", len:[0,2,0,0] },

  // Bar 7
  { bar:7, beat:1, note:"C3", len:[0,2,0,0] },
  { bar:7, beat:1, note:"F3", len:[0,2,0,0] },
  { bar:7, beat:1, note:"A3", len:[0,2,0,0] },

  { bar:7, beat:3, note:"D3",  len:[0,2,0,0] },
  { bar:7, beat:3, note:"F3",  len:[0,2,0,0] },
  { bar:7, beat:3, note:"A#3", len:[0,2,0,0] },

  // Bar 8
  { bar:8, beat:1, note:"F3", len:[0,2,0,0] },
  { bar:8, beat:1, note:"A3", len:[0,2,0,0] },
  { bar:8, beat:1, note:"C4", len:[0,2,0,0] },

  { bar:8, beat:3, note:"E3", len:[1,2,0,0] },
  { bar:8, beat:3, note:"G3", len:[1,2,0,0] },
  { bar:8, beat:3, note:"C4", len:[1,2,0,0] },

  // Bar 10
  { bar:10, beat:1, note:"D3", len:[4,0,0,0] },
  { bar:10, beat:1, note:"F3", len:[4,0,0,0] },
  { bar:10, beat:1, note:"A3", len:[4,0,0,0] },
];

/* ======================== HOOK ======================== */

type UseChoirWheelOpts = {
  bpm?: number;
  beatsPerBar?: number;
  sectionToNote?: Record<string,string>;
  highlightMs?: number;
  onPlaySection?: (sectionId: string, duration?: number) => void; // Callback to trigger your audio/visual system
};

export function useChoirWheel(opts: UseChoirWheelOpts = {}) {
  const {
    bpm = 100,
    beatsPerBar = 4,
    sectionToNote = DEFAULT_SECTION_TO_NOTE,
    highlightMs = 500,
    onPlaySection
  } = opts;

  const [ready, setReady] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const choirRef = useRef<Awaited<ReturnType<typeof Soundfont.instrument>> | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);

  const normalizeSharp = (s: string) => s.replace("♯", "#");

  // Map note → wheel section (linear window C3..C6 → 16 slices)
  const noteToSection = useCallback((noteName: string) => {
    const nn = normalizeSharp(noteName);
    const N = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const m = nn.match(/^([A-G])(#?)(-?\d)$/i);
    if (!m) return SECTION_IDS[0];
    const idx = N.indexOf(m[1].toUpperCase() + (m[2] || ""));
    const oct = parseInt(m[3], 10);
    const midi = (oct + 1) * 12 + idx;
    const min = 48, max = 84; // C3..C6
    const t = Math.max(0, Math.min(1, (midi - min) / (max - min)));
    const sidx = Math.floor(t * (SECTION_IDS.length - 1));
    return SECTION_IDS[sidx];
  }, []);

  const highlight = useCallback((sectionId: string, durationSec = 2) => {
    // Use the callback to trigger your audio/visual system
    if (onPlaySection) {
      onPlaySection(sectionId, durationSec);
    } else {
      // Fallback to original CSS-only approach
      const el = document.getElementById(sectionId);
      if (!el) return;
      el.classList.add("wheel-active");
      window.setTimeout(() => el.classList.remove("wheel-active"), durationSec * 1000);
    }
  }, [onPlaySection]);

  const init = useCallback(async () => {
    // Simplified init - just set ready to true since we're using external audio system
    setReady(true);
  }, []);

  const playNote = useCallback(async (noteName: string, durationSec = 0.9) => {
    if (!ready) await init();
    const nn = normalizeSharp(noteName);
    
    // Just trigger our highlight/callback system immediately
    const sid = noteToSection(nn);
    highlight(sid, durationSec * 1000);
  }, [ready, init, noteToSection, highlight]);

  const playSection = useCallback(async (sectionId: string, durationSec = 0.9) => {
    const note = sectionToNote[sectionId];
    if (note) return playNote(note, durationSec);
  }, [sectionToNote, playNote]);

  // Group simultaneous notes (same bar/beat) into a chord
  const groupChords = useCallback((rows: EventRow[]) => {
    const key = (r: EventRow) => `${r.bar}:${r.beat}`;
    const map = new Map<string, EventRow[]>();
    rows.forEach(r => { const k = key(r); if (!map.has(k)) map.set(k, []); map.get(k)!.push(r); });
    return Array.from(map.entries())
      .sort((a,b) => {
        const [ab, bb] = [a[0].split(":").map(Number), b[0].split(":").map(Number)];
        return ab[0]-bb[0] || ab[1]-bb[1];
      }).map(([, arr]) => arr);
  }, []);

  const playRows = useCallback(async (rows: EventRow[], bpmLocal = bpm, beats = beatsPerBar) => {
    if (!ready) await init();
    const beatSec = 60 / bpmLocal;
    const t0 = Date.now(); // Use Date.now() instead of audio context time
    const chords = groupChords(rows);

    chords.forEach(ch => {
      const { bar, beat } = ch[0];
      const delayMs = ((bar - 1) * beats + (beat - 1)) * beatSec * 1000;

      ch.forEach(ev => {
        const nn = normalizeSharp(ev.note);
        const durBeats = ev.len ? (ev.len[0] * beats + ev.len[1]) : 1;
        const durSec = Math.max(0.25, durBeats * beatSec);

        // Trigger our highlight/callback system with proper timing and duration
        const sid = noteToSection(nn);
        window.setTimeout(() => highlight(sid, durSec), delayMs);
      });
    });
  }, [ready, init, bpm, beatsPerBar, groupChords, noteToSection, highlight]);

  // Optional helper: attach click listeners to elements with ids = section ids
  const bindClicks = useCallback(() => {
    SECTION_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const onClick = async () => { await init(); await playSection(id, 0.9); };
      el.addEventListener("click", onClick);
    });
  }, [init, playSection]);

  // (No teardown required unless you add manual listeners; bindClicks attaches on demand.)

  return {
    ready,
    init,                 // call once after first user gesture (mobile)
    playNote,             // play by note name e.g. "C4"
    playSection,          // play by wheel section id
    playRows,             // play any EventRow[] sequence
    playOpening: () => playRows(OPENING_ROWS),
    noteToSection,
    bindClicks,           // attach click handlers if your wheel slices are plain DOM nodes
  };
}

/* ==================== tiny CSS helper (in your globals) ====================
.wheel-active {
  filter: drop-shadow(0 0 10px currentColor) brightness(1.35);
  transition: filter .12s ease;
}
========================================================================== */