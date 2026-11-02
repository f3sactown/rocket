/** Text with each of `words` marked wherever it appears, ignoring case. */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  const terms = words.filter(Boolean);
  if (terms.length === 0) return <>{text}</>;
  const escaped = terms
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded bg-accent-soft px-0.5 text-ink ring-1 ring-accent/40"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
