import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { listLocalSongs, type LocalSong } from "@/lib/recordings";
import { useListSongs } from "@workspace/api-client-react";

type Slot = "a" | "b";

interface UnifiedSong {
  key: string;
  title: string;
  source: "local" | "cloud";
  uri: string; // always a playable URI
}

interface TrackState {
  song: UnifiedSong | null;
  volume: number;
  sound: Audio.Sound | null;
}

export default function MixerScreen() {
  const colors = useColors();
  const { data: cloudSongs = [] } = useListSongs();
  const [localSongs, setLocalSongs] = useState<LocalSong[]>([]);

  useEffect(() => {
    listLocalSongs().then(setLocalSongs).catch(() => {});
  }, []);

  // Merged list: cloud songs first, then local-only (not already uploaded)
  const uploadedCloudIds = new Set(
    localSongs.map((s) => s.cloudId).filter(Boolean)
  );
  const allSongs: UnifiedSong[] = [
    ...(cloudSongs as any[])
      .filter((s) => s.audioUrl)
      .map((s) => ({
        key: `cloud:${s.id}`,
        title: s.title,
        source: "cloud" as const,
        uri: s.audioUrl as string,
      })),
    ...localSongs
      .filter((s) => !s.cloudId || !uploadedCloudIds.has(s.cloudId))
      .map((s) => ({
        key: `local:${s.id}`,
        title: s.title,
        source: "local" as const,
        uri: s.uri,
      })),
  ];

  const [tracks, setTracks] = useState<Record<Slot, TrackState>>({
    a: { song: null, volume: 0.8, sound: null },
    b: { song: null, volume: 0.8, sound: null },
  });
  const [playing, setPlaying] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<Slot | null>(null);
  const [pickerOpen, setPickerOpen] = useState<Slot | null>(null);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    return () => {
      Object.values(tracksRef.current).forEach((t) => {
        t.sound?.unloadAsync().catch(() => {});
      });
    };
  }, []);

  const loadTrack = async (slot: Slot, song: UnifiedSong) => {
    setLoadingSlot(slot);
    try {
      await tracksRef.current[slot].sound?.unloadAsync();
    } catch {}
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: song.uri },
        { shouldPlay: false, volume: tracks[slot].volume, isLooping: false }
      );
      setTracks((t) => ({ ...t, [slot]: { ...t[slot], song, sound } }));
    } catch {
      Alert.alert(
        "Could not load track",
        `"${song.title}" couldn't be loaded. If it's a cloud track, check your connection. If it's a local recording, try re-saving it.`
      );
    } finally {
      setLoadingSlot(null);
    }
  };

  const setVolume = async (slot: Slot, v: number) => {
    setTracks((t) => ({ ...t, [slot]: { ...t[slot], volume: v } }));
    await tracks[slot].sound?.setVolumeAsync(v).catch(() => {});
  };

  const handlePlay = async () => {
    const a = tracks.a.sound;
    const b = tracks.b.sound;
    if (!a && !b) {
      Alert.alert("No tracks loaded", "Pick at least one track first.");
      return;
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (a) { await a.setPositionAsync(0); await a.playAsync(); }
      if (b) { await b.setPositionAsync(0); await b.playAsync(); }
      setPlaying(true);
    } catch {
      Alert.alert("Playback error", "Couldn't start playback. Try loading the tracks again.");
    }
  };

  const handleStop = async () => {
    await tracks.a.sound?.pauseAsync().catch(() => {});
    await tracks.b.sound?.pauseAsync().catch(() => {});
    setPlaying(false);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 80 },
    slotCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 16,
      marginBottom: 12,
      gap: 12,
    },
    slotHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    slotLetter: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + "30",
      alignItems: "center",
      justifyContent: "center",
    },
    slotLetterText: { color: colors.primary, fontFamily: "Inter_700Bold", fontWeight: "700" },
    pickBtn: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.muted,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pickBtnText: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 },
    pickBtnPlaceholder: { color: colors.mutedForeground },
    badge: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: "hidden",
    },
    volRow: { gap: 6 },
    volLabel: { fontSize: 11, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Inter_600SemiBold" },
    volTrack: { height: 6, backgroundColor: colors.muted, borderRadius: 3, marginVertical: 8 },
    volFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    volBtnRow: { flexDirection: "row", gap: 6 },
    volBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    volBtnText: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" },
    transport: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 },
    bigBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    pickerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    pickerSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 16,
      maxHeight: "70%",
    },
    pickerTitle: { fontSize: 16, color: colors.foreground, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    songRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
    songTitle: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 },
    note: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
    loadingText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" },
  });

  const renderSlot = (slot: Slot) => {
    const t = tracks[slot];
    const isLoadingThis = loadingSlot === slot;
    return (
      <View style={s.slotCard}>
        <View style={s.slotHead}>
          <View style={s.slotLetter}>
            <Text style={s.slotLetterText}>{slot.toUpperCase()}</Text>
          </View>
          <Pressable style={s.pickBtn} onPress={() => setPickerOpen(slot)}>
            <Feather name="music" size={14} color={colors.mutedForeground} />
            <Text style={[s.pickBtnText, !t.song && s.pickBtnPlaceholder]}>
              {isLoadingThis ? "Loading…" : (t.song?.title || "Pick a track")}
            </Text>
            {t.song && (
              <Text style={[s.badge, {
                backgroundColor: t.song.source === "cloud" ? colors.primary + "30" : colors.muted,
                color: t.song.source === "cloud" ? colors.primary : colors.mutedForeground,
              }]}>
                {t.song.source}
              </Text>
            )}
            <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={s.volRow}>
          <Text style={s.volLabel}>Volume · {Math.round(t.volume * 100)}%</Text>
          <View style={s.volTrack}>
            <View style={[s.volFill, { width: `${t.volume * 100}%` }]} />
          </View>
          <View style={s.volBtnRow}>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <Pressable key={v} style={s.volBtn} onPress={() => setVolume(slot, v)}>
                <Text style={s.volBtnText}>{Math.round(v * 100)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        {renderSlot("a")}
        {renderSlot("b")}

        <View style={s.transport}>
          {playing ? (
            <Pressable style={[s.bigBtn, { backgroundColor: colors.destructive }]} onPress={handleStop}>
              <Feather name="square" size={28} color="#fff" />
            </Pressable>
          ) : (
            <Pressable style={[s.bigBtn, { backgroundColor: colors.primary }]} onPress={handlePlay}>
              <Feather name="play" size={28} color="#000" />
            </Pressable>
          )}
        </View>

        <Text style={s.note}>Play two tracks at once with independent volume control.</Text>
      </ScrollView>

      <Modal visible={!!pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(null)}>
        <Pressable style={s.pickerBg} onPress={() => setPickerOpen(null)}>
          <Pressable style={s.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.pickerTitle}>Choose track for slot {pickerOpen?.toUpperCase()}</Text>
            <ScrollView>
              {allSongs.length === 0 ? (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
                    No tracks yet. Record one in Studio first.
                  </Text>
                </View>
              ) : (
                allSongs.map((song) => (
                  <Pressable
                    key={song.key}
                    style={s.songRow}
                    onPress={async () => {
                      setPickerOpen(null);
                      if (pickerOpen) await loadTrack(pickerOpen, song);
                    }}
                  >
                    <Text style={s.songTitle}>{song.title}</Text>
                    <Text style={[s.badge, {
                      backgroundColor: song.source === "cloud" ? colors.primary + "30" : colors.muted,
                      color: song.source === "cloud" ? colors.primary : colors.mutedForeground,
                    }]}>
                      {song.source}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
