import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
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

import { useColors } from "@/hooks/useColors";
import { saveLocalSong } from "@/lib/recordings";

type RecordingState = "idle" | "recording" | "paused" | "done";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export default function StudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [level, setLevel] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingUriRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleRecord = async () => {
    if (state === "idle" || state === "done") {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Microphone Required",
          "Allow microphone access in Settings to record audio."
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      try {
        await recording.prepareToRecordAsync({
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        });
        recording.setProgressUpdateInterval(80);
        recording.setOnRecordingStatusUpdate((status) => {
          if (status.isRecording && typeof status.metering === "number") {
            // metering is dBFS (-160..0). Map to 0..1.
            const db = status.metering;
            const norm = Math.max(0, Math.min(1, (db + 60) / 60));
            setLevel(norm);
          }
        });
        await recording.startAsync();
        recordingRef.current = recording;
        recordingUriRef.current = null;
        setElapsed(0);
        setLevel(0);
        setState("recording");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        startTimer();
      } catch {
        Alert.alert("Error", "Failed to start recording.");
      }
    } else if (state === "recording") {
      await recordingRef.current?.pauseAsync();
      stopTimer();
      setLevel(0);
      setState("paused");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (state === "paused") {
      await recordingRef.current?.startAsync();
      startTimer();
      setState("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleStop = async () => {
    stopTimer();
    try {
      await recordingRef.current?.stopAndUnloadAsync();
      const uri = recordingRef.current?.getURI() ?? null;
      recordingUriRef.current = uri;
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      setLevel(0);
      setState("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to stop recording.");
      setState("idle");
    }
  };

  const handleDiscard = () => {
    recordingUriRef.current = null;
    setElapsed(0);
    setTitle("");
    setTags("");
    setNotes("");
    setState("idle");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async () => {
    if (!recordingUriRef.current) return;
    if (!title.trim()) {
      Alert.alert("Title required", "Give your track a name before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/webm";
      await saveLocalSong({
        title: title.trim(),
        tags: tags.trim(),
        notes: notes.trim(),
        duration: elapsed,
        sourceUri: recordingUriRef.current,
        mimeType,
      });

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      handleDiscard();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Save failed", "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
    },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
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
    timerBox: {
      alignItems: "center" as const,
      paddingVertical: 32,
    },
    meterWrap: {
      width: "100%" as const,
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    meterTrack: {
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.muted,
      overflow: "hidden" as const,
      borderWidth: 1,
      borderColor: colors.border,
    },
    meterFill: {
      height: "100%" as const,
      borderRadius: 7,
    },
    meterLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
      textAlign: "center" as const,
      marginTop: 6,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
      fontFamily: "Inter_500Medium",
    },
    timer: {
      fontSize: 56,
      fontWeight: "300" as const,
      color: state === "recording" ? colors.primary : colors.foreground,
      fontFamily: "Inter_400Regular",
      letterSpacing: 4,
    },
    statusText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 8,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
      fontFamily: "Inter_500Medium",
    },
    controlRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 24,
      marginBottom: 32,
    },
    recBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    secondaryBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
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
    saveRow: {
      flexDirection: "row" as const,
      gap: 10,
    },
    discardBtn: {
      flex: 1,
      height: 48,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    saveBtn: {
      flex: 2,
      height: 48,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      gap: 8,
    },
    saveBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    discardText: {
      color: colors.mutedForeground,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    savedBanner: {
      backgroundColor: colors.primary + "20",
      borderRadius: colors.radius,
      padding: 12,
      alignItems: "center" as const,
      marginBottom: 12,
    },
    savedText: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
  });

  const recColor =
    state === "recording"
      ? colors.destructive
      : state === "paused"
      ? colors.primary
      : colors.primary;

  const recIcon =
    state === "recording" ? "pause" : state === "paused" ? "play" : "mic";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Studio</Text>
          <Text style={styles.headerSub}>Capture your ideas</Text>
        </View>

        {savedMsg && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>Track saved to Library</Text>
          </View>
        )}

        <View style={styles.timerBox}>
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>
          <Text style={styles.statusText}>
            {state === "idle"
              ? "Ready to record"
              : state === "recording"
              ? "Recording..."
              : state === "paused"
              ? "Paused"
              : "Recording done"}
          </Text>
        </View>

        {(state === "recording" || state === "paused") && (
          <View style={styles.meterWrap}>
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${Math.round(level * 100)}%`,
                    backgroundColor:
                      level > 0.85
                        ? colors.destructive
                        : level > 0.5
                        ? "#facc15"
                        : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.meterLabel}>Input Level</Text>
          </View>
        )}

        <View style={styles.controlRow}>
          {(state === "recording" || state === "paused") && (
            <Pressable style={styles.secondaryBtn} onPress={handleStop}>
              <Feather name="square" size={22} color={colors.destructive} />
            </Pressable>
          )}
          <Pressable
            testID="button-record"
            style={[styles.recBtn, { backgroundColor: recColor }]}
            onPress={handleRecord}
          >
            <Feather name={recIcon} size={32} color="#fff" />
          </Pressable>
          {state === "done" && (
            <Pressable style={styles.secondaryBtn} onPress={handleDiscard}>
              <Feather name="refresh-ccw" size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {state === "done" && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Late night acoustic idea"
                placeholderTextColor={colors.mutedForeground}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Tags (comma separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="acoustic, draft, verse"
                placeholderTextColor={colors.mutedForeground}
                value={tags}
                onChangeText={setTags}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                placeholder="Capo 3rd fret. Chorus needs work..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.saveRow}>
              <Pressable style={styles.discardBtn} onPress={handleDiscard}>
                <Text style={styles.discardText}>Discard</Text>
              </Pressable>
              <Pressable
                testID="button-save-track"
                style={[styles.saveBtn, (!title.trim() || isSaving) && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={!title.trim() || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="save" size={18} color="#fff" />
                )}
                <Text style={styles.saveBtnText}>
                  {isSaving ? "Saving..." : "Save Track"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
