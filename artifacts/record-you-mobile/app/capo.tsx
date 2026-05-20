import { ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CHORDS, ChordDiagram } from "@/constants/chords";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_LABELS: Record<string, string> = {
  "C#": "C#/Db", "D#": "D#/Eb", "F#": "F#/Gb", "G#": "G#/Ab", "A#": "A#/Bb",
};

const OPEN_SHAPES = [
  { key: "C",  label: "C shape", quality: "major" as const },
  { key: "D",  label: "D shape", quality: "major" as const },
  { key: "E",  label: "E shape", quality: "major" as const },
  { key: "G",  label: "G shape", quality: "major" as const },
  { key: "A",  label: "A shape", quality: "major" as const },
  { key: "Am", label: "Am shape", quality: "minor" as const, root: "A" },
  { key: "Em", label: "Em shape", quality: "minor" as const, root: "E" },
  { key: "Dm", label: "Dm shape", quality: "minor" as const, root: "D" },
];

function shapeRoot(shape: typeof OPEN_SHAPES[0]) {
  return (shape as any).root ?? shape.key;
}

function transposeNote(note: string, semitones: number): string {
  const idx = NOTES.indexOf(note);
  if (idx === -1) return note;
  return NOTES[((idx + semitones) % 12 + 12) % 12];
}

function soundingKey(shapeKey: string, capo: number): string {
  const root = shapeKey.replace(/m$/, "");
  const isMinor = shapeKey.endsWith("m") && shapeKey.length > 1;
  const newRoot = transposeNote(root, capo);
  return isMinor ? `${newRoot}m` : newRoot;
}

function MiniDiagram({ chord, colors }: { chord: ChordDiagram; colors: ReturnType<typeof useColors> }) {
  const sz = 72;
  const STRINGS = 6;
  const FRETS = 4;
  const leftPad = sz * 0.14;
  const topPad = sz * 0.26;
  const strGap = (sz - leftPad * 2) / (STRINGS - 1);
  const fretGap = (sz * 0.85 - topPad) / FRETS;
  const dotR = strGap * 0.3;
  const totalH = topPad + fretGap * FRETS + sz * 0.05;

  const strX = (i: number) => leftPad + i * strGap;
  const fretY = (f: number) => topPad + f * fretGap;
  const relPos = (p: number) => p <= 0 ? p : p - chord.baseFret + 1;
  const dotCY = (rf: number) => fretY(rf - 1) + fretGap / 2;

  return (
    <Svg width={sz} height={totalH}>
      {chord.baseFret > 1 && (
        <SvgText x={leftPad - 3} y={topPad + fretGap * 0.6} fontSize={sz * 0.09} fill={colors.mutedForeground} textAnchor="end">{chord.baseFret}fr</SvgText>
      )}
      {chord.baseFret === 1 && (
        <Rect x={leftPad - 1} y={topPad - sz * 0.04} width={(STRINGS - 1) * strGap + 2} height={sz * 0.04} rx={1} fill={colors.foreground} />
      )}
      {Array.from({ length: FRETS + 1 }).map((_, i) => (
        <Line key={`f${i}`} x1={leftPad} y1={fretY(i)} x2={leftPad + (STRINGS - 1) * strGap} y2={fretY(i)} stroke={colors.border} strokeWidth={0.7} />
      ))}
      {Array.from({ length: STRINGS }).map((_, i) => (
        <Line key={`s${i}`} x1={strX(i)} y1={topPad} x2={strX(i)} y2={fretY(FRETS)} stroke={colors.border} strokeWidth={0.7} />
      ))}
      {chord.barre && (() => {
        const rf = relPos(chord.barre.fret);
        if (rf < 1 || rf > FRETS) return null;
        return <Rect x={strX(chord.barre.from)} y={dotCY(rf) - dotR} width={strX(chord.barre.to) - strX(chord.barre.from)} height={dotR * 2} rx={dotR} fill={colors.primary} />;
      })()}
      {chord.positions.map((p, i) => {
        const rf = relPos(p);
        if (rf < 1 || rf > FRETS) return null;
        return <Circle key={`d${i}`} cx={strX(i)} cy={dotCY(rf)} r={dotR} fill={colors.primary} />;
      })}
      {chord.positions.map((p, i) => {
        const y = topPad - sz * 0.13;
        if (p === -1) return <SvgText key={`m${i}`} x={strX(i)} y={y} fontSize={sz * 0.14} fill={colors.mutedForeground} textAnchor="middle">×</SvgText>;
        if (p === 0) return <Circle key={`m${i}`} cx={strX(i)} cy={y - sz * 0.04} r={sz * 0.055} stroke={colors.mutedForeground} strokeWidth={0.8} fill="none" />;
        return null;
      })}
    </Svg>
  );
}

