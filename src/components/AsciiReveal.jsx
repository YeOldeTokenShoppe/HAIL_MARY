"use client";

import { useEffect, useRef } from "react";

const FILLER = `01010010 01001100 00111000 00110000 11100010 10000110 10010111 01001101 01100001 01110100 01100101 01110010 00100000 01100101 01111000 00100000 01001101 01100001 01100011 01101000 01101001 01101110 01100001 00100000 01010010 01001100 00111000 00110000 11100010 10000110 10010111 01001101 01100001 01110100 01100101 01110010 00100000 01100101 01111000 00100000 01001101 01100001 01100011 01101000 01101001 01101110 01100001 00100000 01010010 01001100 00111000 00110000 11100010 10000110 10010111 01001101 01100001 01110100 01100101 01110010 00100000 01100101 01111000 00100000 01001101 01100001 01100011 01101000 01101001 01101110 01100001 00100000`;

function buildText(repeats) {
  let out = "";
  for (let i = 0; i < repeats; i++) out += FILLER;
  return out;
}

export default function AsciiReveal({ src = "/images/descension.png", className }) {
  const ref = useRef(null);
  const wordsRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const text = buildText(18);
    wordsRef.current = text.split(" ");
    el.textContent = text;

    const id = setInterval(() => {
      const words = wordsRef.current;
      if (!words || words.length < 2) return;
      words.push(words.shift());
      el.textContent = words.join(" ");
    }, 50);

    return () => clearInterval(id);
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: "100%",
        aspectRatio: "3 / 4",
        overflow: "hidden",
        backgroundImage: `url(${src})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
        fontSize: "clamp(0.45rem, 0.7vw, 0.7rem)",
        lineHeight: 1.1,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontWeight: 400,
        wordBreak: "break-all",
        userSelect: "none",
      }}
      aria-label="ASCII art depicting Our Lady of Perpetual Profit"
    />
  );
}
