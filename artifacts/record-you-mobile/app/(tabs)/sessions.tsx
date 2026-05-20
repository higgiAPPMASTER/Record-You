import { Globe, Music, Users } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useListSessions } from "@workspace/api-client-react";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SessionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: sessions = [], isLoading, refetch, isRefetching } = useListSessions();
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const handlePlay = async (id: number, audioUrl: string | null | undefined) => {
    if (!audioUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playingId === id) {
      await soundRef.current?.pauseAsync();
      setPlayingId(null);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlayingId(null);
    }
    setLoadingId(id);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingId(id);
      setLoadingId(null);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch {
      setLoadingId(null);
    }
  };

  const handleCollab = (shareToken: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) {
      Alert.alert("Not available", "Collaboration requires a live server connection.");
      return;
    }
    const url = `https://${domain}/collab/${shareToken}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open the collaboration page.");
    });
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    headerTitle: {
      fontSize: 28,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    headerSub: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    list: { paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 84 + 16 : insets.bottom + 84 + 16 },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden" as const,
    },
    cardBody: { padding: 16 },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 6,
    },
    seekBadge: {
      alignSelf: "flex-start" as const,
      backgroundColor: colors.primary + "22",
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 8,
    },
    seekText: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    metaRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      marginBottom: 12,
    },
    metaText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    btnRow: {
      flexDirection: "row" as const,
      gap: 8,
    },
    previewBtn: {
      flex: 1,
      height: 38,
      borderRadius: 8,
      backgroundColor: colors.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    previewBtnText: {
      fontSize: 13,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    collabBtn: {
      flex: 1,
      height: 38,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    collabBtnText: {
      fontSize: 13,
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    empty: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: 48,
      gap: 12,
    },
    emptyText: {
      fontSize: 16,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center" as const,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Globe size={22} color={colors.primary} />
          <Text style={styles.headerTitle}>Open Sessions</Text>
        </View>
        <Text style={styles.headerSub}>
          {sessions.length > 0 ? `${sessions.length} song${sessions.length === 1 ? "" : "s"} looking for collaborators` : "Browse sessions and add your part"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Music size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No open sessions yet.{"\n"}Post one from the web app!</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {item.seekingHelp && (
                  <View style={styles.seekBadge}>
                    <Text style={styles.seekText}>Looking for: {item.seekingHelp}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  {item.duration != null && (
                    <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Users size={11} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{item.collabCount} collab{item.collabCount !== 1 ? "s" : ""}</Text>
                  </View>
                  <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={styles.btnRow}>
                  {item.hasAudio && (
                    <Pressable
                      style={styles.previewBtn}
                      onPress={() => handlePlay(item.id, item.audioUrl)}
                    >
                      {loadingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.foreground} />
                      ) : (
                        <Text style={styles.previewBtnText}>
                          {playingId === item.id ? "⏸ Stop" : "▶ Preview"}
                        </Text>
                      )}
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.collabBtn}
                    onPress={() => handleCollab(item.shareToken)}
                  >
                    <Text style={styles.collabBtnText}>🎸 Collab</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