type Mode = "find-capo" | "find-key";

export default function CapoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("find-capo");
  const [desiredKey, setDesiredKey] = useState("G");
  const [preferredQuality, setPreferredQuality] = useState<"major" | "minor">("major");
  const [capoFret, setCapoFret] = useState(2);
  const [playingShape, setPlayingShape] = useState("D");

  const majorShapes = OPEN_SHAPES.filter((s) => s.quality === "major");
  const minorShapes = OPEN_SHAPES.filter((s) => s.quality === "minor");
  const shapes = preferredQuality === "major" ? majorShapes : minorShapes;

  const capoResults = shapes.map((shape) => {
    const root = shapeRoot(shape);
    const desiredRoot = desiredKey.replace(/m$/, "");
    const shapeIsMinor = shape.quality === "minor";
    const desiredIsMinor = desiredKey.endsWith("m");
    if (shapeIsMinor !== desiredIsMinor) return null;
    const shapeIdx = NOTES.indexOf(root);
    const desiredIdx = NOTES.indexOf(desiredRoot);
    const capo = ((desiredIdx - shapeIdx) + 12) % 12;
    if (capo > 9) return null;
    const sounding = soundingKey(shape.key, capo);
    const chord = CHORDS.find((c) => c.full === shape.key);
    return { shape, capo, sounding, chord };
  }).filter(Boolean) as { shape: typeof OPEN_SHAPES[0]; capo: number; sounding: string; chord: ChordDiagram | undefined }[];

  const mode2Result = soundingKey(playingShape, capoFret);
  const mode2Chord = CHORDS.find((c) => c.full === playingShape);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 20 : insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, marginBottom: 0 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    tabs: { flexDirection: "row" as const, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center" as const },
    tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    section: { padding: 16, gap: 12 },
    sectionLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 },
    pillRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
    pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    pillText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    resultGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10, paddingHorizontal: 16, paddingBottom: 32 },
    resultCard: {
      width: "46%" as any,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      alignItems: "center" as const,
      gap: 6,
    },
    capoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, width: "100%" as any, alignItems: "center" as const },
    capoBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
    shapeLabel: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    shapeSub: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" as const },
    resultBox: {
      margin: 16,
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primary + "33",
      backgroundColor: colors.primary + "0a",
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 20,
    },
    resultKey: { fontSize: 48, fontWeight: "700" as const, color: colors.primary, fontFamily: "Inter_700Bold" },
    resultSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    mappingRow: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      gap: 8,
    },
    mappingLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 4 },
    mappingPills: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
    mappingPill: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    mappingFrom: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    mappingArrow: { fontSize: 12, color: colors.mutedForeground + "88" },
    mappingTo: { fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const, color: colors.primary },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Capo Calculator</Text>
        </View>
      </View>

      {/* Mode tabs */}
      <View style={styles.tabs}>
        {(["find-capo", "find-key"] as Mode[]).map((m) => (
          <Pressable key={m} style={[styles.tab, { borderBottomWidth: 2, borderBottomColor: mode === m ? colors.primary : "transparent" }]} onPress={() => setMode(m)}>
            <Text style={[styles.tabText, { color: mode === m ? colors.primary : colors.mutedForeground }]}>
              {m === "find-capo" ? "Find Capo" : "Find Key"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView>
        {mode === "find-capo" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>I want to sound in key</Text>
              <View style={styles.pillRow}>
                {NOTES.map((n) => {
                  const isActive = desiredKey === n || desiredKey === `${n}m`;
                  return (
                    <Pressable
                      key={n}
                      style={[styles.pill, { backgroundColor: isActive ? colors.primary : "transparent", borderColor: isActive ? colors.primary : colors.border }]}
                      onPress={() => setDesiredKey(preferredQuality === "minor" ? `${n}m` : n)}
                    >
                      <Text style={[styles.pillText, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>{NOTE_LABELS[n] ?? n}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Quality</Text>
              <View style={styles.pillRow}>
                {(["major", "minor"] as const).map((q) => (
                  <Pressable
                    key={q}
                    style={[styles.pill, { backgroundColor: preferredQuality === q ? colors.primary : "transparent", borderColor: preferredQuality === q ? colors.primary : colors.border }]}
                    onPress={() => {
                      setPreferredQuality(q);
                      const root = desiredKey.replace(/m$/, "");
                      setDesiredKey(q === "minor" ? `${root}m` : root);
                    }}
                  >
                    <Text style={[styles.pillText, { color: preferredQuality === q ? colors.primaryForeground : colors.mutedForeground, textTransform: "capitalize" }]}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.resultGrid}>
              {capoResults.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", padding: 8 }}>No practical positions found.</Text>
              ) : capoResults.map(({ shape, capo, chord }) => (
                <View key={shape.key} style={[styles.resultCard, { borderColor: capo === 0 ? colors.primary + "55" : colors.border }]}>
                  <View style={[styles.capoBadge, { backgroundColor: capo === 0 ? colors.primary + "22" : colors.muted }]}>
                    <Text style={[styles.capoBadgeText, { color: capo === 0 ? colors.primary : colors.mutedForeground }]}>
                      {capo === 0 ? "No capo" : `Capo fret ${capo}`}
                    </Text>
                  </View>
                  {chord ? <MiniDiagram chord={chord} colors={colors} /> : null}
                  <Text style={styles.shapeLabel}>{shape.key} shape</Text>
                  <Text style={styles.shapeSub}>sounds like <Text style={{ color: colors.primary }}>{desiredKey}</Text></Text>
                </View>
              ))}
            </View>
          </>
        )}

        {mode === "find-key" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Capo on fret</Text>
              <View style={styles.pillRow}>
                {Array.from({ length: 10 }, (_, i) => i).map((f) => (
                  <Pressable
                    key={f}
                    style={[styles.pill, { backgroundColor: capoFret === f ? colors.primary : "transparent", borderColor: capoFret === f ? colors.primary : colors.border, minWidth: 40, alignItems: "center" }]}
                    onPress={() => setCapoFret(f)}
                  >
                    <Text style={[styles.pillText, { color: capoFret === f ? colors.primaryForeground : colors.mutedForeground }]}>{f === 0 ? "—" : f}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Playing shapes in key</Text>
              <View style={styles.pillRow}>
                {OPEN_SHAPES.map((s) => (
                  <Pressable
                    key={s.key}
                    style={[styles.pill, { backgroundColor: playingShape === s.key ? colors.primary : "transparent", borderColor: playingShape === s.key ? colors.primary : colors.border }]}
                    onPress={() => setPlayingShape(s.key)}
                  >
                    <Text style={[styles.pillText, { color: playingShape === s.key ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{s.key}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.resultBox}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 }}>Sounding key</Text>
                <Text style={styles.resultKey}>{mode2Result}</Text>
                <Text style={styles.resultSub}>
                  {capoFret === 0 ? `No capo — open ${playingShape} shapes` : `Capo fret ${capoFret} + ${playingShape} shapes`}
                </Text>
              </View>
              {mode2Chord && <MiniDiagram chord={mode2Chord} colors={colors} />}
            </View>

            <View style={styles.mappingRow}>
              <Text style={styles.mappingLabel}>All shapes → sounding keys (capo {capoFret})</Text>
              <View style={styles.mappingPills}>
                {OPEN_SHAPES.map((s) => {
                  const sounding = soundingKey(s.key, capoFret);
                  return (
                    <View key={s.key} style={styles.mappingPill}>
                      <Text style={styles.mappingFrom}>{s.key}</Text>
                      <Text style={styles.mappingArrow}>→</Text>
                      <Text style={styles.mappingTo}>{sounding}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
