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
  const midi = 12 * (Math.log2(freq / A4_FREQ)) + A4_MIDI;
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

// Autocorrelation-based pitch detection
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  // RMS check — bail on silence
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  // Autocorrelation
  const c = new Float32Array(MAX_SAMPLES);
  for (let lag = 0; lag < MAX_SAMPLES; lag++) {
    let sum = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    c[lag] = sum;
  }

  // Find first valley (drop from peak)
  let d = 0;
  while (d < MAX_SAMPLES && c[d] > c[d + 1]) d++;

  // Find highest peak after the valley
  let maxVal = -Infinity;
  let maxPos = -1;
  for (let i = d; i < MAX_SAMPLES; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }
  if (maxPos === -1) return null;

  // Parabolic interpolation for sub-sample accuracy
  const x1 = c[maxPos - 1] ?? c[maxPos];
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? c[maxPos];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const refinedPos = a !== 0 ? maxPos - b / (2 * a) : maxPos;

  const freq = sampleRate / refinedPos;

  // Clamp to musical range: B0 (30.87 Hz) – B8 (7902 Hz)
  if (freq < 30 || freq > 8000) return null;

  // Confidence check
  if (maxVal / c[0] < 0.5) return null;

  return freq;
}

export type TunerState = "idle" | "listening" | "error";

export function useTuner() {
  const [tunerState, setTunerState] = useState<TunerState>("idle");
  const [result, setResult] = useState<TunerResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buf = bufferRef.current!;
    analyser.getFloatTimeDomainData(buf);
    const freq = detectPitch(buf, ctx.sampleRate);

    if (freq !== null) {
      setResult(freqToNote(freq));
    } else {
      setResult(null);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

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
