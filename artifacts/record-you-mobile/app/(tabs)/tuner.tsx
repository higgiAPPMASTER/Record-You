import React, { useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";

type PitchData = {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  inTune: boolean;
};

const TUNER_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;background:transparent;">
<script>
var NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
var A4 = 440, A4_MIDI = 69;

function detectPitch(buf, sr) {
  var N = buf.length, M = Math.floor(N / 2);
  var rms = 0;
  for (var i = 0; i < N; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / N) < 0.01) return null;
  var c = new Float32Array(M);
  for (var lag = 0; lag < M; lag++) {
    var s = 0;
    for (var j = 0; j < N - lag; j++) s += buf[j] * buf[j + lag];
    c[lag] = s;
  }
  if (c[0] <= 0) return null;
  var d = 0;
  while (d < M - 2 && c[d] >= c[d + 1]) d++;
  for (var k = d + 1; k < M - 1; k++) {
    if (c[k] >= c[k - 1] && c[k] > c[k + 1] && c[k] / c[0] >= 0.35) {
      var x1 = c[k - 1], x2 = c[k], x3 = c[k + 1];
      var den = x1 + x3 - 2 * x2;
      var peak = den ? k - (x3 - x1) / (2 * den) : k;
      var f = sr / peak;
      return (f >= 30 && f <= 8000) ? f : null;
    }
  }
  return null;
}

function freqToNote(f) {
  var midi = 12 * Math.log2(f / A4) + A4_MIDI;
  var r = Math.round(midi);
  var cents = Math.round((midi - r) * 100);
  return {
    note: NOTE_NAMES[((r % 12) + 12) % 12],
    octave: Math.floor(r / 12) - 1,
    frequency: Math.round(f * 10) / 10,
    cents: cents,
    inTune: Math.abs(cents) <= 8
  };
}

var ctx, analyser, buf, raf;
var hold = 0;
var HOLD = 6;

function tick() {
  analyser.getFloatTimeDomainData(buf);
  var f = detectPitch(buf, ctx.sampleRate);
  if (f !== null) {
    hold = 0;
    var r = freqToNote(f);
    window.ReactNativeWebView.postMessage(JSON.stringify({type: "pitch", note: r.note, octave: r.octave, frequency: r.frequency, cents: r.cents, inTune: r.inTune}));
  } else if (++hold >= HOLD) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type: "silence"}));
  }
  raf = requestAnimationFrame(tick);
}

navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}})
  .then(function(stream) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 44100});
    analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0;
    buf = new Float32Array(analyser.fftSize);
    ctx.createMediaStreamSource(stream).connect(analyser);
    raf = requestAnimationFrame(tick);
    window.ReactNativeWebView.postMessage(JSON.stringify({type: "started"}));
  })
  .catch(function(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type: "error", message: String(e)}));
  });
</script>
</body>
</html>
`;

function CentsNeedle({ cents, inTune, colors }: { cents: number; inTune: boolean; colors: ReturnType<typeof useColors> }) {
  const TRACK_W = 240;
  const TRACK_H = 8;
  const needlePct = Math.max(0, Math.min(1, (cents + 50) / 100));
  const needleX = needlePct * TRACK_W;
  const goldColor = colors.primary;

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View style={{ width: TRACK_W, height: TRACK_H, borderRadius: 4, backgroundColor: colors.muted, overflow: "hidden", position: "relative" }}>
        <View style={{
          position: "absolute",
          left: TRACK_W * 0.4,
          width: TRACK_W * 0.2,
          height: TRACK_H,
          backgroundColor: inTune ? goldColor + "55" : colors.border,
        }} />
        <View style={{
          position: "absolute",
          left: needleX - 2,
          top: -2,
          width: 4,
          height: TRACK_H + 4,
          borderRadius: 2,
          backgroundColor: inTune ? goldColor : colors.foreground,
        }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: TRACK_W }}>
        <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>−50¢</Text>
        <Text style={{ fontSize: 10, color: inTune ? goldColor : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }}>
          {inTune ? "IN TUNE" : cents > 0 ? `+${cents}¢ sharp` : `${cents}¢ flat`}
        </Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>+50¢</Text>
      </View>
    </View>
  );
}

export default function TunerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [pitch, setPitch] = useState<PitchData | null>(null);
  const [status, setStatus] = useState<"loading" | "listening" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const webviewRef = useRef<WebView | null>(null);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "started") {
        setStatus("listening");
      } else if (msg.type === "pitch") {
        setPitch({ note: msg.note, octave: msg.octave, frequency: msg.frequency, cents: msg.cents, inTune: msg.inTune });
      } else if (msg.type === "silence") {
        setPitch(null);
      } else if (msg.type === "error") {
        setStatus("error");
        setErrorMsg(msg.message || "Microphone access denied");
      }
    } catch {}
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
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
      gap: 24,
    },
    noteName: {
      fontSize: 120,
      fontWeight: "300" as const,
      fontFamily: "Inter_400Regular",
      letterSpacing: -4,
    },
    noteDetail: {
      fontSize: 18,
      fontFamily: "Inter_400Regular",
    },
    placeholderText: {
      fontSize: 18,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    statusText: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      letterSpacing: 1,
      textTransform: "uppercase" as const,
    },
  });

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tuner</Text>
          <Text style={styles.headerSub}>Chromatic tuner</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.placeholderText}>Use the web app tuner on desktop.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tuner</Text>
        <Text style={styles.headerSub}>Chromatic tuner — play any note</Text>
      </View>

      <WebView
        ref={webviewRef}
        source={{ html: TUNER_HTML }}
        onMessage={handleMessage}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        {...({
          mediaCapturePermissionGrantType: "grantIfSameHostElsePrompt",
          onPermissionRequest: (request: any) => { request.grant(request.resources); },
        } as any)}
      />

      <View style={styles.center}>
        {status === "loading" && (
          <Text style={styles.statusText}>Starting microphone…</Text>
        )}

        {status === "error" && (
          <View style={{ alignItems: "center", gap: 8, paddingHorizontal: 32 }}>
            <Text style={[styles.noteName, { fontSize: 48, color: colors.mutedForeground }]}>!</Text>
            <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              {errorMsg || "Microphone access required"}
            </Text>
          </View>
        )}

        {status === "listening" && !pitch && (
          <>
            <Text style={[styles.noteName, { color: colors.border, fontSize: 100 }]}>—</Text>
            <Text style={styles.statusText}>Play a note</Text>
          </>
        )}

        {status === "listening" && pitch && (
          <>
            <Text style={[styles.noteName, { color: pitch.inTune ? colors.primary : colors.foreground }]}>
              {pitch.note}
            </Text>
            <Text style={[styles.noteDetail, { color: pitch.inTune ? colors.primary : colors.mutedForeground }]}>
              {pitch.note}{pitch.octave} • {pitch.frequency} Hz
            </Text>
            <CentsNeedle cents={pitch.cents} inTune={pitch.inTune} colors={colors} />
          </>
        )}
      </View>
    </View>
  );
}
