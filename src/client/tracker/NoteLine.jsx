// Matches only the ⌛/🥕 auto-generated note lines (from useTrackerModel's
// formatHoursRounded, always "<number> hrs"), so free-typed user notes that
// happen to start with those words are never reformatted.
const AUTO_NOTE_PATTERN = /^(⌛ Fasting for |🥕 )(\d+(?:\.\d+)? hrs)(.*)$/;

export default function NoteLine({ line }) {
  const match = line.match(AUTO_NOTE_PATTERN);
  if (!match) return line;
  const [, prefix, duration, rest] = match;
  return (
    <>
      {prefix}
      <strong>{duration}</strong>
      {rest}
    </>
  );
}
