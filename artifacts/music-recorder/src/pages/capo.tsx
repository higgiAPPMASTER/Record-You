import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChordDiagramSVG } from "@/components/chord-diagram";
import { CHORDS } from "@/lib/chords";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_LABELS: Record<string, string> = {
  "C#": "C#/Db", "D#": "D#/Eb", "F#": "F#/Gb", "G#": "G#/Ab", "A#": "A#/Bb",
};

function transposeNote(note: string, semitones: number): string {
  const idx = NOTES.indexOf(note);
  if (idx === -1) return note;
  return NOTES[((idx + semitones) % 12 + 12) % 12];
}

// Open chord shapes guitarists commonly use (root note of the shape)
const OPEN_SHAPES = [
  { key: "C", label: "C shape", quality: "major" },
  { key: "D", label: "D shape", quality: "major" },
  { key: "E", label: "E shape", quality: "major" },
  { key: "G", label: "G shape", quality: "major" },
  { key: "A", label: "A shape", quality: "major" },
  { key: "Am", label: "Am shape", quality: "minor", root: "A" },
  { key: "Em", label: "Em shape", quality: "minor", root: "E" },
  { key: "Dm", label: "Dm shape", quality: "minor", root: "D" },
];

function shapeRoot(shape: typeof OPEN_SHAPES[0]) {
  return shape.root ?? shape.key;
}

function soundingKey(shapeKey: string, capo: number): string {
  const root = shapeKey.replace(/m$/, "");
  const isMinor = shapeKey.endsWith("m") && shapeKey.length > 1;
  const newRoot = transposeNote(root, capo);
  return isMinor ? `${newRoot}m` : newRoot;
}

