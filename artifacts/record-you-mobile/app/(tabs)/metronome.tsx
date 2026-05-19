import { Minus, Play, Plus, Square } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const MIN_BPM = 40;
const MAX_BPM = 240;
const BEATS = 4;

export default function MetronomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [bpm, setBpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);

  const tapTimesRef = useRef<number[]>([]);

  const tick = () => {
    const b = beatRef.current % BEATS;
    setBeat(b);
    beatRef.current += 1;
    Haptics.impactAsync(
      b === 0
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light
    );
  };

  useEffect(() => {
    if (isRunning) {
      beatRef.current = 0;
      tick();
      intervalRef.current = setInterval(tick, (60 / bpm) * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setBeat(-1);
      beatRef.current = 0;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, bpm]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning((r) => !r);
  };

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = Date.now();
    tapTimesRef.current = [...tapTimesRef.current.slice(-7), now];
    const times = tapTimesRef.current;
    if (times.length >= 2) {
      const diffs = times.slice(1).map((t, i) => t - times[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const newBpm = Math.round(60000 / avg);
      if (newBpm >= MIN_BPM && newBpm <= MAX_BPM) {
        setBpm(newBpm);
      }
    }
  };

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
    center: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
      gap: 32,
    },
    bpmDisplay: {
      alignItems: "center" as const,
    },
    bpmNumber: {
      fontSize: 80,
      fontWeight: "300" as const,
      color: isRunning ? colors.primary : colors.foreground,
      fontFamily: "Inter_400Regular",
      letterSpacing: -2,
    },
    bpmLabel: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      textTransform: "uppercase" as const,
      letterSpacing: 2,
    },
    beatsRow: {
      flexDirection: "row" as const,
      gap: 12,
    },
    beatDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    slider: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 16,
      paddingHorizontal: 32,
      width: "100%" as any,
    },
    sliderLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      width: 30,
    },
    sliderTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.muted,
      borderRadius: 3,
    },
    sliderFill: {
      height: 6,
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    btnRow: {
      flexDirection: "row" as const,
      gap: 16,
    },
    toggleBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    tapBtn: {
      width: 120,
      height: 56,
      borderRadius: colors.radius,
      backgroundColor: colors.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    tapText: {
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    adjustRow: {
      flexDirection: "row" as const,
      gap: 12,
    },
    adjustBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
  });

  const pct = (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Metronome</Text>
        <Text style={styles.headerSub}>Keep the beat</Text>
      </View>

      <View style={styles.center}>
        <View style={styles.bpmDisplay}>
          <Text style={styles.bpmNumber}>{bpm}</Text>
          <Text style={styles.bpmLabel}>BPM</Text>
        </View>

        <View style={styles.beatsRow}>
          {Array.from({ length: BEATS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.beatDot,
                {
                  backgroundColor:
                    isRunning && beat === i
                      ? i === 0
                        ? colors.primary
                        : colors.primary + "aa"
                      : colors.muted,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.slider}>
          <Text style={styles.sliderLabel}>{MIN_BPM}</Text>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${pct * 100}%` as any }]} />
          </View>
          <Text style={[styles.sliderLabel, { textAlign: "right" as const }]}>
            {MAX_BPM}
          </Text>
        </View>

        <View style={styles.adjustRow}>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => setBpm((b) => Math.max(MIN_BPM, b - 5))}
          >
            <Minus size={20} color={colors.foreground} />
          </Pressable>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => setBpm((b) => Math.max(MIN_BPM, b - 1))}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>-1</Text>
          </Pressable>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => setBpm((b) => Math.min(MAX_BPM, b + 1))}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>+1</Text>
          </Pressable>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => setBpm((b) => Math.min(MAX_BPM, b + 5))}
          >
            <Plus size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.btnRow}>
          <Pressable
            style={[
              styles.toggleBtn,
              { backgroundColor: isRunning ? colors.destructive : colors.primary },
            ]}
            onPress={handleToggle}
          >
            {isRunning ? (
              <Square size={28} color="#fff" />
            ) : (
              <Play size={28} color="#fff" />
            )}
          </Pressable>
          <Pressable style={styles.tapBtn} onPress={handleTap}>
            <Text style={styles.tapText}>Tap Tempo</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
