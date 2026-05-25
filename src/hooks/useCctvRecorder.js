"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const RECORDING_DURATION_MS = 14000;
const CAPTURE_FPS = 15;
const MAX_RECORDINGS = 20;

export default function useCctvRecorder(cctvCanvasRef, selectedCol, selectedRow, userId) {
  const [isRecording, setIsRecording] = useState(false);
  const [localRecordings, setLocalRecordings] = useState([]);
  const [remoteRecordings, setRemoteRecordings] = useState([]);
  const [playbackUrl, setPlaybackUrl] = useState(null);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const activeEventRef = useRef(null);
  const startTimeRef = useRef(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Load recordings from Firestore for the viewed cell (owner only) — live listener
  useEffect(() => {
    if (selectedCol === null || selectedRow === null || !userId) {
      setRemoteRecordings([]);
      return;
    }

    let unsub = null;
    let cancelled = false;
    (async () => {
      try {
        const { db, collection, query, where, onSnapshot } = await import("@/lib/firebaseClient");
        if (!db || cancelled) return;

        const q = query(
          collection(db, "cctvRecordings"),
          where("userId", "==", userId),
          where("col", "==", selectedCol),
          where("row", "==", selectedRow)
        );
        unsub = onSnapshot(q, (snap) => {
          const recs = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              eventType: data.eventType,
              eventId: data.eventId,
              col: data.col,
              row: data.row,
              durationMs: data.durationMs,
              createdAt: data.createdAt?.toMillis?.() || Date.now(),
              downloadUrl: data.downloadUrl,
              storagePath: data.storagePath,
            };
          });
          recs.sort((a, b) => b.createdAt - a.createdAt);
          setRemoteRecordings(recs.slice(0, MAX_RECORDINGS));
        }, (err) => {
          console.warn("CCTV: Failed to load recordings", err);
        });
      } catch (err) {
        console.warn("CCTV: Failed to init recordings listener", err);
      }
    })();

    return () => { cancelled = true; unsub?.(); };
  }, [selectedCol, selectedRow, userId]);

  // Merge local + remote, deduplicate by eventId, newest first
  const recordings = (() => {
    const seen = new Set();
    const merged = [];
    for (const r of [...localRecordings, ...remoteRecordings]) {
      const key = r.eventId || r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
    merged.sort((a, b) => b.createdAt - a.createdAt);
    return merged.slice(0, MAX_RECORDINGS);
  })();

  const startRecording = useCallback((eventMeta) => {
    // Mutex — only one recording at a time
    if (activeEventRef.current) return;

    const canvas = cctvCanvasRef?.current;
    if (!canvas) return;

    let stream;
    try {
      stream = canvas.captureStream(CAPTURE_FPS);
    } catch (err) {
      console.warn("CCTV: captureStream not supported", err);
      return;
    }

    // Pick a supported mime type
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : null;

    if (!mimeType) {
      console.warn("CCTV: No supported MediaRecorder mime type");
      return;
    }

    let recorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 500_000,
      });
    } catch (err) {
      console.warn("CCTV: MediaRecorder init failed", err);
      return;
    }

    chunksRef.current = [];
    activeEventRef.current = eventMeta;
    startTimeRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const meta = activeEventRef.current;
      activeEventRef.current = null;
      setIsRecording(false);

      if (chunksRef.current.length === 0) return;

      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      const durationMs = Date.now() - (startTimeRef.current || Date.now());
      const timestamp = Date.now();
      const fileName = `${meta?.eventType || "unknown"}_${meta?.eventId || "x"}_${timestamp}.webm`;
      const storagePath = `cctv/${fileName}`;

      // Create a local entry immediately (with local blob URL for instant playback)
      const localUrl = URL.createObjectURL(blob);
      const localEntry = {
        id: `local_${timestamp}`,
        eventType: meta?.eventType || "unknown",
        eventId: meta?.eventId,
        col: meta?.col,
        row: meta?.row,
        durationMs,
        createdAt: timestamp,
        downloadUrl: localUrl,
        storagePath,
      };

      setLocalRecordings((prev) => [localEntry, ...prev].slice(0, MAX_RECORDINGS));

      // Upload to Firebase in background (lazy import to avoid SSR issues)
      try {
        const { db, storage, ref, uploadBytes, getDownloadURL, collection, addDoc, serverTimestamp } = await import("@/lib/firebaseClient");
        if (!storage || !db) return;

        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);

        // Write Firestore doc
        await addDoc(collection(db, "cctvRecordings"), {
          userId: userIdRef.current || null,
          eventId: meta?.eventId || null,
          eventType: meta?.eventType || "unknown",
          col: meta?.col ?? null,
          row: meta?.row ?? null,
          downloadUrl,
          storagePath,
          durationMs,
          createdAt: serverTimestamp(),
        });

        // Update local entry with remote URL
        setLocalRecordings((prev) =>
          prev.map((r) =>
            r.id === localEntry.id ? { ...r, downloadUrl } : r
          )
        );

        // Send footage to Telegram
        if (userIdRef.current) {
          fetch("/api/oil-telegram-cctv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: userIdRef.current,
              downloadUrl,
              eventId: meta?.eventId || null,
              eventType: meta?.eventType || "unknown",
              col: meta?.col ?? null,
              row: meta?.row ?? null,
            }),
          }).catch((err) => console.warn("CCTV: Telegram send failed", err));
        }
      } catch (err) {
        console.error("CCTV: Upload failed", err);
        // Local blob URL still works for this session
      }
    };

    recorderRef.current = recorder;
    recorder.start(1000); // collect chunks every second
    setIsRecording(true);

    // Auto-stop after duration
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, RECORDING_DURATION_MS);
  }, [cctvCanvasRef]);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    recordings,
    playbackUrl,
    setPlaybackUrl,
    startRecording,
    stopRecording,
  };
}
