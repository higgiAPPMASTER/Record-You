import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getLocalSong, updateLocalSong, type LocalSong } from "@/lib/recordings";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
}

export default function TrimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [song, setSong] = useState<LocalSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const stopAtRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;
    getLocalSong(String(id)).then((s) => {
      if (s) {
        setSong(s);
        setTrimStart(s.trimStart ?? 0);
        setTrimEnd(s.trimEnd ?? s.duration);
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stopPreview = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    await sound.pauseAsync().catch(() => {});
    setIsPlaying(false);
  }, []);

  const handlePreview = async () => {
    if (!song) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isPlaying) {
      await stopPreview();
      return;
    }

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: song.uri },
          { shouldPlay: false }
        );
        soundRef.current = sound;
      }

      stopAtRef.current = trimEnd;
      const sound = soundRef.current;
      await sound.setPositionAsync(trimStart * 1000);
      await sound.playAsync();
      setIsPlaying(true);
      setPosition(trimStart);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        const pos = status.positionMillis / 1000;
        setPosition(pos);
        if (pos >= stopAtRef.current || status.didJustFinish) {
          sound.pauseAsync().catch(() => {});
          setIsPlaying(false);
          setPosition(trimStart);
        }
      });
    } catch {
      Alert.alert("Playback error", "Could not preview this section.");
      setIsPlaying(false);
    }
  };

  const handleSave = async () => {
    if (!song) return;
    setSaving(true);
    try {
      await stopPreview();
      const updated = await updateLocalSong(song.id, { trimStart, trimEnd });
      if (updated) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch {
      Alert.alert("Save failed", "Could not save trim points.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!song) return;
    await stopPreview();
    setTrimStart(0);
    setTrimEnd(song.duration);
    await updateLocalSong(song.id, { trimStart: 0, trimEnd: song.duration });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const duration = song?.duration ?? 1;
  const trimmedDuration = trimEnd - trimStart;
  const startPct = trimStart / duration;
  const endPct = trimEnd / duration;
  const progressPct =
    isPlaying && duration > 0
      ? Math.max(0, Math.min(1, (position - trimStart) / Math.max(0.001, trimmedDuration)))
      : 0;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: "row", alignItems: "center",
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
      paddingHorizontal: 16, paddingBottom: 8, gap: 4,
    },
    topBarTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    scroll: { padding: 20, paddingBottom: 60 },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
    cardTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
    previewBtn: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16,
    },
    progressTrack: { height: 4, backgroundColor: colors.muted, borderRadius: 2, marginBottom: 8 },
    progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
    timeRow: { flexDirection: "row", justifyContent: "space-between" },
    timeText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    regionBarWrap: { height: 48, backgroundColor: colors.muted, borderRadius: 8, overflow: "hidden", marginBottom: 4 },
    regionInactive: { position: "absolute", top: 0, bottom: 0, backgroundColor: colors.background + "cc" },
    regionActive: { position: "absolute", top: 0, bottom: 0, backgroundColor: colors.primary + "40", borderWidth: 2, borderColor: colors.primary },
    regionLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", marginBottom: 12 },
    sliderRow: { marginBottom: 4 },
    sliderLabel: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    sliderLabelText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    sliderLabelTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.primary },
    btnRow: { flexDirection: "row", gap: 12, marginTop: 4 },
    resetBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    resetBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    saveBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
    saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#000" },
    durationBadge: { alignSelf: "center", marginBottom: 16, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.primary + "20" },
    durationBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primary },
  });

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!song) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Track not found.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <Pressable onPress={() => { stopPreview(); router.back(); }} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.topBarTitle} numberOfLines={1}>Trim · {song.title}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Preview player */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Preview Trimmed Section</Text>
          <Pressable style={s.previewBtn} onPress={handlePreview}>
            <Feather name={isPlaying ? "square" : "play"} size={26} color="#000" />
          </Pressable>
          <View style={s.durationBadge}>
            <Text style={s.durationBadgeText}>{fmt(trimmedDuration)} selected</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct * 100}%` as any }]} />
          </View>
          <View style={s.timeRow}>
            <Text style={s.timeText}>{fmt(trimStart)}</Text>
            <Text style={s.timeText}>{fmt(trimEnd)}</Text>
          </View>
        </View>

        {/* Visual region */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Trim Region</Text>
          <View style={s.regionBarWrap}>
            {/* left grey */}
            <View style={[s.regionInactive, { left: 0, width: `${startPct * 100}%` as any }]} />
            {/* selected region */}
            <View style={[s.regionActive, { left: `${startPct * 100}%` as any, right: `${(1 - endPct) * 100}%` as any }]} />
            {/* right grey */}
            <View style={[s.regionInactive, { right: 0, width: `${(1 - endPct) * 100}%` as any }]} />
          </View>
          <Text style={s.regionLabel}>
            Full track: {fmt(duration)} · Trim: {fmt(trimStart)} → {fmt(trimEnd)}
          </Text>

          {/* Start slider */}
          <View style={s.sliderRow}>
            <View style={s.sliderLabel}>
              <Text style={s.sliderLabelText}>Start</Text>
              <Text style={s.sliderLabelTime}>{fmt(trimStart)}</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 36 }}
              minimumValue={0}
              maximumValue={Math.max(0, trimEnd - 0.5)}
              step={0.1}
              value={trimStart}
              onValueChange={(v) => {
                setTrimStart(parseFloat(v.toFixed(1)));
              }}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>

          {/* End slider */}
          <View style={s.sliderRow}>
            <View style={s.sliderLabel}>
              <Text style={s.sliderLabelText}>End</Text>
              <Text style={s.sliderLabelTime}>{fmt(trimEnd)}</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 36 }}
              minimumValue={Math.min(duration, trimStart + 0.5)}
              maximumValue={duration}
              step={0.1}
              value={trimEnd}
              onValueChange={(v) => {
                setTrimEnd(parseFloat(v.toFixed(1)));
              }}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={s.btnRow}>
          <Pressable style={s.resetBtn} onPress={handleReset}>
            <Text style={s.resetBtnText}>Reset</Text>
          </Pressable>
          <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#000" size="small" />
              : <Feather name="check" size={18} color="#000" />}
            <Text style={s.saveBtnText}>{saving ? "Saving..." : "Save Trim"}</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}
