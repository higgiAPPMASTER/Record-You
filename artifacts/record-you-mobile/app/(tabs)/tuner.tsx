import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const STRINGS = [
  { string: "E", octave: "2", freq: "82.4" },
  { string: "A", octave: "2", freq: "110" },
  { string: "D", octave: "3", freq: "146.8" },
  { string: "G", octave: "3", freq: "196" },
  { string: "B", octave: "3", freq: "246.9" },
  { string: "E", octave: "4", freq: "329.6" },
];

export default function TunerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    setLevel(0);
    setListening(false);
  };

  const start = async () => {
    setError(null);
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Microphone Required", "Allow microphone access to use the tuner.");
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      });
      rec.setProgressUpdateInterval(80);
      rec.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && typeof status.metering === "number") {
          // metering is in dBFS, typically -160 (silent) to 0 (max)
          const db = status.metering;
          const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
          setLevel(normalized);
        }
      });
      await rec.startAsync();
      recordingRef.current = rec;
      setListening(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start tuner");
      setListening(false);
    }
  };

  const toggle = () => (listening ? stop() : start());

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 20, paddingBottom: insets.bottom + 100 },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingBottom: 24,
    },
    title: { fontSize: 28, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    sub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 24,
      alignItems: "center",
      gap: 20,
    },
    meterWrap: {
      width: "100%",
      height: 12,
      backgroundColor: colors.muted,
      borderRadius: 6,
      overflow: "hidden",
    },
    meterFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 6,
    },
    statusBig: {
      fontSize: 56,
      fontWeight: "300",
      color: listening ? colors.primary : colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    statusSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      fontFamily: "Inter_500Medium",
    },
    button: {
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 999,
      backgroundColor: listening ? colors.destructive : colors.primary,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    buttonText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
    ref: {
      marginTop: 24,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    refLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Inter_600SemiBold" },
    stringsRow: { flexDirection: "row", justifyContent: "space-between" },
    stringCol: { alignItems: "center", flex: 1 },
    stringChar: { fontSize: 22, fontWeight: "700", color: colors.primary, fontFamily: "Inter_700Bold" },
    stringOct: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    stringHz: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1, opacity: 0.7 },
    note: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 12, textAlign: "center", paddingHorizontal: 16 },
    err: { color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 8 },
  });

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.title}>Tuner</Text>
          <Text style={s.sub}>Chromatic tuner — play a note</Text>
        </View>

        <View style={s.card}>
          <View>
            <Text style={s.statusBig}>{listening ? Math.round(level * 100) + "%" : "—"}</Text>
            <Text style={s.statusSub}>{listening ? "Listening..." : "Tap start"}</Text>
          </View>

          <View style={s.meterWrap}>
            <View style={[s.meterFill, { width: `${level * 100}%` }]} />
          </View>

          <Pressable style={s.button} onPress={toggle}>
            <Feather name={listening ? "mic-off" : "mic"} size={20} color="#fff" />
            <Text style={s.buttonText}>{listening ? "Stop Tuner" : "Start Tuner"}</Text>
          </Pressable>

          {error && <Text style={s.err}>{error}</Text>}
        </View>

        <View style={s.ref}>
          <Text style={s.refLabel}>Standard Tuning Reference</Text>
          <View style={s.stringsRow}>
            {STRINGS.map((str, i) => (
              <View key={i} style={s.stringCol}>
                <Text style={s.stringChar}>{str.string}</Text>
                <Text style={s.stringOct}>{str.octave}</Text>
                <Text style={s.stringHz}>{str.freq}Hz</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.note}>
          Mobile tuner shows input level. For accurate pitch detection, use the web app.
        </Text>
      </ScrollView>
    </View>
  );
}