function KeyBadge({ note, large }: { note: string; large?: boolean }) {
  const isSharp = note.includes("#");
  return (
    <span className={cn(
      "inline-flex items-center justify-center font-bold font-mono rounded-md",
      "bg-primary/10 text-primary border border-primary/20",
      large ? "px-3 py-1.5 text-lg min-w-[3rem]" : "px-2 py-0.5 text-xs min-w-[2.5rem]"
    )}>
      {NOTE_LABELS[note.replace("m", "")] ? (
        <span>{note.replace(/([#b])/, "$1").replace("m", "")}
          {note.endsWith("m") ? "m" : ""}
          <span className="text-[0.6em] text-primary/70 block leading-none">
            {NOTE_LABELS[note.replace("m", "")]?.split("/")[1]}{note.endsWith("m") ? "m" : ""}
          </span>
        </span>
      ) : note}
    </span>
  );
}

type Mode = "find-capo" | "find-key";

export default function Capo() {
  const [mode, setMode] = useState<Mode>("find-capo");

  // Mode 1: find capo — user picks desired sounding key
  const [desiredKey, setDesiredKey] = useState("G");
  const [preferredQuality, setPreferredQuality] = useState<"major" | "minor">("major");

  // Mode 2: find sounding key — user picks capo + shape
  const [capoFret, setCapoFret] = useState(2);
  const [playingShape, setPlayingShape] = useState("D");

  // Table reference
  const [tableQuality, setTableQuality] = useState<"major" | "minor">("major");

  // --- Mode 1 results ---
  const majorShapes = OPEN_SHAPES.filter((s) => s.quality === "major");
  const minorShapes = OPEN_SHAPES.filter((s) => s.quality === "minor");
  const shapes = preferredQuality === "major" ? majorShapes : minorShapes;

  const capoResults = shapes.map((shape) => {
    const root = shapeRoot(shape);
    // Find which capo makes this shape sound like desiredKey
    const desiredRoot = desiredKey.replace(/m$/, "");
    const shapeIsMinor = shape.quality === "minor";
    const desiredIsMinor = desiredKey.endsWith("m");
    if (shapeIsMinor !== desiredIsMinor) return null;
    const shapeIdx = NOTES.indexOf(root);
    const desiredIdx = NOTES.indexOf(desiredRoot);
    const capo = ((desiredIdx - shapeIdx) + 12) % 12;
    if (capo > 9) return null; // Impractical above 9th fret
    const sounding = soundingKey(shape.key, capo);
    const chord = CHORDS.find((c) => c.full === shape.key);
    return { shape, capo, sounding, chord };
  }).filter(Boolean) as { shape: typeof OPEN_SHAPES[0]; capo: number; sounding: string; chord: typeof CHORDS[0] | undefined }[];

  // --- Mode 2 result ---
  const mode2Result = soundingKey(playingShape, capoFret);
  const mode2Chord = CHORDS.find((c) => c.full === playingShape);

  // --- Table data ---
  const tableShapes = tableQuality === "major" ? majorShapes : minorShapes;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎸</span>
          <h1 className="text-3xl font-bold tracking-tight">Capo Calculator</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Find the right capo position for any key, or discover what key you're playing in.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-8 border-b border-border">
        {([
          ["find-capo", "Find capo position"],
          ["find-key", "Find sounding key"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              mode === m
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Mode 1: Find capo ── */}
      {mode === "find-capo" && (
        <div className="mb-12">
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">
                I want to sound in key
              </label>
              <div className="flex flex-wrap gap-1.5">
                {NOTES.map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setDesiredKey(preferredQuality === "minor" ? `${n}m` : n);
                    }}
                    className={cn(
                      "text-xs font-mono px-2.5 py-1.5 rounded-md border transition-colors",
                      (desiredKey === n || desiredKey === `${n}m`)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {NOTE_LABELS[n] ?? n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">
                Quality
              </label>
              <div className="flex gap-1.5">
                {(["major", "minor"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setPreferredQuality(q);
                      const root = desiredKey.replace(/m$/, "");
                      setDesiredKey(q === "minor" ? `${root}m` : root);
                    }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-md border transition-colors capitalize",
                      preferredQuality === q
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {capoResults.length === 0 ? (
            <p className="text-muted-foreground text-sm">No practical capo positions found for this key and quality.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Ways to play <span className="text-foreground font-semibold">{desiredKey}</span> with open chord shapes:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {capoResults.map(({ shape, capo, chord }) => (
                  <div
                    key={shape.key}
                    className={cn(
                      "border rounded-xl p-4 flex flex-col items-center gap-3 bg-card",
                      capo === 0 ? "border-primary/40" : "border-border/60"
                    )}
                  >
                    {/* Capo badge */}
                    <div className={cn(
                      "w-full text-center text-xs font-semibold rounded-md py-1",
                      capo === 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground"
                    )}>
                      {capo === 0 ? "No capo" : `Capo fret ${capo}`}
                    </div>

                    {/* Chord diagram */}
                    {chord ? (
                      <ChordDiagramSVG chord={chord} size={0.9} />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-muted-foreground text-xs">
                        {shape.label}
                      </div>
                    )}

                    {/* Shape label */}
                    <div className="text-center">
                      <p className="text-sm font-semibold font-mono">{shape.key} shape</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        sounds like <span className="text-primary font-mono">{desiredKey}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Mode 2: Find sounding key ── */}
      {mode === "find-key" && (
        <div className="mb-12">
          <div className="flex flex-wrap items-start gap-8 mb-8">
            {/* Capo fret picker */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">
                Capo on fret
              </label>
              <div className="flex flex-wrap gap-1.5 max-w-xs">
                {Array.from({ length: 10 }, (_, i) => i).map((f) => (
                  <button
                    key={f}
                    onClick={() => setCapoFret(f)}
                    className={cn(
                      "w-9 h-9 text-sm font-mono rounded-md border transition-colors",
                      capoFret === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {f === 0 ? "—" : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Shape picker */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">
                Playing shapes in key
              </label>
              <div className="flex flex-wrap gap-1.5">
                {OPEN_SHAPES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setPlayingShape(s.key)}
                    className={cn(
                      "text-sm font-mono px-3 py-1.5 rounded-md border transition-colors",
                      playingShape === s.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {s.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="flex items-center gap-6 p-6 rounded-2xl border border-primary/20 bg-primary/5 max-w-md">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Sounding key</p>
              <p className="text-4xl font-bold font-mono text-primary">{mode2Result}</p>
              <p className="text-xs text-muted-foreground">
                {capoFret === 0
                  ? `No capo — playing open ${playingShape} shapes`
                  : `Capo fret ${capoFret} + ${playingShape} shapes`}
              </p>
            </div>
            {mode2Chord && (
              <div className="flex-shrink-0">
                <p className="text-[10px] text-muted-foreground text-center mb-1">{playingShape} shape</p>
                <ChordDiagramSVG chord={mode2Chord} size={1} />
              </div>
            )}
          </div>

          {/* Extra: all chords in the key */}
          <div className="mt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Common chord shapes → sounding chords with capo {capoFret}
            </p>
            <div className="flex flex-wrap gap-2">
              {OPEN_SHAPES.map((s) => {
                const sounding = soundingKey(s.key, capoFret);
                return (
                  <div key={s.key} className="flex items-center gap-1.5 text-xs border border-border/50 rounded-lg px-3 py-2 bg-card">
                    <span className="font-mono text-muted-foreground">{s.key}</span>
                    <span className="text-muted-foreground/40">→</span>
                    <span className="font-mono font-semibold text-primary">{sounding}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Reference Table ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Full Reference Table
          </h2>
          <div className="flex gap-1">
            {(["major", "minor"] as const).map((q) => (
              <button
                key={q}
                onClick={() => setTableQuality(q)}
                className={cn(
                  "text-xs px-3 py-1 rounded-md border transition-colors capitalize",
                  tableQuality === q
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Shape</th>
                {Array.from({ length: 10 }, (_, i) => i).map((f) => (
                  <th key={f} className="px-3 py-2.5 text-muted-foreground font-semibold text-center">
                    {f === 0 ? "Open" : `Fr.${f}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableShapes.map((shape, i) => (
                <tr
                  key={shape.key}
                  className={cn(
                    "border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20",
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  )}
                >
                  <td className="px-4 py-2.5 font-semibold text-foreground">{shape.label}</td>
                  {Array.from({ length: 10 }, (_, f) => {
                    const sounding = soundingKey(shape.key, f);
                    const isHighlighted =
                      (mode === "find-capo" && sounding === desiredKey) ||
                      (mode === "find-key" && f === capoFret && shape.key === playingShape);
                    return (
                      <td key={f} className="px-3 py-2.5 text-center">
                        <span className={cn(
                          "inline-block px-1.5 py-0.5 rounded transition-colors",
                          isHighlighted
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-muted-foreground"
                        )}>
                          {sounding}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Highlighted cells match your current selection above.
        </p>
      </div>
    </div>
  );
}
