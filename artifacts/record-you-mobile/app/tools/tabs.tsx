import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { transposeText, semitoneLabel } from "@/lib/transpose";
import { deleteTab, getTabs, saveTab, type SavedTab } from "@/lib/storage";

const TAB_LINE_RE = /^[EADGBe]\|/;
const CHORD_TOKEN_RE = /^[A-G][#b]?(?:maj7|maj|min|m7|m9|sus[24]?|add9?|dim|aug|m|[79]|11|13)?$/;

function isTabLine(line: string) {
  return TAB_LINE_RE.test(line.trim());
}

function isChordLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[") || trimmed.startsWith("//")) return false;
  return trimmed.split(/\s+/).every((t) => CHORD_TOKEN_RE.test(t));
}

function TabRenderer({ content, semitones, colors }: { content: string; semitones: number; colors: ReturnType<typeof useColors> }) {
  const transposed = transposeText(content, semitones);
  const lines = transposed.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        let color = colors.foreground;
        if (isTabLine(line)) color = colors.primary;
        else if (isChordLine(line)) color = "#ff9d4a";
        else if (line.trim().startsWith("#") || line.trim().startsWith("[")) color = colors.mutedForeground;
        return (
          <Text
            key={i}
            style={{
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              fontSize: 12,
              lineHeight: 18,
              color,
            }}
          >
            {line || " "}
          </Text>
        );
      })}
    </View>
  );
}

function TabCard({ tab, onDelete, colors }: { tab: SavedTab; onDelete: () => void; colors: ReturnType<typeof useColors> }) {
  const [expanded, setExpanded] = useState(false);
  const [semitones, setSemitones] = useState(0);

  const s = StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      backgroundColor: colors.card,
      marginBottom: 10,
      overflow: "hidden",
    },
    head: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
    info: { flex: 1 },
    title: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 },
    artist: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    iconBtn: { padding: 6 },
    body: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12, gap: 12 },
    transposeBar: { flexDirection: "row", alignItems: "center", gap: 8 },
    tBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    tLabel: { flex: 1, textAlign: "center", color: semitones === 0 ? colors.mutedForeground : colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: colors.primary + "20",
    },
    badgeText: { color: colors.primary, fontSize: 10, fontFamily: "Inter_600SemiBold" },
  });

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Feather name="file-text" size={16} color={colors.primary} />
        <View style={s.info}>
          <Text style={s.title}>{tab.title || "Untitled"}</Text>
          {tab.artist ? <Text style={s.artist}>{tab.artist}</Text> : null}
        </View>
        {semitones !== 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{semitones > 0 ? "+" : ""}{semitones}st</Text>
          </View>
        )}
        <Pressable style={s.iconBtn} onPress={() => setExpanded((v) => !v)}>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable style={s.iconBtn} onPress={onDelete}>
          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {expanded && (
        <View style={s.body}>
          <View style={s.transposeBar}>
            <Pressable style={s.tBtn} onPress={() => setSemitones((n) => Math.max(-11, n - 1))}>
              <Feather name="minus" size={16} color={colors.foreground} />
            </Pressable>
            <Text style={s.tLabel}>{semitoneLabel(semitones)}</Text>
            <Pressable style={s.tBtn} onPress={() => setSemitones((n) => Math.min(11, n + 1))}>
              <Feather name="plus" size={16} color={colors.foreground} />
            </Pressable>
            {semitones !== 0 && (
              <Pressable style={s.tBtn} onPress={() => setSemitones(0)}>
                <Feather name="rotate-ccw" size={14} color={colors.foreground} />
              </Pressable>
            )}
          </View>
          <ScrollView horizontal>
            <TabRenderer content={tab.content} semitones={semitones} colors={colors} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function TabsScreen() {
  const colors = useColors();
  const [tabs, setTabs] = useState<SavedTab[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [content, setContent] = useState("");

  const refresh = () => getTabs().then(setTabs);

  useEffect(() => {
    refresh();
  }, []);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Empty", "Paste some tab content first.");
      return;
    }
    await saveTab({ title: title.trim() || "Untitled", artist: artist.trim(), content: content.trim() });
    setTitle("");
    setArtist("");
    setContent("");
    setShowForm(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteTab(id);
    refresh();
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 60 },
    topRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
    addBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    addBtnText: { color: "#000", fontFamily: "Inter_600SemiBold" },
    formCard: {
      borderWidth: 1,
      borderColor: colors.primary + "60",
      borderRadius: colors.radius,
      padding: 14,
      backgroundColor: colors.card,
      marginBottom: 16,
      gap: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      backgroundColor: colors.background,
    },
    textarea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      color: colors.foreground,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
      minHeight: 160,
      backgroundColor: colors.background,
      textAlignVertical: "top",
    },
    formRow: { flexDirection: "row", gap: 8 },
    formBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    formCancel: { borderWidth: 1, borderColor: colors.border },
    formCancelText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    formSave: { backgroundColor: colors.primary },
    formSaveText: { color: "#000", fontFamily: "Inter_600SemiBold" },
    empty: { padding: 40, alignItems: "center", gap: 10 },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
  });

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.topRow}>
          <Pressable style={s.addBtn} onPress={() => setShowForm((v) => !v)}>
            <Feather name={showForm ? "x" : "plus"} size={16} color="#000" />
            <Text style={s.addBtnText}>{showForm ? "Cancel" : "Add Tab"}</Text>
          </Pressable>
        </View>

        {showForm && (
          <View style={s.formCard}>
            <TextInput
              style={s.input}
              placeholder="Song title"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={s.input}
              placeholder="Artist"
              placeholderTextColor={colors.mutedForeground}
              value={artist}
              onChangeText={setArtist}
            />
            <TextInput
              style={s.textarea}
              placeholder={"Paste tab content here...\n\nem  G  C  D\nToday is gonna be the day...\n\ne|--0--3--0--2--|"}
              placeholderTextColor={colors.mutedForeground}
              value={content}
              onChangeText={setContent}
              multiline
            />
            <View style={s.formRow}>
              <Pressable style={[s.formBtn, s.formCancel]} onPress={() => setShowForm(false)}>
                <Text style={s.formCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.formBtn, s.formSave]} onPress={handleSave}>
                <Text style={s.formSaveText}>Save Tab</Text>
              </Pressable>
            </View>
          </View>
        )}

        {tabs.length === 0 ? (
          <View style={s.empty}>
            <Feather name="file-text" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>No tabs saved yet</Text>
          </View>
        ) : (
          tabs.map((t) => <TabCard key={t.id} tab={t} colors={colors} onDelete={() => handleDelete(t.id)} />)
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
