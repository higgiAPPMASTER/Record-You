import { ArrowLeft, Save, Trash2, Pause, Play } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import {
  useGetSong,
  useUpdateSong,
  useDeleteSong,
  getGetSongQueryKey,
  getListSongsQueryKey,
} from "@workspace/api-client-react";

function formatDuration(s: number | null | undefined): string {
  if (!s) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const songId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) },
  });
  const updateSong = useUpdateSong();
  const deleteSong = useDeleteSong();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (song && !initialized) {
      setTitle(song.title);
      setTags(song.tags ?? "");
      setNotes(song.notes ?? "");
      setInitialized(true);
    }
  }, [song, initialized]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handlePlayPause = async () => {
    if (!song?.audioUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      return;
    }

    try {
      setIsLoadingAudio(true);
      const fullUrl =
        song.audioUrl.startsWith("http")
          ? song.audioUrl
          : `https://${process.env.EXPO_PUBLIC_DOMAIN}${song.audioUrl}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: fullUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoadingAudio(false);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentTime(status.positionMillis / 1000);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        }
      });
    } catch {
      setIsLoadingAudio(false);
      Alert.alert("Playback error", "Could not play this track.");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Please give this track a name.");
      return;
    }
    setIsSaving(true);
    try {
      await updateSong.mutateAsync({
        id: songId,
        data: { title: title.trim(), tags: tags.trim(), notes: notes.trim() },
      });
      queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) });
      queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Save failed", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Track", `Delete "${song?.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await soundRef.current?.unloadAsync().catch(() => {});
          await deleteSong.mutateAsync({ id: songId });
          queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
          router.back();
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    topBarTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    deleteBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    scroll: { flex: 1 },
    content: {
      padding: 20,
      paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20,
    },
    playerCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      alignItems: "center" as const,
    },
    playBtn: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 16,
    },
    durationRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
    },
    timeText: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      width: 40,
    },
    progressBar: {
      flex: 1,
      height: 4,
      backgroundColor: colors.muted,
      borderRadius: 2,
    },
    progressFill: {
      height: 4,
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    noAudio: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    label: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: 8,
      fontFamily: "Inter_600SemiBold",
    },
    input: {
      fontSize: 16,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      paddingVertical: 0,
    },
    saveBtn: {
      height: 50,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      gap: 8,
      marginTop: 4,
    },
    saveBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!song) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
          Track not found.
        </Text>
      </View>
    );
  }

  const duration = song.duration ?? 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {song.title}
        </Text>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Trash2 size={20} color={colors.destructive} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.playerCard}>
          {song.hasAudio ? (
            <>
              <Pressable style={styles.playBtn} onPress={handlePlayPause}>
                {isLoadingAudio ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : isPlaying ? (
                  <Pause size={28} color="#fff" />
                ) : (
                  <Play size={28} color="#fff" />
                )}
              </Pressable>
              <View style={styles.durationRow}>
                <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
                </View>
                <Text style={[styles.timeText, { textAlign: "right" as const }]}>
                  {formatDuration(duration)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.noAudio}>No audio recorded for this track.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Tags</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="acoustic, draft"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 100 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Chord progression, lyrics..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Save size={18} color="#fff" />
          )}
          <Text style={styles.saveBtnText}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
