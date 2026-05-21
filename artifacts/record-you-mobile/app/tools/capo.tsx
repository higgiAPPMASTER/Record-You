import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ChordDiagramSVG } from "@/components/ChordDiagram";
import { useColors } from "@/hooks/useColors";
import { CHORDS } from "@/lib/chords";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const OPEN_SHAPES = [
  { key: "C", quality: "major" },
  { key: "D", quality: "major" },
  { key: "E", quality: "major" },
  { key: "G", quality: "major" },
  { key: "A", quality: "major" },
  { key: "Am", quality: "minor" },
  { key: "Em", quality: "minor" },
  { key: "Dm", quality: "minor" },
];

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

export default function CapoScreen() {
  const colors = useColors();
  const [mode, setMode] = useState<"find-capo" | "find-key">("find-capo");
  const [desiredKey, setDesiredKey] = useState("G");
  const [preferredQuality, setPreferredQuality] = useState<"major" | "minor">("major");
  const [capoFret, setCapoFret] = useState(2);
  const [playingShape, setPlayingShape] = useState("D");

  const shapes = OPEN_SHAPES.filter((s) => s.quality === preferredQuality);

  const capoResults = shapes
    .map((shape) => {
      const root = shape.key.replace(/m$/, "");
      const desiredRoot = desiredKey.replace(/m$/, "");
      const shapeIdx = NOTES.indexOf(root);
      const desiredIdx = NOTES.indexOf(desiredRoot);
      const capo = (((desiredIdx - shapeIdx) % 12) + 12) % 12;
      if (capo > 9) return null;
      const chord = CHORDS.find((c) => c.full === shape.key);
      return { shape, capo, chord };
    })
    .filter(Boolean) as { shape: typeof OPEN_SHAPES[0]; capo: number; chord: any }[];

  const mode2Result = soundingKey(playingShape, capoFret);
  const mode2Chord = CHORDS.find((c) => c.full === playingShape);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 40 },
    modeRow: { flexDirection: "row", marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modeBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
    modeBtnActive: { borderBottomColor: colors.primary },
    modeText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 },
    modeTextActive: { color: colors.primary, fontWeight: "600" },
    label: { fontSize: 11, color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Inter_600SemiBold" },
    section: { marginBottom: 20 },
    pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    pillTextActive: { color: "#000", fontWeight: "700" },
    resultGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
    resultCard: {
      width: "48%",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 12,
      margin: "1%",
      alignItems: "center",
      gap: 8,
    },
    capoBadge: {
      width: "100%",
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.muted,
      alignItems: "center",
    },
    capoBadgeActive: { backgroundColor: colors.primary + "20" },
    capoBadgeText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
    capoBadgeTextActive: { color: colors.primary },
    shapeLabel: { fontSize: 12, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    soundsLike: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    soundsKey: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    bigResult: {
      backgroundColor: colors.primary + "10",
      borderWidth: 1,
      borderColor: colors.primary + "40",
      borderRadius: 16,
      padding: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    bigResultKey: { fontSize: 40, color: colors.primary, fontFamily: "Inter_700Bold", fontWeight: "700" },
    bigResultLabel: { fontSize: 10, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Inter_600SemiBold" },
    fretRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    fretBtn: {
      width: 40,
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    fretBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    fretText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    fretTextActive: { color: "#000", fontWeight: "700" },
  });

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll}>
      <View style={s.modeRow}>
        {(["find-capo", "find-key"] as const).map((m) => (
          <Pressable key={m} style={[s.modeBtn, mode === m && s.modeBtnActive]} onPress={() => setMode(m)}>
            <Text style={[s.modeText, mode === m && s.modeTextActive]}>
              {m === "find-capo" ? "Find capo" : "Find key"}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "find-capo" && (
        <>
          <View style={s.section}>
            <Text style={s.label}>Sound in key</Text>
            <View style={s.pillRow}>
              {NOTES.map((n) => {
                const selectedRoot = desiredKey.replace(/m$/, "");
                return (
                  <Pressable
                    key={n}
                    style={[s.pill, selectedRoot === n && s.pillActive]}
                    onPress={() => setDesiredKey(preferredQuality === "minor" ? `${n}m` : n)}
                  >
                    <Text style={[s.pillText, selectedRoot === n && s.pillTextActive]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.label}>Quality</Text>
            <View style={s.pillRow}>
              {(["major", "minor"] as const).map((q) => (
                <Pressable
                  key={q}
                  style={[s.pill, preferredQuality === q && s.pillActive]}
                  onPress={() => {
                    setPreferredQuality(q);
                    const root = desiredKey.replace(/m$/, "");
                    setDesiredKey(q === "minor" ? `${root}m` : root);
                  }}
                >
                  <Text style={[s.pillText, preferredQuality === q && s.pillTextActive]}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={s.label}>Ways to play {desiredKey}</Text>
          <View style={s.resultGrid}>
            {capoResults.map(({ shape, capo, chord }) => (
              <View key={shape.key} style={s.resultCard}>
                <View style={[s.capoBadge, capo === 0 && s.capoBadgeActive]}>
                  <Text style={[s.capoBadgeText, capo === 0 && s.capoBadgeTextActive]}>
                    {capo === 0 ? "No capo" : `Capo fret ${capo}`}
                  </Text>
                </View>
                {chord && (
                  <ChordDiagramSVG
                    chord={chord}
                    size={0.85}
                    primary={colors.primary}
                    fg={colors.foreground}
                    border={colors.border}
                    muted={colors.mutedForeground}
                  />
                )}
                <Text style={s.shapeLabel}>{shape.key} shape</Text>
                <Text style={s.soundsLike}>
                  sounds like <Text style={s.soundsKey}>{desiredKey}</Text>
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {mode === "find-key" && (
        <>
          <View style={s.section}>
            <Text style={s.label}>Capo on fret</Text>
            <View style={s.fretRow}>
              {Array.from({ length: 10 }, (_, i) => i).map((f) => (
                <Pressable
                  key={f}
                  style={[s.fretBtn, capoFret === f && s.fretBtnActive]}
                  onPress={() => setCapoFret(f)}
                >
                  <Text style={[s.fretText, capoFret === f && s.fretTextActive]}>
                    {f === 0 ? "—" : f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.label}>Playing shape</Text>
            <View style={s.pillRow}>
              {OPEN_SHAPES.map((sh) => (
                <Pressable
                  key={sh.key}
                  style={[s.pill, playingShape === sh.key && s.pillActive]}
                  onPress={() => setPlayingShape(sh.key)}
                >
                  <Text style={[s.pillText, playingShape === sh.key && s.pillTextActive]}>{sh.key}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.bigResult}>
            <View style={{ flex: 1 }}>
              <Text style={s.bigResultLabel}>Sounding key</Text>
              <Text style={s.bigResultKey}>{mode2Result}</Text>
              <Text style={s.soundsLike}>
                {capoFret === 0 ? `No capo · ${playingShape} shape` : `Fret ${capoFret} · ${playingShape} shape`}
              </Text>
            </View>
            {mode2Chord && (
              <ChordDiagramSVG
                chord={mode2Chord}
                size={1}
                primary={colors.primary}
                fg={colors.foreground}
                border={colors.border}
                muted={colors.mutedForeground}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
