import { useState } from "react";

// Matches only the ⌛/🥕 auto-generated note lines (from useTrackerModel's
// formatHoursRounded, always "<number> hrs"), so free-typed user notes that
// happen to start with those words are never reformatted. The optional
// " ago" and parenthetical food description are split out so the
// description alone can be collapsed, leaving the duration always visible.
const AUTO_NOTE_PATTERN =
  /^(⌛ Fasting for |🥕 )(\d+(?:\.\d+)? hrs)( ago)?( \(.*\))?$/;

export default function NoteLine({ line, collapsible = false }) {
  const [expanded, setExpanded] = useState(false);
  const match = line.match(AUTO_NOTE_PATTERN);
  if (!match) return line;
  const [, prefix, duration, agoPart, detailPart] = match;
  if (!detailPart || !collapsible)
    return (
      <>
        {prefix}
        <strong>{duration}</strong>
        {agoPart}
        {detailPart}
      </>
    );
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((prev) => !prev);
      }}
      style={{
        border: 0,
        padding: 0,
        margin: 0,
        background: "transparent",
        textAlign: "inherit",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      {prefix}
      <strong>{duration}</strong>
      {agoPart} <span style={{ color: "#999" }}>{expanded ? "▾" : "▸"}</span>
      {expanded && detailPart}
    </button>
  );
}
