import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";

import { useColors } from "@/hooks/useColors";
import {
  useListSongs,
  useDeleteSong,
  getListSongsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: songs = [], isLoading, refetch, isRefetching } = useListSongs();
  const deleteSong = useDeleteSong();

  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handlePlay = async (id: number, audioUrl: string | null | undefined) => {
    if (!audioUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (playingId === id) {
      await soundRef.current?.pauseAsync();
      setPlayingId(null);
      return;
    }

    try {
      setLoadingId(id);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setPlayingId(null);

      const fullUrl =
        audioUrl.startsWith("http")
          ? audioUrl
          : `https://${process.env.EXPO_PUBLIC_DOMAIN}${audioUrl}`;

      const { sound } = await Audio.Sound.createAsync(
        { uri: fullUrl },
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
      Alert.alert("Playback error", "Could not play this track.");
    }
  };

  const handleDelete = (id: number, title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Track", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (playingId === id) {
            await soundRef.current?.unloadAsync();
            soundRef.current = null;
            setPlayingId(null);
          }
          await deleteSong.mutateAsync({ id });
          queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
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
    list: { paddingHorizontal: 16, paddingTop: 8 },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      marginBottom: 10,
      overflow: "hidden" as const,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardInner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: 14,
      gap: 12,
    },
    playBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    songInfo: { flex: 1 },
    songTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    songMeta: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 3,
      fontFamily: "Inter_400Regular",
    },
    tags: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 4,
      marginTop: 6,
    },
    tag: {
      backgroundColor: colors.muted,
      borderRadius: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    tagText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    actions: { flexDirection: "row" as const, gap: 4 },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    empty: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingBottom: 80,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center" as const,
      paddingHorizontal: 40,
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerSub}>Your recordings</Text>
      </View>

      {songs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="mic" size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No tracks yet</Text>
          <Text style={styles.emptyText}>
            Head to Studio to capture your first recording.
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 },
          ]}
          onRefresh={refetch}
          refreshing={isRefetching}
          scrollEnabled={songs.length > 0}
          renderItem={({ item }) => {
            const isPlaying = playingId === item.id;
            const isBuffering = loadingId === item.id;
            const tagList = item.tags
              ? item.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [];

            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/song/${item.id}`)}
              >
                <View style={styles.cardInner}>
                  <Pressable
                    style={[
                      styles.playBtn,
                      {
                        backgroundColor: isPlaying
                          ? colors.primary
                          : colors.muted,
                      },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      if (item.hasAudio) handlePlay(item.id, item.audioUrl);
                    }}
                    disabled={!item.hasAudio}
                  >
                    {isBuffering ? (
                      <ActivityIndicator
                        size="small"
                        color={isPlaying ? "#fff" : colors.primary}
                      />
                    ) : (
                      <Feather
                        name={isPlaying ? "pause" : "play"}
                        size={22}
                        color={isPlaying ? "#fff" : item.hasAudio ? colors.primary : colors.mutedForeground}
                      />
                    )}
                  </Pressable>

                  <View style={styles.songInfo}>
                    <Text style={styles.songTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.songMeta}>
                      {formatDuration(item.duration)} · {formatDate(item.createdAt)}
                    </Text>
                    {tagList.length > 0 && (
                      <View style={styles.tags}>
                        {tagList.slice(0, 3).map((tag) => (
                          <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDelete(item.id, item.title);
                      }}
                    >
                      <Feather name="trash-2" size={18} color={colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
