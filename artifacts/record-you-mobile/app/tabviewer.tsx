import { ArrowLeft, Copy, Trash2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const PLACEHOLDER = `e|---0---2---3---2---|
B|---1---3---3---3---|
G|---0---2---0---2---|
D|---2---0---0---0---|
A|---3-------2-------|
E|---------------3---|

Capo 2 — G shape sounds as A`;

const EXAMPLES = [
  {
    label: "Intro riff",
    tab: `e|---0---2---3---2---|
B|---1---3---3---3---|
G|---0---2---0---2---|
D|---2---0---0---0---|
A|---3-------2-------|
E|---------------3---|`,
  },
  {
    label: "Pentatonic run",
    tab: `e|------------------5--8--|
B|--------------5--8------|
G|----------5--7----------|
D|------5--7--------------|
A|--5--7------------------|
E|------------------------|`,
  },
  {
    label: "Open chords",
    tab: `  G       Em      C       D
e|3-----||0-----||0-----||2-----|
B|0-----||0-----||1-----||3-----|
G|0-----||0-----||0-----||2-----|
D|0-----||2-----||2-----||0-----|
A|2-----||2-----||3-----||------|
E|3-----||0-----||------||------|`,
  },
];

export default function TabViewerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleCopy = async () => {
    if (!tab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(tab);
    Alert.alert("Copied", "Tab copied to clipboard.");
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Clear tab?", "This will erase your current tab.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => setTab("") },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 20 : insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1 },
    headerActions: { flexDirection: "row" as const, gap: 8 },
    actionBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.muted },
    tabInput: {
      flex: 1,
      color: colors.foreground,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontSize: 13,
      lineHeight: 20,
      padding: 16,
      paddingTop: 16,
      textAlignVertical: "top" as const,
      backgroundColor: colors.background,
    },
    inputContainer: { flex: 1 },
    examplesBar: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    examplesLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 6, paddingHorizontal: 8 },
    exampleBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.muted,
      marginRight: 8,
    },
    exampleBtnText: { fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium" },
    placeholder: {
      position: "absolute" as const,
      top: 16,
      left: 16,
      right: 16,
      color: colors.mutedForeground,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontSize: 13,
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Tab Viewer</Text>
          <View style={styles.headerActions}>
            {tab.length > 0 && (
              <>
                <Pressable style={styles.actionBtn} onPress={handleCopy}>
                  <Copy size={18} color={colors.foreground} />
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={handleClear}>
                  <Trash2 size={18} color={colors.destructive} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.inputContainer}>
        {tab.length === 0 && !isEditing && (
          <Text style={styles.placeholder} pointerEvents="none">
            {PLACEHOLDER}
          </Text>
        )}
        <TextInput
          style={styles.tabInput}
          value={tab}
          onChangeText={setTab}
          multiline
          scrollEnabled={false}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
        />
      </View>

      {/* Example snippets */}
      <View style={styles.examplesBar}>
        <Text style={styles.examplesLabel}>Load example</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {EXAMPLES.map((ex) => (
            <Pressable
              key={ex.label}
              style={styles.exampleBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTab(ex.tab);
              }}
            >
              <Text style={styles.exampleBtnText}>{ex.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
