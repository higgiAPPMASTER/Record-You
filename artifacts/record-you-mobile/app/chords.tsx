import { ArrowLeft, Search, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CHORDS, ChordDiagram, QUALITIES, ROOTS } from "@/constants/chords";

const QUALITY_LABELS: Record<string, string> = {
  major: "Major", minor: "Minor", "7": "Dom7", maj7: "Maj7", m7: "Min7",
  sus2: "Sus2", sus4: "Sus4", add9: "Add9", dim: "Dim", aug: "Aug", power: "5th",
};

function ChordDiagramView({ chord, sz = 92 }: { chord: ChordDiagram; sz?: number }) {
  const colors = useColors();
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
      {/* Fret number label if not starting at fret 1 */}
      {chord.baseFret > 1 && (
        <SvgText
          x={leftPad - 4}
          y={topPad + fretGap * 0.6}
          fontSize={sz * 0.09}
          fill={colors.mutedForeground}
          textAnchor="end"
          fontFamily="Inter_400Regular"
        >
          {chord.baseFret}fr
        </SvgText>
      )}

      {/* Nut (thick line) */}
      {chord.baseFret === 1 && (
        <Rect
          x={leftPad - 1}
          y={topPad - sz * 0.04}
          width={(STRINGS - 1) * strGap + 2}
          height={sz * 0.04}
          rx={1}
          fill={colors.foreground}
        />
      )}

      {/* Fret lines */}
      {Array.from({ length: FRETS + 1 }).map((_, i) => (
        <Line
          key={`f${i}`}
          x1={leftPad}
          y1={fretY(i)}
          x2={leftPad + (STRINGS - 1) * strGap}
          y2={fretY(i)}
          stroke={colors.border}
          strokeWidth={0.8}
        />
      ))}

      {/* String lines */}
      {Array.from({ length: STRINGS }).map((_, i) => (
        <Line
          key={`s${i}`}
          x1={strX(i)}
          y1={topPad}
          x2={strX(i)}
          y2={fretY(FRETS)}
          stroke={colors.border}
          strokeWidth={0.8}
        />
      ))}

      {/* Barre */}
      {chord.barre && (() => {
        const rf = relPos(chord.barre.fret);
        if (rf < 1 || rf > FRETS) return null;
        const cy = dotCY(rf);
        return (
          <Rect
            x={strX(chord.barre.from)}
            y={cy - dotR}
            width={strX(chord.barre.to) - strX(chord.barre.from)}
            height={dotR * 2}
            rx={dotR}
            fill={colors.primary}
          />
        );
      })()}

      {/* Finger dots */}
      {chord.positions.map((p, i) => {
        const rf = relPos(p);
        if (rf < 1 || rf > FRETS) return null;
        const isBarre = chord.barre && chord.barre.fret === chord.baseFret + rf - 1;
        if (isBarre) return null;
        return (
          <Circle
            key={`d${i}`}
            cx={strX(i)}
            cy={dotCY(rf)}
            r={dotR}
            fill={colors.primary}
          />
        );
      })}

      {/* Open / muted markers */}
      {chord.positions.map((p, i) => {
        const markerY = topPad - sz * 0.13;
        if (p === -1) {
          return (
            <SvgText
              key={`m${i}`}
              x={strX(i)}
              y={markerY}
              fontSize={sz * 0.14}
              fill={colors.mutedForeground}
              textAnchor="middle"
            >
              ×
            </SvgText>
          );
        }
        if (p === 0) {
          return (
            <Circle
              key={`m${i}`}
              cx={strX(i)}
              cy={markerY - sz * 0.04}
              r={sz * 0.055}
              stroke={colors.mutedForeground}
              strokeWidth={0.9}
              fill="none"
            />
          );
        }
        return null;
      })}
    </Svg>
  );
}

export default function ChordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [activeRoot, setActiveRoot] = useState<string | null>(null);
  const [activeQuality, setActiveQuality] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return CHORDS.filter((c) => {
      const q = search.toLowerCase().trim();
      if (q && !c.full.toLowerCase().includes(q) && !c.root.toLowerCase().includes(q)) return false;
      if (activeRoot && c.root !== activeRoot) return false;
      if (activeQuality && c.quality !== activeQuality) return false;
      return true;
    });
  }, [search, activeRoot, activeQuality]);

  const selectedChord = CHORDS.find((c) => c.full === selected);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 20 : insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, marginBottom: 12 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    searchRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: 10,
      height: 38,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      paddingVertical: 0,
    },
    filterRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    filterLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" as const },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      borderWidth: 1,
      marginRight: 6,
    },
    chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
    grid: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 16,
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
    },
    chordCard: {
      width: "30%" as any,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center" as const,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    chordName: { fontSize: 12, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 4, textAlign: "center" as const },
    modalOverlay: {
      position: "absolute" as const,
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "#000000cc",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 28,
      alignItems: "center" as const,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 200,
    },
    modalTitle: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    modalSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    closeBtn: {
      marginTop: 4,
      paddingHorizontal: 24,
      paddingVertical: 10,
      backgroundColor: colors.muted,
      borderRadius: 10,
    },
    closeBtnText: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Chord Library</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", marginLeft: "auto" }}>
            {filtered.length}
          </Text>
        </View>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search chords…"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <X size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Root filter */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Root</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ROOTS.map((r) => (
            <Pressable
              key={r}
              style={[styles.chip, { backgroundColor: activeRoot === r ? colors.primary : "transparent", borderColor: activeRoot === r ? colors.primary : colors.border }]}
              onPress={() => setActiveRoot(activeRoot === r ? null : r)}
            >
              <Text style={[styles.chipText, { color: activeRoot === r ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Quality filter */}
      <View style={[styles.filterRow, { borderBottomWidth: 1 }]}>
        <Text style={styles.filterLabel}>Quality</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {QUALITIES.map((q) => (
            <Pressable
              key={q}
              style={[styles.chip, { backgroundColor: activeQuality === q ? colors.primary : "transparent", borderColor: activeQuality === q ? colors.primary : colors.border }]}
              onPress={() => setActiveQuality(activeQuality === q ? null : q)}
            >
              <Text style={[styles.chipText, { color: activeQuality === q ? colors.primaryForeground : colors.mutedForeground }]}>{QUALITY_LABELS[q] ?? q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Chord grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {filtered.map((chord) => (
          <Pressable
            key={chord.full}
            style={({ pressed }) => [
              styles.chordCard,
              {
                borderColor: pressed ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => setSelected(chord.full)}
          >
            <ChordDiagramView chord={chord} sz={88} />
            <Text style={styles.chordName}>{chord.full}</Text>
          </Pressable>
        ))}
        {filtered.length === 0 && (
          <View style={{ flex: 1, alignItems: "center", paddingTop: 48 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>No chords found</Text>
          </View>
        )}
      </ScrollView>

      {/* Detail modal */}
      {selected && selectedChord && (
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{selectedChord.full}</Text>
            <Text style={styles.modalSub}>{QUALITY_LABELS[selectedChord.quality] ?? selectedChord.quality} • {selectedChord.root}</Text>
            <ChordDiagramView chord={selectedChord} sz={160} />
            <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}
