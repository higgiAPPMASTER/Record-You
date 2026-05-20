import { BookOpen, Clock, FileText, Guitar } from "lucide-react-native";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

const TOOLS = [
  {
    key: "metronome",
    label: "Metronome",
    description: "Keep steady time",
    icon: Clock,
    route: "/(tabs)/metronome",
  },
  {
    key: "chords",
    label: "Chord Library",
    description: "Guitar chord diagrams",
    icon: BookOpen,
    route: "/chords",
  },
  {
    key: "capo",
    label: "Capo Calc",
    description: "Find the right capo fret",
    icon: Guitar,
    route: "/capo",
  },
  {
    key: "tabs",
    label: "Tab Viewer",
    description: "View & write guitar tabs",
    icon: FileText,
    route: "/tabviewer",
  },
] as const;

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    headerSub: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 2,
      fontFamily: "Inter_400Regular",
    },
    grid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      paddingHorizontal: 16,
      gap: 12,
      paddingBottom: Platform.OS === "web" ? 84 + 16 : insets.bottom + 84 + 16,
    },
    card: {
      width: "47%" as any,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 10,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.primary + "1a",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    cardLabel: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    cardDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 16,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tools</Text>
        <Text style={styles.headerSub}>Guitar utilities</Text>
      </View>

      <View style={styles.grid}>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Pressable
              key={tool.key}
              style={({ pressed }) => [
                styles.card,
                { opacity: pressed ? 0.7 : 1, borderColor: pressed ? colors.primary + "60" : colors.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(tool.route as any);
              }}
            >
              <View style={styles.iconWrap}>
                <Icon size={22} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>{tool.label}</Text>
              <Text style={styles.cardDesc}>{tool.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
