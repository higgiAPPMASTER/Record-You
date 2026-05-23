import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type ToolItem = {
  key: string;
  title: string;
  desc: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  route: string;
};

const TOOLS: ToolItem[] = [
  { key: "musicians", title: "Musicians Near Me", desc: "Find and connect with local musicians", icon: "users", route: "/tools/musicians" },
  { key: "mixer", title: "Mixer", desc: "Layer two tracks with volume control", icon: "sliders", route: "/tools/mixer" },
  { key: "metronome", title: "Metronome", desc: "Keep the beat with tap-tempo", icon: "clock", route: "/tools/metronome" },
  { key: "capo", title: "Capo Calculator", desc: "Find capo positions and sounding keys", icon: "anchor", route: "/tools/capo" },
  { key: "tabs", title: "Tabs", desc: "Save and transpose guitar tabs", icon: "file-text", route: "/tools/tabs" },
];

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    title: { fontSize: 28, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    sub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
    scroll: { paddingHorizontal: 20, paddingBottom: insets.bottom + 100 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      marginBottom: 10,
      gap: 14,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1 },
    rowTitle: { fontSize: 16, color: colors.foreground, fontFamily: "Inter_600SemiBold", fontWeight: "600" },
    rowDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>More Tools</Text>
        <Text style={s.sub}>Everything else for your craft</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        {TOOLS.map((t) => (
          <Pressable key={t.key} style={s.row} onPress={() => router.push(t.route as any)}>
            <View style={s.iconWrap}>
              <Feather name={t.icon} size={20} color={colors.primary} />
            </View>
            <View style={s.info}>
              <Text style={s.rowTitle}>{t.title}</Text>
              <Text style={s.rowDesc}>{t.desc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
