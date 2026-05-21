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
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { listLocalSongs, saveLocalSong, type LocalSong } from "@/lib/recordings";
import { useListSongs } from "@workspace/api-client-react";

type Slot = "a" | "b";
type MixerMode = "idle" | "playing" | "recording" | "saving";

interface UnifiedSong {
  key: string;
  title: string;
  source: "local" | "cloud";
  uri: string;
}

interface TrackState {
  song: UnifiedSong | null;
  volume: number;
  muted: boolean;
  sound: Audio.Sound | null;
}

const FADE_OPTIONS = [0, 1, 2, 3];

function rampVolume(
  sound: Audio.Sound,
  fromVol: number,
  toVol: number,
  durationMs: number,
  onDone?: () => void
): ReturnType<typeof setInterval> {
  const steps = Math.max(1, Math.round(durationMs / 40));
  let step = 0;
  const interval = setInterval(async () => {
    step++;
    const t = Math.min(step / steps, 1);
    const v = fromVol + (toVol - fromVol) * t;
    await sound.setVolumeAsync(Math.max(0, Math.min(1, v))).catch(() => {});
    if (step >= steps) {
      clearInterval(interval);
      onDone?.();
    }
  }, 40);
  return interval;
}

export default function MixerScreen() {
  const colors = useColors();
  const { data: cloudSongs = [] } = useListSongs();
  const [localSongs, setLocalSongs] = useState<LocalSong[]>([]);

  useEffect(() => {
    listLocalSongs().then(setLocalSongs).catch(() => {});
  }, []);

  const uploadedCloudIds = new Set(localSongs.map((s) => s.cloudId).filter(Boolean));
  const allSongs: UnifiedSong[] = [
    ...(cloudSongs as any[])
      .filter((s) => s.audioUrl)
      .map((s) => ({ key: `cloud:${s.id}`, title: s.title, source: "cloud" as const, uri: s.audioUrl as string })),
    ...localSongs
      .filter((s) => !s.cloudId || !uploadedCloudIds.has(s.cloudId))
      .map((s) => ({ key: `local:${s.id}`, title: s.title, source: "local" as const, uri: s.uri })),
  ];

  const [tracks, setTracks] = useState<Record<Slot, TrackState>>({
    a: { song: null, volume: 0.8, muted: false, sound: null },
    b: { song: null, volume: 0.8, muted: false, sound: null },
  });
  const [solo, setSolo] = useState<Slot | null>(null);
  const [mode, setMode] = useState<MixerMode>("idle");
  const [loop, setLoop] = useState(false);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [loadingSlot, setLoadingSlot] = useState<Slot | null>(null);
  const [pickerOpen, setPickerOpen] = useState<Slot | null>(null);

  // Recording state
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingUriRef = useRef<string | null>(null);
  const recordingDurationRef = useRef(0);
  const recordingStartRef = useRef(0);
  const [mixTitle, setMixTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const fadeIntervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const stopTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearFadeTimers = () => {
    fadeIntervals.current.forEach(clearInterval);
    fadeIntervals.current = [];
    stopTimeouts.current.forEach(clearTimeout);
    stopTimeouts.current = [];
  };

  useEffect(() => {
    return () => {
      clearFadeTimers();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      Object.values(tracksRef.current).forEach((t) => t.sound?.unloadAsync().catch(() => {}));
    };
  }, []);

  const effectiveVolume = (slot: Slot) => {
    const t = tracksRef.current[slot];
    if (t.muted) return 0;
    if (solo && solo !== slot) return 0;
    return t.volume;
  };

  const loadTrack = async (slot: Slot, song: UnifiedSong) => {
    setLoadingSlot(slot);
    try {
      await tracksRef.current[slot].sound?.unloadAsync();
    } catch {}
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: song.uri },
        { shouldPlay: false, volume: tracksRef.current[slot].volume, isLooping: loop }
      );
      setTracks((t) => ({ ...t, [slot]: { ...t[slot], song, sound } }));
    } catch {
      Alert.alert("Could not load track", `"${song.title}" couldn't be loaded.`);
    } finally {
      setLoadingSlot(null);
    }
  };

  const setVolume = async (slot: Slot, v: number) => {
    setTracks((t) => ({ ...t, [slot]: { ...t[slot], volume: v } }));
    const eff = tracksRef.current[slot].muted ? 0 : (solo && solo !== slot ? 0 : v);
    await tracksRef.current[slot].sound?.setVolumeAsync(eff).catch(() => {});
  };

  const toggleMute = async (slot: Slot) => {
    const newMuted = !tracksRef.current[slot].muted;
    setTracks((t) => ({ ...t, [slot]: { ...t[slot], muted: newMuted } }));
    const eff = newMuted ? 0 : (solo && solo !== slot ? 0 : tracksRef.current[slot].volume);
    await tracksRef.current[slot].sound?.setVolumeAsync(eff).catch(() => {});
  };

  const toggleSolo = async (slot: Slot) => {
    const newSolo = solo === slot ? null : slot;
    setSolo(newSolo);
    for (const s of ["a", "b"] as Slot[]) {
      const t = tracksRef.current[s];
      if (!t.sound) continue;
      let eff: number;
      if (t.muted) eff = 0;
      else if (newSolo && newSolo !== s) eff = 0;
      else eff = t.volume;
      await t.sound.setVolumeAsync(eff).catch(() => {});
    }
  };

  // ── Playback helpers ──────────────────────────────────────────────────────

  const startPlayback = async () => {
    const a = tracks.a.sound;
    const b = tracks.b.sound;
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    if (loop) {
      await a?.setIsLoopingAsync(true).catch(() => {});
      await b?.setIsLoopingAsync(true).catch(() => {});
    }
    if (fadeIn > 0) {
      if (a) { await a.setPositionAsync(0); await a.setVolumeAsync(0); await a.playAsync(); }
      if (b) { await b.setPositionAsync(0); await b.setVolumeAsync(0); await b.playAsync(); }
      if (a) fadeIntervals.current.push(rampVolume(a, 0, effectiveVolume("a"), fadeIn * 1000));
      if (b) fadeIntervals.current.push(rampVolume(b, 0, effectiveVolume("b"), fadeIn * 1000));
    } else {
      if (a) { await a.setPositionAsync(0); await a.setVolumeAsync(effectiveVolume("a")); await a.playAsync(); }
      if (b) { await b.setPositionAsync(0); await b.setVolumeAsync(effectiveVolume("b")); await b.playAsync(); }
    }
  };

  const stopPlayback = async () => {
    clearFadeTimers();
    const a = tracks.a.sound;
    const b = tracks.b.sound;
    if (fadeOut > 0 && (a || b)) {
      const volA = a ? effectiveVolume("a") : 0;
      const volB = b ? effectiveVolume("b") : 0;
      if (a) fadeIntervals.current.push(rampVolume(a, volA, 0, fadeOut * 1000));
      if (b) fadeIntervals.current.push(rampVolume(b, volB, 0, fadeOut * 1000));
      await new Promise<void>((res) => setTimeout(res, fadeOut * 1000 + 80));
    }
    await a?.pauseAsync().catch(() => {});
    await b?.pauseAsync().catch(() => {});
    if (a) await a.setVolumeAsync(effectiveVolume("a")).catch(() => {});
    if (b) await b.setVolumeAsync(effectiveVolume("b")).catch(() => {});
  };

  // ── Plain play / stop ─────────────────────────────────────────────────────

  const handlePlay = async () => {
    const a = tracks.a.sound;
    const b = tracks.b.sound;
    if (!a && !b) { Alert.alert("No tracks loaded", "Pick at least one track first."); return; }
    clearFadeTimers();
    try {
      await startPlayback();
      setMode("playing");
    } catch {
      Alert.alert("Playback error", "Couldn't start playback. Try loading the tracks again.");
    }
  };

  const handleStop = async () => {
    await stopPlayback();
    setMode("idle");
  };

  // ── Record mix ────────────────────────────────────────────────────────────

  const handleRecordMix = async () => {
    const a = tracks.a.sound;
    const b = tracks.b.sound;
    if (!a && !b) { Alert.alert("No tracks loaded", "Pick at least one track to mix first."); return; }

    // Request mic permission
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      Alert.alert("Microphone needed", "Grant microphone access in Settings to record your mix.");
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 192000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 192000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      await rec.startAsync();
      recordingRef.current = rec;
      recordingStartRef.current = Date.now();

      // Start mix playback
      await startPlayback();
      setMode("recording");
    } catch {
      Alert.alert("Could not start recording", "Make sure microphone access is granted and try again.");
    }
  };

  const handleStopRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;

    try {
      await rec.stopAndUnloadAsync();
      recordingDurationRef.current = Math.round((Date.now() - recordingStartRef.current) / 1000);
      const uri = rec.getURI();
      recordingUriRef.current = uri ?? null;
    } catch {
      Alert.alert("Recording error", "Could not finish recording.");
    }

    recordingRef.current = null;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    await stopPlayback();

    if (recordingUriRef.current) {
      setMixTitle("");
      setMode("saving");
    } else {
      setMode("idle");
      Alert.alert("Nothing saved", "The recording came out empty. Try again.");
    }
  };

  const handleSaveMix = async () => {
    const uri = recordingUriRef.current;
    if (!uri || !mixTitle.trim()) return;
    setIsSaving(true);
    try {
      await saveLocalSong({
        title: mixTitle.trim(),
        tags: "mix",
        notes: "",
        duration: recordingDurationRef.current,
        sourceUri: uri,
        mimeType: "audio/mp4",
      });
      // Refresh local songs list
      const updated = await listLocalSongs();
      setLocalSongs(updated);
      Alert.alert("Saved!", `"${mixTitle.trim()}" is now in your library.`);
      setMode("idle");
      recordingUriRef.current = null;
    } catch {
      Alert.alert("Save failed", "Could not save the mix. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 100 },
    slotCard: {
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, padding: 16, marginBottom: 12, gap: 10,
    },
    slotHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    slotLetter: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.primary + "30",
      alignItems: "center", justifyContent: "center",
    },
    slotLetterText: { color: colors.primary, fontFamily: "Inter_700Bold", fontWeight: "700" },
    pickBtn: {
      flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
      backgroundColor: colors.muted, flexDirection: "row", alignItems: "center", gap: 6,
    },
    pickBtnText: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 },
    pickBtnPlaceholder: { color: colors.mutedForeground },
    badge: {
      fontSize: 10, fontFamily: "Inter_600SemiBold",
      paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: "hidden",
    },
    iconBtnRow: { flexDirection: "row", gap: 6 },
    iconBtn: {
      width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    section: { gap: 4 },
    sectionLabel: {
      fontSize: 10, color: colors.mutedForeground, textTransform: "uppercase",
      letterSpacing: 1, fontFamily: "Inter_600SemiBold",
    },
    volRow: { flexDirection: "row", gap: 4 },
    volBtn: {
      flex: 1, paddingVertical: 6, borderRadius: 6,
      borderWidth: 1, borderColor: colors.border, alignItems: "center",
    },
    volBtnText: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" },
    globalCard: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, padding: 16, marginBottom: 12, gap: 12,
    },
    globalLabel: {
      fontSize: 11, color: colors.mutedForeground, textTransform: "uppercase",
      letterSpacing: 1, fontFamily: "Inter_600SemiBold",
    },
    optionRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    optBtn: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    optBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    transport: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 4 },
    bigBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    recDot: {
      width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444", marginRight: 6,
    },
    recLabel: { color: "#ef4444", fontFamily: "Inter_600SemiBold", fontSize: 13 },
    recRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
    saveCard: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary + "50",
      borderRadius: colors.radius, padding: 20, marginBottom: 12, gap: 12,
    },
    saveTitle: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 },
    saveSubtitle: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14,
      backgroundColor: colors.background,
    },
    saveRow: { flexDirection: "row", gap: 10 },
    savePrimary: {
      flex: 1, paddingVertical: 12, borderRadius: 8,
      backgroundColor: colors.primary, alignItems: "center",
    },
    savePrimaryText: { color: "#000", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    saveSecondary: {
      paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border, alignItems: "center",
    },
    saveSecondaryText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 },
    pickerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    pickerSheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingTop: 16, maxHeight: "70%",
    },
    pickerTitle: {
      fontSize: 16, color: colors.foreground, fontFamily: "Inter_600SemiBold",
      paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    songRow: {
      padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    songTitle: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 },
  });

  const renderSlot = (slot: Slot) => {
    const t = tracks[slot];
    const isMuted = t.muted;
    const isSoloed = solo === slot;
    const isOtherSoloed = solo !== null && solo !== slot;
    const disabled = mode === "recording" || mode === "saving";

    return (
      <View style={s.slotCard}>
        <View style={s.slotHead}>
          <View style={s.slotLetter}>
            <Text style={s.slotLetterText}>{slot.toUpperCase()}</Text>
          </View>
          <Pressable style={[s.pickBtn, disabled && { opacity: 0.5 }]} onPress={() => !disabled && setPickerOpen(slot)}>
            <Feather name="music" size={13} color={colors.mutedForeground} />
            <Text style={[s.pickBtnText, !t.song && s.pickBtnPlaceholder]} numberOfLines={1}>
              {loadingSlot === slot ? "Loading…" : (t.song?.title || "Pick a track")}
            </Text>
            {t.song && (
              <Text style={[s.badge, {
                backgroundColor: t.song.source === "cloud" ? colors.primary + "30" : colors.muted,
                color: t.song.source === "cloud" ? colors.primary : colors.mutedForeground,
              }]}>{t.song.source}</Text>
            )}
            <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
          </Pressable>
          <View style={s.iconBtnRow}>
            <Pressable
              style={[s.iconBtn, isMuted && { borderColor: colors.destructive, backgroundColor: colors.destructive + "20" }]}
              onPress={() => toggleMute(slot)}
            >
              <Feather name={isMuted ? "volume-x" : "volume-2"} size={14} color={isMuted ? colors.destructive : colors.mutedForeground} />
            </Pressable>
            <Pressable
              style={[s.iconBtn, isSoloed && { borderColor: "#eab308", backgroundColor: "#eab30820" },
                isOtherSoloed && { opacity: 0.4 }]}
              onPress={() => toggleSolo(slot)}
            >
              <Feather name="zap" size={14} color={isSoloed ? "#eab308" : colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Volume · {Math.round(t.volume * 100)}%</Text>
          <View style={s.volRow}>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <Pressable key={v} style={[s.volBtn, Math.abs(t.volume - v) < 0.01 && { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]}
                onPress={() => setVolume(slot, v)}>
                <Text style={[s.volBtnText, Math.abs(t.volume - v) < 0.01 && { color: colors.primary }]}>{Math.round(v * 100)}</Text>
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

        {/* Save mix card (after recording) */}
        {mode === "saving" && (
          <View style={s.saveCard}>
            <Text style={s.saveTitle}>Save Your Mix</Text>
            <Text style={s.saveSubtitle}>Give it a name and it'll be added to your library.</Text>
            <TextInput
              style={s.input}
              placeholder="Mix title…"
              placeholderTextColor={colors.mutedForeground}
              value={mixTitle}
              onChangeText={setMixTitle}
              autoFocus
            />
            <View style={s.saveRow}>
              <Pressable
                style={[s.savePrimary, (!mixTitle.trim() || isSaving) && { opacity: 0.5 }]}
                onPress={handleSaveMix}
                disabled={!mixTitle.trim() || isSaving}
              >
                <Text style={s.savePrimaryText}>{isSaving ? "Saving…" : "Save to Library"}</Text>
              </Pressable>
              <Pressable style={s.saveSecondary} onPress={() => { setMode("idle"); recordingUriRef.current = null; }}>
                <Text style={s.saveSecondaryText}>Discard</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Global controls */}
        {mode !== "saving" && (
          <View style={s.globalCard}>
            <View style={s.section}>
              <Text style={s.globalLabel}>Fade In</Text>
              <View style={s.optionRow}>
                {FADE_OPTIONS.map((sec) => (
                  <Pressable key={sec} style={[s.optBtn, fadeIn === sec && { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]}
                    onPress={() => setFadeIn(sec)}>
                    <Text style={[s.optBtnText, fadeIn === sec && { color: colors.primary }]}>{sec}s</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={s.section}>
              <Text style={s.globalLabel}>Fade Out</Text>
              <View style={s.optionRow}>
                {FADE_OPTIONS.map((sec) => (
                  <Pressable key={sec} style={[s.optBtn, fadeOut === sec && { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]}
                    onPress={() => setFadeOut(sec)}>
                    <Text style={[s.optBtnText, fadeOut === sec && { color: colors.primary }]}>{sec}s</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={s.section}>
              <Text style={s.globalLabel}>Loop</Text>
              <View style={s.optionRow}>
                {(["Off", "On"] as const).map((opt) => {
                  const active = opt === "On" ? loop : !loop;
                  return (
                    <Pressable key={opt} style={[s.optBtn, active && { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]}
                      onPress={() => setLoop(opt === "On")}>
                      <Text style={[s.optBtnText, active && { color: colors.primary }]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Transport */}
        {mode !== "saving" && (
          <>
            {mode === "recording" && (
              <View style={s.recRow}>
                <View style={s.recDot} />
                <Text style={s.recLabel}>Recording mix…</Text>
              </View>
            )}
            <View style={s.transport}>
              {mode === "idle" && (
                <>
                  <Pressable style={[s.bigBtn, { backgroundColor: colors.primary }]} onPress={handlePlay}>
                    <Feather name="play" size={28} color="#000" />
                  </Pressable>
                  <Pressable style={[s.bigBtn, { backgroundColor: "#ef4444" }]} onPress={handleRecordMix}>
                    <Feather name="disc" size={28} color="#fff" />
                  </Pressable>
                </>
              )}
              {mode === "playing" && (
                <Pressable style={[s.bigBtn, { backgroundColor: colors.destructive }]} onPress={handleStop}>
                  <Feather name="square" size={28} color="#fff" />
                </Pressable>
              )}
              {mode === "recording" && (
                <Pressable style={[s.bigBtn, { backgroundColor: "#ef4444", borderWidth: 3, borderColor: "#fff" }]} onPress={handleStopRecording}>
                  <Feather name="square" size={28} color="#fff" />
                </Pressable>
              )}
            </View>
          </>
        )}
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
                  <Pressable key={song.key} style={s.songRow} onPress={async () => {
                    setPickerOpen(null);
                    if (pickerOpen) await loadTrack(pickerOpen, song);
                  }}>
                    <Text style={s.songTitle}>{song.title}</Text>
                    <Text style={[s.badge, {
                      backgroundColor: song.source === "cloud" ? colors.primary + "30" : colors.muted,
                      color: song.source === "cloud" ? colors.primary : colors.mutedForeground,
                    }]}>{song.source}</Text>
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
