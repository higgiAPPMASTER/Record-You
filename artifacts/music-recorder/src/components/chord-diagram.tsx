import type { ChordDiagram } from "@/lib/chords";

const STRINGS = 6;
const FRETS = 5;
const STRING_GAP = 22;
const FRET_GAP = 20;
const MARGIN_LEFT = 24;
const MARGIN_TOP = 28;
const DOT_R = 7;

const WIDTH = MARGIN_LEFT + (STRINGS - 1) * STRING_GAP + 18;
const HEIGHT = MARGIN_TOP + FRETS * FRET_GAP + 12;

const FINGER_COLORS = [
  "transparent",
  "hsl(var(--primary))",
  "hsl(var(--primary))",
  "hsl(var(--primary))",
  "hsl(var(--primary))",
];

export function ChordDiagramSVG({ chord, size = 1 }: { chord: ChordDiagram; size?: number }) {
  const w = WIDTH * size;
  const h = HEIGHT * size;

  // Normalize positions so they start at fret 1 within the diagram window
  const minFret = Math.min(
    ...chord.positions.filter((p) => p > 0),
    chord.baseFret
  );
  const offset = chord.baseFret - 1;
  const showFretLabel = chord.baseFret > 1;

  const sx = (stringIdx: number) => MARGIN_LEFT + stringIdx * STRING_GAP;
  const fy = (fret: number) => MARGIN_TOP + (fret - chord.baseFret) * FRET_GAP + FRET_GAP / 2;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={w}
      height={h}
      aria-label={chord.full}
      style={{ display: "block" }}
    >
      {/* Nut or fret position label */}
      {!showFretLabel ? (
        <rect
          x={MARGIN_LEFT - 1}
          y={MARGIN_TOP - 4}
          width={(STRINGS - 1) * STRING_GAP + 2}
          height={4}
          rx={2}
          fill="hsl(var(--foreground))"
          opacity={0.8}
        />
      ) : (
        <text
          x={MARGIN_LEFT - 8}
          y={MARGIN_TOP + FRET_GAP / 2 + 4}
          textAnchor="end"
          fontSize={9}
          fill="hsl(var(--muted-foreground))"
        >
          {chord.baseFret}fr
        </text>
      )}

      {/* Horizontal fret lines */}
      {Array.from({ length: FRETS }).map((_, i) => (
        <line
          key={i}
          x1={MARGIN_LEFT}
          y1={MARGIN_TOP + i * FRET_GAP}
          x2={MARGIN_LEFT + (STRINGS - 1) * STRING_GAP}
          y2={MARGIN_TOP + i * FRET_GAP}
          stroke="hsl(var(--border))"
          strokeWidth={1.2}
        />
      ))}
      {/* bottom line */}
      <line
        x1={MARGIN_LEFT}
        y1={MARGIN_TOP + FRETS * FRET_GAP}
        x2={MARGIN_LEFT + (STRINGS - 1) * STRING_GAP}
        y2={MARGIN_TOP + FRETS * FRET_GAP}
        stroke="hsl(var(--border))"
        strokeWidth={1.2}
      />

      {/* Vertical string lines */}
      {Array.from({ length: STRINGS }).map((_, i) => (
        <line
          key={i}
          x1={sx(i)}
          y1={MARGIN_TOP}
          x2={sx(i)}
          y2={MARGIN_TOP + FRETS * FRET_GAP}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={0.8}
          opacity={0.5}
        />
      ))}

      {/* Barre */}
      {chord.barre && (
        <rect
          x={sx(chord.barre.from) - DOT_R}
          y={fy(chord.barre.fret) - DOT_R}
          width={sx(chord.barre.to) - sx(chord.barre.from) + DOT_R * 2}
          height={DOT_R * 2}
          rx={DOT_R}
          fill="hsl(var(--primary))"
          opacity={0.9}
        />
      )}

      {/* Finger dots */}
      {chord.positions.map((pos, stringIdx) => {
        if (pos <= 0) return null;
        const x = sx(stringIdx);
        const y = fy(pos);
        const finger = chord.fingers[stringIdx] ?? 0;
        const isPartOfBarre =
          chord.barre &&
          pos === chord.barre.fret &&
          stringIdx >= chord.barre.from &&
          stringIdx <= chord.barre.to;

        if (isPartOfBarre) return null;

        return (
          <g key={stringIdx}>
            <circle cx={x} cy={y} r={DOT_R} fill="hsl(var(--primary))" />
            {finger > 0 && (
              <text
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                fontSize={8}
                fontWeight="bold"
                fill="hsl(var(--primary-foreground))"
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}

      {/* Open / Muted indicators */}
      {chord.positions.map((pos, stringIdx) => {
        const x = sx(stringIdx);
        const y = MARGIN_TOP - 12;
        if (pos === 0) {
          return (
            <circle
              key={stringIdx}
              cx={x}
              cy={y}
              r={4}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.2}
            />
          );
        }
        if (pos === -1) {
          return (
            <g key={stringIdx}>
              <line x1={x - 3.5} y1={y - 3.5} x2={x + 3.5} y2={y + 3.5} stroke="hsl(var(--muted-foreground))" strokeWidth={1.2} />
              <line x1={x + 3.5} y1={y - 3.5} x2={x - 3.5} y2={y + 3.5} stroke="hsl(var(--muted-foreground))" strokeWidth={1.2} />
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}
