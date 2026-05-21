import React from "react";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";

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

export function ChordDiagramSVG({
  chord,
  size = 1,
  primary = "#FDB827",
  primaryFg = "#000",
  fg = "#fff",
  border = "#3a3a3a",
  muted = "#888",
}: {
  chord: ChordDiagram;
  size?: number;
  primary?: string;
  primaryFg?: string;
  fg?: string;
  border?: string;
  muted?: string;
}) {
  const w = WIDTH * size;
  const h = HEIGHT * size;
  const showFretLabel = chord.baseFret > 1;

  const sx = (i: number) => MARGIN_LEFT + i * STRING_GAP;
  const fy = (fret: number) => MARGIN_TOP + (fret - chord.baseFret) * FRET_GAP + FRET_GAP / 2;

  return (
    <Svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={w} height={h}>
      {!showFretLabel ? (
        <Rect
          x={MARGIN_LEFT - 1}
          y={MARGIN_TOP - 4}
          width={(STRINGS - 1) * STRING_GAP + 2}
          height={4}
          rx={2}
          fill={fg}
          opacity={0.8}
        />
      ) : (
        <SvgText
          x={MARGIN_LEFT - 8}
          y={MARGIN_TOP + FRET_GAP / 2 + 4}
          textAnchor="end"
          fontSize={9}
          fill={muted}
        >
          {`${chord.baseFret}fr`}
        </SvgText>
      )}

      {Array.from({ length: FRETS }).map((_, i) => (
        <Line
          key={`fret-${i}`}
          x1={MARGIN_LEFT}
          y1={MARGIN_TOP + i * FRET_GAP}
          x2={MARGIN_LEFT + (STRINGS - 1) * STRING_GAP}
          y2={MARGIN_TOP + i * FRET_GAP}
          stroke={border}
          strokeWidth={1.2}
        />
      ))}
      <Line
        x1={MARGIN_LEFT}
        y1={MARGIN_TOP + FRETS * FRET_GAP}
        x2={MARGIN_LEFT + (STRINGS - 1) * STRING_GAP}
        y2={MARGIN_TOP + FRETS * FRET_GAP}
        stroke={border}
        strokeWidth={1.2}
      />
      {Array.from({ length: STRINGS }).map((_, i) => (
        <Line
          key={`str-${i}`}
          x1={sx(i)}
          y1={MARGIN_TOP}
          x2={sx(i)}
          y2={MARGIN_TOP + FRETS * FRET_GAP}
          stroke={muted}
          strokeWidth={0.8}
          opacity={0.5}
        />
      ))}

      {chord.barre && (
        <Rect
          x={sx(chord.barre.from) - DOT_R}
          y={fy(chord.barre.fret) - DOT_R}
          width={sx(chord.barre.to) - sx(chord.barre.from) + DOT_R * 2}
          height={DOT_R * 2}
          rx={DOT_R}
          fill={primary}
          opacity={0.9}
        />
      )}

      {chord.positions.map((pos, idx) => {
        if (pos <= 0) return null;
        const x = sx(idx);
        const y = fy(pos);
        const finger = chord.fingers[idx] ?? 0;
        const isBarre =
          chord.barre &&
          pos === chord.barre.fret &&
          idx >= chord.barre.from &&
          idx <= chord.barre.to;
        if (isBarre) return null;
        return (
          <G key={`dot-${idx}`}>
            <Circle cx={x} cy={y} r={DOT_R} fill={primary} />
            {finger > 0 && (
              <SvgText
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                fontSize={8}
                fontWeight="bold"
                fill={primaryFg}
              >
                {String(finger)}
              </SvgText>
            )}
          </G>
        );
      })}

      {chord.positions.map((pos, idx) => {
        const x = sx(idx);
        const y = MARGIN_TOP - 12;
        if (pos === 0) {
          return (
            <Circle key={`open-${idx}`} cx={x} cy={y} r={4} fill="none" stroke={muted} strokeWidth={1.2} />
          );
        }
        if (pos === -1) {
          return (
            <G key={`mute-${idx}`}>
              <Line x1={x - 3.5} y1={y - 3.5} x2={x + 3.5} y2={y + 3.5} stroke={muted} strokeWidth={1.2} />
              <Line x1={x + 3.5} y1={y - 3.5} x2={x - 3.5} y2={y + 3.5} stroke={muted} strokeWidth={1.2} />
            </G>
          );
        }
        return null;
      })}
    </Svg>
  );
}
