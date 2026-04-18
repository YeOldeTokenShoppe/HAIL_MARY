"use client";

import "./ChromaticButton.css";

/**
 * ChromaticButton — glowing white button with pink/blue chromatic aberration on hover/active.
 *
 * Default state: bright glowing white.
 * On hover / focus / .is-active: pink + blue offset layers slide into place for a chromatic split effect.
 *
 * Props:
 *  - label:     text shown under the icon
 *  - icon:      ReactNode for the icon (e.g. an <i className="bxr bx-brain-circuit" /> or an <svg>)
 *  - active:    when true, forces the activated (chromatic) state
 *  - href:      if provided, renders as <a>; otherwise <button>
 *  - onClick:   click handler
 *  - className: extra classes
 *  - ...rest:   forwarded to the underlying element
 */
export default function ChromaticButton({
  label,
  icon,
  active = false,
  href,
  onClick,
  className = "",
  ...rest
}) {
  const Tag = href ? "a" : "button";
  const tagProps = href
    ? { href }
    : { type: rest.type || "button" };

  return (
    <Tag
      {...tagProps}
      className={`chroma-btn ${active ? "is-active" : ""} ${className}`.trim()}
      onClick={onClick}
      title={typeof label === "string" ? label : undefined}
      {...rest}
    >
      <span className="chroma-btn__icon chroma-btn__icon--pink" aria-hidden="true">
        {icon}
      </span>
      <span className="chroma-btn__icon chroma-btn__icon--blue" aria-hidden="true">
        {icon}
      </span>
      <span className="chroma-btn__icon chroma-btn__icon--base">
        {icon}
      </span>
      {label && <span className="chroma-btn__label">{label}</span>}
    </Tag>
  );
}
