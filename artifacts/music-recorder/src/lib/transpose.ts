const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B",
};

function normalizeNote(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

function shiftNote(note: string, semitones: number): string {
  const normalized = normalizeNote(note);
  const idx = NOTES_SHARP.indexOf(normalized);
  if (idx === -1) return note;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return NOTES_SHARP[newIdx];
}

function transposeChordToken(chord: string, semitones: number): string {
  if (semitones === 0) return chord;
  const m = chord.match(/^([A-G][#b]?)(.*)$/s);
  if (!m) return chord;
  const [, root, quality] = m;
  return shiftNote(root, semitones) + quality;
}

// Matches chord tokens at word boundaries.
// Quality suffixes ordered longest-first to avoid partial matches.
const CHORD_TOKEN_RE =
  /\b([A-G][#b]?(?:maj7|maj|min|m7|m9|sus4|sus2|sus|add9|add|dim|aug|m|7|9|11|13)?)\b(?![a-z])/g;

/**
 * Transpose all chord names in a block of tab text by `semitones`.
 * Tab lines (e|---) are left unchanged.
 */
export function transposeText(text: string, semitones: number): string {
  if (semitones === 0) return text;
  const lines = text.split("\n");
  return lines
    .map((line) => {
      // Don't touch actual tab lines (e|---, B|---, etc.)
      if (/^[EADGBe]\|/.test(line.trim())) return line;
      return line.replace(CHORD_TOKEN_RE, (match) => transposeChordToken(match, semitones));
    })
    .join("\n");
}

/** Return the key label for a semitone offset, e.g. +3 → "+3 semitones" */
export function semitoneLabel(n: number): string {
  if (n === 0) return "Original key";
  return `${n > 0 ? "+" : ""}${n} semitone${Math.abs(n) === 1 ? "" : "s"}`;
}
