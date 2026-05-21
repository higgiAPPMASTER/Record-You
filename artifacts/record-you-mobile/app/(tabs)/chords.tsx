import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChordDiagramSVG } from "@/components/ChordDiagram";
import { useColors } from "@/hooks/useColors";
import { CHORDS, QUALITIES, ROOTS, type ChordDiagram } from "@/lib/chords";
import { getFavourites, toggleFavourite } from "@/lib/storage";

const QUALITY_LABELS: Record<string, string> = {
  major: "Major", minor: "Minor", "7": "Dom 7", maj7: "Maj 7", m7: "Min 7",
  sus2: "Sus2", sus4: "Sus4", add9: "Add9", dim: "Dim", aug: "Aug",
  power: "Power", "9": "9th", m9: "Min9", "11": "11th", "13": "13th",
};

export default function ChordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"all" | "favourites">("all");
  const [search, setSearch] = useState("");
  const [activeRoot, setActiveRoot] = useState<string | null>(null);
  const [activeQuality, setActiveQuality] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChordDiagram | null>(null);
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    getFavourites().then(setFavs);
  }, []);

  const handleFav = async (full: string) => {
    setFavs(await toggleFavourite(full));
  };

  const filtered = useMemo(() => {
    return CHORDS.filter((c) => {
      if (view === "favourites" && !favs.includes(c.full)) return false;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.full.toLowerCase().includes(q) ||
        c.root.toLowerCase().includes(q) ||
        c.quality.toLowerCase().includes(q);
      const matchRoot = !activeRoot || c.root === activeRoot;
      const matchQuality = !activeQuality || c.quality === activeQuality;
      return matchSearch && matchRoot && matchQuality;
    });
  }, [search, activeRoot, activeQuality, view, favs]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    title: { fontSize: 28, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    sub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
    viewRow: { flexDirection: "row", gap: 4, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    viewBtn: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
    viewBtnActive: { borderBottomColor: colors.primary },
    viewText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    viewTextActive: { color: colors.primary, fontWeight: "600" },
    searchBox: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    searchInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.foreground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    filterRow: { paddingHorizontal: 20, paddingVertical: 8 },
    filterLabel: { fontSize: 10, color: colors.mutedForeground, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Inter_600SemiBold" },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
    },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    pillTextActive: { color: "#000", fontWeight: "700" },
    grid: { paddingHorizontal: 14, paddingBottom: insets.bottom + 100 },
    card: {
      flex: 1,
      margin: 6,
      padding: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      alignItems: "center",
    },
    cardName: { fontSize: 12, color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 4 },
    heart: { position: "absolute", top: 6, right: 6, padding: 4 },
    empty: { padding: 40, alignItems: "center" },
    emptyText: { color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_500Medium" },
    modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 20 },
    modalCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 24,
      alignItems: "center",
      gap: 12,
      minWidth: 240,
    },
    modalName: { fontSize: 32, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    modalQuality: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    closeBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 8 },
    closeText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
  });

  const renderCard = ({ item }: { item: ChordDiagram }) => {
    const isFav = favs.includes(item.full);
    return (
      <View style={{ flex: 1 / 3 }}>
        <Pressable style={s.card} onPress={() => setSelected(item)}>
          <ChordDiagramSVG chord={item} size={0.75} primary={colors.primary} fg={colors.foreground} border={colors.border} muted={colors.mutedForeground} />
          <Text style={s.cardName}>{item.full}</Text>
          <Pressable style={s.heart} onPress={() => handleFav(item.full)} hitSlop={8}>
            <Feather name="heart" size={14} color={isFav ? colors.primary : colors.mutedForeground} />
          </Pressable>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Chord Library</Text>
        <Text style={s.sub}>{CHORDS.length} chords — tap to enlarge</Text>
      </View>

      <View style={s.viewRow}>
        {(["all", "favourites"] as const).map((v) => (
          <Pressable key={v} style={[s.viewBtn, view === v && s.viewBtnActive]} onPress={() => setView(v)}>
            <Text style={[s.viewText, view === v && s.viewTextActive]}>
              {v === "all" ? "All Chords" : `Favourites${favs.length ? ` (${favs.length})` : ""}`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.searchBox}>
        <TextInput
          style={s.searchInput}
          placeholder="Search chords…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={s.filterRow}>
        <Text style={s.filterLabel}>Root</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ROOTS.map((r) => (
            <Pressable
              key={r}
              style={[s.pill, activeRoot === r && s.pillActive]}
              onPress={() => setActiveRoot(activeRoot === r ? null : r)}
            >
              <Text style={[s.pillText, activeRoot === r && s.pillTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={s.filterRow}>
        <Text style={s.filterLabel}>Quality</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {QUALITIES.filter((q) => CHORDS.some((c) => c.quality === q)).map((q) => (
            <Pressable
              key={q}
              style={[s.pill, activeQuality === q && s.pillActive]}
              onPress={() => setActiveQuality(activeQuality === q ? null : q)}
            >
              <Text style={[s.pillText, activeQuality === q && s.pillTextActive]}>{QUALITY_LABELS[q] ?? q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderCard}
        keyExtractor={(item) => item.full}
        numColumns={3}
        contentContainerStyle={s.grid}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="search" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>No chords match</Text>
          </View>
        }
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.modalBg} onPress={() => setSelected(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            {selected && (
              <>
                <Text style={s.modalName}>{selected.full}</Text>
                <Text style={s.modalQuality}>{QUALITY_LABELS[selected.quality] ?? selected.quality}</Text>
                <ChordDiagramSVG chord={selected} size={1.8} primary={colors.primary} fg={colors.foreground} border={colors.border} muted={colors.mutedForeground} />
                <Pressable style={s.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={s.closeText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
