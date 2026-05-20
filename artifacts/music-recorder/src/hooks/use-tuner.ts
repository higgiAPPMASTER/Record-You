import { useState, useRef, useCallback, useEffect } from "react";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A4_FREQ = 440;
const A4_MIDI = 69;

export interface TunerResult {
  note: string;       // e.g. "A"
  octave: number;     // e.g. 4
  frequency: number;  // detected Hz
  cents: number;      // -50 to +50, 0 = perfectly in tune
  inTune: boolean;    // within ±8 cents
}

function freqToNote(freq: number): TunerResult {
  const midi = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return {
    note: NOTE_NAMES[noteIndex],
    octave,
    frequency: Math.round(freq * 10) / 10,
    cents,
    inTune: Math.abs(cents) <= 8,
  };
}

// Autocorrelation-based pitch detection.
// Key fix: find the FIRST local peak above threshold, not the highest overall peak.
// Finding the global max picks octave errors (2× period often has higher correlation).
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  const MAX_LAG = Math.floor(SIZE / 2);

  // RMS energy check — bail on silence
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.005) return null;

  // Standard autocorrelation
  const c = new Float32Array(MAX_LAG);
  for (let lag = 0; lag < MAX_LAG; lag++) {
    let sum = 0;
    const end = SIZE - lag;
    for (let i = 0; i < end; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    c[lag] = sum;
  }

  const c0 = c[0];
  if (c0 <= 0) return null;

  // Skip past the initial valley at lag=0
  // Use >= to handle flat/noisy regions near zero-crossing
  let d = 0;
  while (d < MAX_LAG - 2 && c[d] >= c[d + 1]) d++;

  // Find the FIRST local maximum after the valley that clears the confidence bar.
  // Confidence = peak / c[0] (normalized autocorrelation). Guitar/voice: 0.35 works well.
  const CONFIDENCE = 0.35;

  for (let i = d + 1; i < MAX_LAG - 1; i++) {
    const isLocalMax = c[i] >= c[i - 1] && c[i] > c[i + 1];
    if (!isLocalMax) continue;
    if (c[i] / c0 < CONFIDENCE) continue;

    // Parabolic interpolation for sub-sample accuracy
    const x1 = c[i - 1];
    const x2 = c[i];
    const x3 = c[i + 1];
    const denom = x1 + x3 - 2 * x2;
    const peak = denom !== 0 ? i - (x3 - x1) / (2 * denom) : i;

    const freq = sampleRate / peak;

    // Clamp to musical range: B0 (30.87 Hz) – B8 (7902 Hz)
    if (freq < 30 || freq > 8000) return null;

    return freq;
  }

  return null;
}

export type TunerState = "idle" | "listening" | "error";

// How many silent frames before we blank the display (prevents flickering)
const HOLD_FRAMES = 6;

export function useTuner() {
  const [tunerState, setTunerState] = useState<TunerState>("idle");
  const [result, setResult] = useState<TunerResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const silentFramesRef = useRef(0);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buf = bufferRef.current!;
    analyser.getFloatTimeDomainData(buf);
    const freq = detectPitch(buf, ctx.sampleRate);

    if (freq !== null) {
      silentFramesRef.current = 0;
      setResult(freqToNote(freq));
    } else {
      silentFramesRef.current += 1;
      // Hold the last good result for a few frames — avoids flicker between notes
      if (silentFramesRef.current >= HOLD_FRAMES) {
        setResult(null);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Higher sample rate = better frequency resolution
          sampleRate: { ideal: 44100 },
        },
        video: false,
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      // 8192 samples @ 44100 Hz → freq resolution ~5.4 Hz, good for low E (82 Hz)
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;
      silentFramesRef.current = 0;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      setTunerState("listening");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Microphone access denied");
      setTunerState("error");
    }
  }, [tick]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current = null;
    analyserRef.current = null;
    silentFramesRef.current = 0;
    setTunerState("idle");
    setResult(null);
  }, []);

  const toggle = useCallback(() => {
    if (tunerState === "listening") stop();
    else start();
  }, [tunerState, start, stop]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
  }, []);

  return { tunerState, result, errorMsg, start, stop, toggle };
}
