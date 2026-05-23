import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { JsSlider as Slider } from "@/components/JsSlider";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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

import { useColors } from "@/hooks/useColors";
import { listLocalSongs, saveLocalSong, type LocalSong } from "@/lib/recordings";
import { useListSongs } from "@workspace/api-client-react";

type Slot = "a" | "b" | "c" | "d";
const SLOTS: Slot[] = ["a", "b", "c", "d"];
const SLOT_COLORS: Record<Slot, string> = { a: "#EAB308", b: "#10b981", c: "#ef4444", d: "#8b5cf6" };

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
    if (step >= steps) { clearInterval(interval); onDone?.(); }
  }, 40);
  return interval;
}

export default function MixerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
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

  const [trackCount, setTrackCount] = useState(2);
  const activeSlots = SLOTS.slice(0, trackCount);

  const [tracks, setTracks] = useState<Record<Slot, TrackState>>({
    a: { song: null, volume: 0.8, muted: false, sound: null },
    b: { song: null, volume: 0.8, muted: false, sound: null },
    c: { song: null, volume: 0.8, muted: false, sound: null },
    d: { song: null, volume: 0.8, muted: false, sound: null },
  });
  const [solo, setSolo] = useState<Slot | null>(null);
  const [mode, setMode] = useState<MixerMode>("idle");
  const [loop, setLoop] = useState(false);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [trackOffsets, setTrackOffsets] = useState<Record<Slot, number>>({ a: 0, b: 0, c: 0, d: 0 });
  const [loadingSlot, setLoadingSlot] = useState<Slot | null>(null);
  const [pickerOpen, setPickerOpen] = useState<Slot | null>(null);

  // Click track (visual metronome)
  const [clickEnabled, setClickEnabled] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [beatOn, setBeatOn] = useState(false);
  const beatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const startBeatVisual = () => {
    if (!clickEnabled) return;
    const ms = Math.max(200, (60 / Math.max(20, bpm)) * 1000);
    setBeatOn(true);
    beatIntervalRef.current = setInterval(() => setBeatOn(v => !v), ms);
  };

  const stopBeatVisual = () => {
    if (beatIntervalRef.current) { clearInterval(beatIntervalRef.current); beatIntervalRef.current = null; }
    setBeatOn(false);
  };

  useEffect(() => {
    return () => {
      clearFadeTimers();
      stopBeatVisual();
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
    try { await tracksRef.current[slot].sound?.unloadAsync(); } catch {}
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
    for (const s of SLOTS) {
      const t = tracksRef.current[s];
      if (!t.sound) continue;
      const eff = t.muted ? 0 : (newSolo && newSolo !== s ? 0 : t.volume);
      await t.sound.setVolumeAsync(eff).catch(() => {});
    }
  };

  const nudgeOffset = (slot: Slot, delta: number) => {
    setTrackOffsets(prev => ({
      ...prev,
      [slot]: Math.max(-10, Math.min(10, Math.round((prev[slot] + delta) * 4) / 4)),
    }));
  };

  // ── Playback helpers ─────────────────────────────────────────────────────────

  const startPlayback = async () => {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    for (const slot of activeSlots) {
      const sound = tracksRef.current[slot].sound;
      if (sound && loop) await sound.setIsLoopingAsync(true).catch(() => {});
    }

    for (const slot of activeSlots) {
      const sound = tracksRef.current[slot].sound;
      if (!sound) continue;
      const offset = trackOffsets[slot] ?? 0;

      const startSound = async () => {
        const posMs = offset < 0 ? Math.abs(offset) * 1000 : 0;
        await sound.setPositionAsync(posMs);
        if (fadeIn > 0) {
          await sound.setVolumeAsync(0); await sound.playAsync();
          fadeIntervals.current.push(rampVolume(sound, 0, effectiveVolume(slot), fadeIn * 1000));
        } else {
          await sound.setVolumeAsync(effectiveVolume(slot)); await sound.playAsync();
        }
      };

      if (offset > 0) {
        stopTimeouts.current.push(setTimeout(() => startSound().catch(() => {}), offset * 1000));
      } else {
        await startSound();
      }
    }
  };

  const stopPlayback = async () => {
    clearFadeTimers();
    stopBeatVisual();
    const activeSounds = activeSlots.map(s => tracksRef.current[s].sound).filter(Boolean) as Audio.Sound[];
    if (fadeOut > 0 && activeSounds.length > 0) {
      const vols = activeSlots.map(s => effectiveVolume(s));
      activeSounds.forEach((sound, i) => {
        fadeIntervals.current.push(rampVolume(sound, vols[i], 0, fadeOut * 1000));
      });
      await new Promise<void>((res) => setTimeout(res, fadeOut * 1000 + 80));
    }
    for (const slot of activeSlots) {
      const sound = tracksRef.current[slot].sound;
      if (!sound) continue;
      await sound.pauseAsync().catch(() => {});
      await sound.setVolumeAsync(effectiveVolume(slot)).catch(() => {});
    }
  };

  // ── Play / stop ───────────────────────────────────────────────────────────────

  const handlePlay = async () => {
    const hasTrack = activeSlots.some(s => tracksRef.current[s].sound);
    if (!hasTrack) { Alert.alert("No tracks loaded", "Pick at least one track first."); return; }
    clearFadeTimers();
    try {
      await startPlayback();
      startBeatVisual();
      setMode("playing");
    } catch {
      Alert.alert("Playback error", "Couldn't start playback. Try loading the tracks again.");
    }
  };

  const handleStop = async () => {
    await stopPlayback();
    setMode("idle");
  };

  // ── Record mix ────────────────────────────────────────────────────────────────

  const handleRecordMix = async () => {
    const hasTrack = activeSlots.some(s => tracksRef.current[s].sound);
    if (!hasTrack) { Alert.alert("No tracks loaded", "Pick at least one track to mix first."); return; }
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      Alert.alert("Microphone needed", "Grant microphone access in Settings to record your mix.");
      return;
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: { extension: ".m4a", outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 44100, numberOfChannels: 2, bitRate: 192000 },
        ios: { extension: ".m4a", outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.MAX, sampleRate: 44100, numberOfChannels: 2, bitRate: 192000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: {},
      });
      await rec.startAsync();
      recordingRef.current = rec;
      recordingStartRef.current = Date.now();
      await startPlayback();
      startBeatVisual();
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
    if (recordingUriRef.current) { setMixTitle(""); setMode("saving"); }
    else { setMode("idle"); Alert.alert("Nothing saved", "The recording came out empty. Try again."); }
  };

  const handleSaveMix = async () => {
    const uri = recordingUriRef.current;
    if (!uri || !mixTitle.trim()) return;
    setIsSaving(true);
    try {
      await saveLocalSong({ title: mixTitle.trim(), tags: "mix", notes: "", duration: recordingDurationRef.current, sourceUri: uri, mimeType: "audio/mp4" });
      const updated = await listLocalSongs();
      setLocalSongs(updated);
      Alert.alert("Saved!", `"${mixTitle.trim()}" is now in your library.`);
      setMode("idle"); recordingUriRef.current = null;
    } catch {
      Alert.alert("Save failed", "Could not save the mix. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 },
    slotCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 16, marginBottom: 10, gap: 10 },
    slotHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    slotLetter: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "30", alignItems: "center", justifyContent: "center" },
    slotLetterText: { color: colors.primary, fontFamily: "Inter_700Bold", fontWeight: "700" },
    pickBtn: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.muted, flexDirection: "row", alignItems: "center", gap: 6 },
    pickBtnText: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 },
    pickBtnPlaceholder: { color: colors.mutedForeground },
    badge: { fontSize: 10, fontFamily: "Inter_600SemiBold", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
    iconBtnRow: { flexDirection: "row", gap: 6 },
    iconBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    section: { gap: 4 },
    sectionLabel: { fontSize: 10, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Inter_600SemiBold" },
    volRow: { flexDirection: "row", gap: 4 },
    volBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    volBtnText: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" },
    offsetRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    nudgeBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    nudgeBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    offsetDisplay: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    offsetDisplayText: { fontSize: 12, fontFamily: "Inter_700Bold" },
    globalCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 16, marginBottom: 10, gap: 12 },
    globalLabel: { fontSize: 11, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Inter_600SemiBold" },
    optionRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    optBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
    optBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    transport: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 4 },
    bigBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444", marginRight: 6 },
    recLabel: { color: "#ef4444", fontFamily: "Inter_600SemiBold", fontSize: 13 },
    recRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
    saveCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary + "50", borderRadius: colors.radius, padding: 20, marginBottom: 12, gap: 12 },
    saveTitle: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 },
    saveSubtitle: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14, backgroundColor: colors.background },
    saveRow: { flexDirection: "row", gap: 10 },
    savePrimary: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center" },
    savePrimaryText: { color: "#000", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    saveSecondary: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    saveSecondaryText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 },
    pickerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    pickerSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, maxHeight: "70%" },
    pickerTitle: { fontSize: 16, color: colors.foreground, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    songRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
    songTitle: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 },
    trackCountRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 4 },
    trackCountBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
    trackCountBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  });

  const renderSlot = (slot: Slot) => {
    const t = tracks[slot];
    const isMuted = t.muted;
    const isSoloed = solo === slot;
    const isOtherSoloed = solo !== null && solo !== slot;
    const disabled = mode === "recording" || mode === "saving";
    const slotColor = SLOT_COLORS[slot];
    const offset = trackOffsets[slot] ?? 0;

    return (
      <View style={s.slotCard} key={slot}>
        <View style={s.slotHead}>
          <View style={[s.slotLetter, { backgroundColor: slotColor + "30" }]}>
            <Text style={[s.slotLetterText, { color: slotColor }]}>{slot.toUpperCase()}</Text>
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
              style={[s.iconBtn, isSoloed && { borderColor: "#eab308", backgroundColor: "#eab30820" }, isOtherSoloed && { opacity: 0.4 }]}
              onPress={() => toggleSolo(slot)}
            >
              <Feather name="zap" size={14} color={isSoloed ? "#eab308" : colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Volume · {Math.round(t.volume * 100)}%</Text>
          <Slider
            style={{ width: "100%", height: 36 }}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={t.volume}
            onValueChange={(v) => setVolume(slot, v)}
            minimumTrackTintColor={slotColor}
            maximumTrackTintColor={colors.border}
            thumbTintColor={slotColor}
          />
          <View style={s.volRow}>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <Pressable
                key={v}
                style={[s.volBtn, Math.abs(t.volume - v) < 0.01 && { borderColor: slotColor, backgroundColor: slotColor + "20" }]}
                onPress={() => setVolume(slot, v)}
              >
                <Text style={[s.volBtnText, Math.abs(t.volume - v) < 0.01 && { color: slotColor }]}>{Math.round(v * 100)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Per-track offset nudge (non-A tracks only) */}
        {slot !== "a" && t.sound && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Timing vs A</Text>
            <View style={s.offsetRow}>
              <Pressable style={s.nudgeBtn} onPress={() => nudgeOffset(slot, -1)}><Text style={s.nudgeBtnText}>−1s</Text></Pressable>
              <Pressable style={s.nudgeBtn} onPress={() => nudgeOffset(slot, -0.25)}><Text style={s.nudgeBtnText}>−¼</Text></Pressable>
              <Pressable style={[s.offsetDisplay, { borderColor: offset === 0 ? colors.border : slotColor }]} onPress={() => setTrackOffsets(p => ({ ...p, [slot]: 0 }))}>
                <Text style={[s.offsetDisplayText, { color: offset === 0 ? colors.mutedForeground : slotColor }]}>
                  {offset === 0 ? "in sync" : offset > 0 ? `+${offset.toFixed(2)}s` : `${offset.toFixed(2)}s`}
                </Text>
              </Pressable>
              <Pressable style={s.nudgeBtn} onPress={() => nudgeOffset(slot, 0.25)}><Text style={s.nudgeBtnText}>+¼</Text></Pressable>
              <Pressable style={s.nudgeBtn} onPress={() => nudgeOffset(slot, 1)}><Text style={s.nudgeBtnText}>+1s</Text></Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

  const anyLoaded = activeSlots.some(s => tracks[s].sound);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Track count selector */}
        {mode === "idle" && (
          <View style={s.globalCard}>
            <Text style={s.globalLabel}>Tracks to Mix</Text>
            <View style={s.trackCountRow}>
              {[2, 3, 4].map(n => (
                <Pressable
                  key={n}
                  style={[s.trackCountBtn, { borderColor: trackCount === n ? colors.primary : colors.border, backgroundColor: trackCount === n ? colors.primary + "20" : "transparent" }]}
                  onPress={() => setTrackCount(n)}
                >
                  <Text style={[s.trackCountBtnText, { color: trackCount === n ? colors.primary : colors.mutedForeground }]}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Track slots */}
        {activeSlots.map(slot => renderSlot(slot))}

        {/* Save mix card */}
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
                  <Pressable key={sec} style={[s.optBtn, fadeIn === sec && { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]} onPress={() => setFadeIn(sec)}>
                    <Text style={[s.optBtnText, fadeIn === sec && { color: colors.primary }]}>{sec}s</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={s.section}>
              <Text style={s.globalLabel}>Fade Out</Text>
              <View style={s.optionRow}>
                {FADE_OPTIONS.map((sec) => (
                  <Pressable key={sec} style={[s.optBtn, fadeOut === sec && { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]} onPress={() => setFadeOut(sec)}>
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
                    <Pressable key={opt} style={[s.optBtn, active && { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]} onPress={() => setLoop(opt === "On")}>
                      <Text style={[s.optBtnText, active && { color: colors.primary }]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {/* Click track */}
            <View style={s.section}>
              <Text style={s.globalLabel}>Click Track</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={s.optionRow}>
                  {(["Off", "On"] as const).map((opt) => {
                    const active = opt === "On" ? clickEnabled : !clickEnabled;
                    return (
                      <Pressable key={opt} style={[s.optBtn, active && { borderColor: "#f97316", backgroundColor: "#f9731620" }]} onPress={() => setClickEnabled(opt === "On")}>
                        <Text style={[s.optBtnText, active && { color: "#f97316" }]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {clickEnabled && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pressable onPress={() => setBpm(b => Math.max(20, b - 5))} style={[s.nudgeBtn, { paddingHorizontal: 8 }]}>
                      <Text style={s.nudgeBtnText}>−</Text>
                    </Pressable>
                    <Text style={{ fontFamily: "Inter_700Bold", color: "#f97316", fontSize: 14, minWidth: 44, textAlign: "center" }}>{bpm}</Text>
                    <Pressable onPress={() => setBpm(b => Math.min(300, b + 5))} style={[s.nudgeBtn, { paddingHorizontal: 8 }]}>
                      <Text style={s.nudgeBtnText}>+</Text>
                    </Pressable>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>BPM</Text>
                  </View>
                )}
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
                {clickEnabled && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, marginLeft: 10, backgroundColor: beatOn ? "#f97316" : "transparent", borderWidth: 1, borderColor: "#f97316" }} />
                )}
              </View>
            )}
            {mode === "playing" && clickEnabled && (
              <View style={{ alignItems: "center", marginBottom: 6 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: beatOn ? "#f97316" : "transparent", borderWidth: 1.5, borderColor: "#f97316" }} />
              </View>
            )}
            <View style={s.transport}>
              {mode === "idle" && (
                <>
                  <Pressable style={[s.bigBtn, { backgroundColor: colors.primary, opacity: anyLoaded ? 1 : 0.4 }]} onPress={handlePlay}>
                    <Feather name="play" size={28} color="#000" />
                  </Pressable>
                  <Pressable style={[s.bigBtn, { backgroundColor: "#ef4444", opacity: anyLoaded ? 1 : 0.4 }]} onPress={handleRecordMix}>
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
