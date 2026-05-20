import { useState, useRef, useCallback } from "react";

export type MixerState = "idle" | "loading" | "ready" | "playing" | "recording" | "done";

interface Track {
  id: number;
  title: string;
  audioUrl: string;
}

export interface UseAudioMixerResult {
  state: MixerState;
  error: string | null;
  mixDuration: number;
  recordedBlob: Blob | null;
  track1Volume: number;
  track2Volume: number;
  track1Pan: number;
  track2Pan: number;
  track1FadeIn: number;
  track1FadeOut: number;
  track2FadeIn: number;
  track2FadeOut: number;
  track1Trim: number;
  track2Trim: number;
  track1Level: number;
  track2Level: number;
  loop: boolean;
  setTrack1Volume: (v: number) => void;
  setTrack2Volume: (v: number) => void;
  setTrack1Pan: (v: number) => void;
  setTrack2Pan: (v: number) => void;
  setTrack1FadeIn: (v: number) => void;
  setTrack1FadeOut: (v: number) => void;
  setTrack2FadeIn: (v: number) => void;
  setTrack2FadeOut: (v: number) => void;
  setTrack1Trim: (v: number) => void;
  setTrack2Trim: (v: number) => void;
  setLoop: (v: boolean) => void;
  loadTracks: (track1: Track, track2: Track) => Promise<void>;
  play: () => void;
  stop: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
  elapsedTime: number;
}

export function useAudioMixer(): UseAudioMixerResult {
  const [state, setState] = useState<MixerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mixDuration, setMixDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [loop, setLoop] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Per-track controls (state for UI, refs for audio callbacks)
  const [track1Volume, setTrack1VolumeState] = useState(0.8);
  const [track2Volume, setTrack2VolumeState] = useState(0.8);
  const [track1Pan, setTrack1PanState] = useState(0);
  const [track2Pan, setTrack2PanState] = useState(0);
  const [track1FadeIn, setTrack1FadeIn] = useState(0);
  const [track1FadeOut, setTrack1FadeOut] = useState(0);
  const [track2FadeIn, setTrack2FadeIn] = useState(0);
  const [track2FadeOut, setTrack2FadeOut] = useState(0);
  const [track1Trim, setTrack1TrimState] = useState(0);
  const [track2Trim, setTrack2TrimState] = useState(0);
  const [track1Level, setTrack1Level] = useState(0);
  const [track2Level, setTrack2Level] = useState(0);

  // Refs for values read inside audio callbacks (avoid stale closures)
  const track1VolumeRef = useRef(0.8);
  const track2VolumeRef = useRef(0.8);
  const track1PanRef = useRef(0);
  const track2PanRef = useRef(0);
  const track1FadeInRef = useRef(0);
  const track1FadeOutRef = useRef(0);
  const track2FadeInRef = useRef(0);
  const track2FadeOutRef = useRef(0);
  const track1TrimRef = useRef(0);
  const track2TrimRef = useRef(0);

  // Audio graph nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffer1Ref = useRef<AudioBuffer | null>(null);
  const buffer2Ref = useRef<AudioBuffer | null>(null);
  const gain1Ref = useRef<GainNode | null>(null);
  const gain2Ref = useRef<GainNode | null>(null);
  const panner1Ref = useRef<StereoPannerNode | null>(null);
  const panner2Ref = useRef<StereoPannerNode | null>(null);
  const analyser1Ref = useRef<AnalyserNode | null>(null);
  const analyser2Ref = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const source1Ref = useRef<AudioBufferSourceNode | null>(null);
  const source2Ref = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const loopRef = useRef<boolean>(loop);
  const stateRef = useRef<MixerState>("idle");
  const playTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelDataRef = useRef<Float32Array<ArrayBuffer>>(new Float32Array(256));

  loopRef.current = loop;
  stateRef.current = state;

  // ── Setters that keep both state + ref + live node in sync ──────────────

  const setTrack1Volume = useCallback((v: number) => {
    track1VolumeRef.current = v;
    setTrack1VolumeState(v);
    const g = gain1Ref.current;
    const ctx = audioCtxRef.current;
    if (g && ctx) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(v, ctx.currentTime);
    }
  }, []);

  const setTrack2Volume = useCallback((v: number) => {
    track2VolumeRef.current = v;
    setTrack2VolumeState(v);
    const g = gain2Ref.current;
    const ctx = audioCtxRef.current;
    if (g && ctx) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(v, ctx.currentTime);
    }
  }, []);

  const setTrack1Pan = useCallback((v: number) => {
    track1PanRef.current = v;
    setTrack1PanState(v);
    if (panner1Ref.current) panner1Ref.current.pan.value = v;
  }, []);

  const setTrack2Pan = useCallback((v: number) => {
    track2PanRef.current = v;
    setTrack2PanState(v);
    if (panner2Ref.current) panner2Ref.current.pan.value = v;
  }, []);

  const handleSetTrack1FadeIn = useCallback((v: number) => {
    track1FadeInRef.current = v;
    setTrack1FadeIn(v);
  }, []);
  const handleSetTrack1FadeOut = useCallback((v: number) => {
    track1FadeOutRef.current = v;
    setTrack1FadeOut(v);
  }, []);
  const handleSetTrack2FadeIn = useCallback((v: number) => {
    track2FadeInRef.current = v;
    setTrack2FadeIn(v);
  }, []);
  const handleSetTrack2FadeOut = useCallback((v: number) => {
    track2FadeOutRef.current = v;
    setTrack2FadeOut(v);
  }, []);

  const setTrack1Trim = useCallback((v: number) => {
    track1TrimRef.current = v;
    setTrack1TrimState(v);
  }, []);
  const setTrack2Trim = useCallback((v: number) => {
    track2TrimRef.current = v;
    setTrack2TrimState(v);
  }, []);

  // ── Timer helpers ────────────────────────────────────────────────────────

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (playTimeoutRef.current) { clearTimeout(playTimeoutRef.current); playTimeoutRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
  }, []);

  // ── Level meter RAF ──────────────────────────────────────────────────────

  const startLevelMeter = useCallback(() => {
    const tick = () => {
      for (const [analyserRef, setLevel] of [
        [analyser1Ref, setTrack1Level],
        [analyser2Ref, setTrack2Level],
      ] as const) {
        const a = analyserRef.current;
        if (a) {
          a.getFloatTimeDomainData(levelDataRef.current);
          const rms = Math.sqrt(
            levelDataRef.current.reduce((sum, x) => sum + x * x, 0) / levelDataRef.current.length
          );
          setLevel(Math.min(rms * 5, 1));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setTrack1Level(0);
    setTrack2Level(0);
  }, []);

  // ── Load tracks ──────────────────────────────────────────────────────────

  const fetchBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    return ctx.decodeAudioData(await res.arrayBuffer());
  };

  const loadTracks = useCallback(async (track1: Track, track2: Track) => {
    setError(null);
    setState("loading");
    setRecordedBlob(null);
    setElapsedTime(0);

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const [buf1, buf2] = await Promise.all([
        fetchBuffer(ctx, track1.audioUrl),
        fetchBuffer(ctx, track2.audioUrl),
      ]);
      buffer1Ref.current = buf1;
      buffer2Ref.current = buf2;

      // Audio graph: src → gain → panner → analyser → masterGain → destination
      const master = ctx.createGain();
      master.gain.value = 1;
      masterGainRef.current = master;
      master.connect(ctx.destination);

      for (const [gainRef, pannerRef, analyserRef, vol, pan] of [
        [gain1Ref, panner1Ref, analyser1Ref, track1VolumeRef.current, track1PanRef.current],
        [gain2Ref, panner2Ref, analyser2Ref, track2VolumeRef.current, track2PanRef.current],
      ] as const) {
        const gain = ctx.createGain();
        gain.gain.value = vol as number;
        (gainRef as React.MutableRefObject<GainNode | null>).current = gain;

        const panner = ctx.createStereoPanner();
        panner.pan.value = pan as number;
        (pannerRef as React.MutableRefObject<StereoPannerNode | null>).current = panner;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        (analyserRef as React.MutableRefObject<AnalyserNode | null>).current = analyser;

        gain.connect(panner);
        panner.connect(analyser);
        analyser.connect(master);
      }

      const dur = Math.max(
        buf1.duration + track1TrimRef.current,
        buf2.duration + track2TrimRef.current
      );
      setMixDuration(dur);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracks");
      setState("idle");
    }
  }, []);

  // ── Create + schedule sources ────────────────────────────────────────────

  const createSources = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buf1 = buffer1Ref.current;
    const buf2 = buffer2Ref.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    if (!ctx || !buf1 || !buf2 || !gain1 || !gain2) return;

    const now = ctx.currentTime;

    const scheduleFade = (
      gain: GainNode,
      vol: number,
      dur: number,
      fadeIn: number,
      fadeOut: number,
      trim: number
    ) => {
      const startAt = now + trim;
      const endAt = startAt + dur;

      gain.gain.cancelScheduledValues(now);

      if (fadeIn > 0) {
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(vol, startAt + Math.min(fadeIn, dur * 0.5));
      } else {
        gain.gain.setValueAtTime(vol, startAt);
      }

      if (fadeOut > 0 && dur > fadeOut) {
        gain.gain.setValueAtTime(vol, endAt - fadeOut);
        gain.gain.linearRampToValueAtTime(0, endAt);
      }
    };

    scheduleFade(gain1, track1VolumeRef.current, buf1.duration, track1FadeInRef.current, track1FadeOutRef.current, track1TrimRef.current);
    scheduleFade(gain2, track2VolumeRef.current, buf2.duration, track2FadeInRef.current, track2FadeOutRef.current, track2TrimRef.current);

    const src1 = ctx.createBufferSource();
    src1.buffer = buf1;
    src1.connect(gain1);
    source1Ref.current = src1;

    const src2 = ctx.createBufferSource();
    src2.buffer = buf2;
    src2.connect(gain2);
    source2Ref.current = src2;

    // Apply trim: delay when each track starts
    src1.start(now + track1TrimRef.current);
    src2.start(now + track2TrimRef.current);
  }, []);

  const stopSources = useCallback(() => {
    try { source1Ref.current?.stop(); } catch (_) {}
    try { source2Ref.current?.stop(); } catch (_) {}
    source1Ref.current = null;
    source2Ref.current = null;
  }, []);

  // ── Playback ─────────────────────────────────────────────────────────────

  const getMixDuration = () => Math.max(
    (buffer1Ref.current?.duration ?? 0) + track1TrimRef.current,
    (buffer2Ref.current?.duration ?? 0) + track2TrimRef.current
  );

  const playOnce = useCallback(() => {
    stopSources();
    createSources();
    startLevelMeter();

    const dur = getMixDuration();

    playTimeoutRef.current = window.setTimeout(() => {
      if (stateRef.current === "playing") {
        if (loopRef.current) {
          setElapsedTime(0);
          startTimeRef.current = Date.now();
          playOnce();
        } else {
          clearTimer();
          stopLevelMeter();
          setState("ready");
          setElapsedTime(0);
        }
      }
    }, dur * 1000);
  }, [createSources, stopSources, clearTimer, startLevelMeter, stopLevelMeter]);

  const play = useCallback(() => {
    setState("playing");
    setElapsedTime(0);
    clearTimer();
    startTimer();
    playOnce();
  }, [playOnce, clearTimer, startTimer]);

  const stop = useCallback(() => {
    stopSources();
    clearTimer();
    stopLevelMeter();
    setState("ready");
    setElapsedTime(0);
  }, [stopSources, clearTimer, stopLevelMeter]);

  // ── Recording ────────────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    stopSources();
    clearTimer();

    const dest = ctx.createMediaStreamDestination();
    master.connect(dest);

    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
      .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const mr = new MediaRecorder(dest.stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: 192000,
    });
    mediaRecorderRef.current = mr;

    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      master.disconnect(dest);
      setRecordedBlob(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      setState("done");
    };

    mr.start(100);
    createSources();
    setState("recording");
    setElapsedTime(0);
    startTimer();
    startLevelMeter();

    const dur = getMixDuration();
    playTimeoutRef.current = window.setTimeout(() => {
      if (mr.state === "recording") mr.stop();
      stopSources();
      clearTimer();
      stopLevelMeter();
    }, dur * 1000 + 200);
  }, [createSources, stopSources, clearTimer, startTimer, startLevelMeter, stopLevelMeter]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    stopSources();
    clearTimer();
    stopLevelMeter();
  }, [stopSources, clearTimer, stopLevelMeter]);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    stopSources();
    clearTimer();
    stopLevelMeter();
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    buffer1Ref.current = null;
    buffer2Ref.current = null;
    gain1Ref.current = null;
    gain2Ref.current = null;
    panner1Ref.current = null;
    panner2Ref.current = null;
    analyser1Ref.current = null;
    analyser2Ref.current = null;
    masterGainRef.current = null;
    mediaRecorderRef.current = null;
    setRecordedBlob(null);
    setElapsedTime(0);
    setMixDuration(0);
    setError(null);
    setState("idle");
  }, [stopSources, clearTimer, stopLevelMeter]);

  return {
    state, error, mixDuration, recordedBlob,
    track1Volume, track2Volume,
    track1Pan, track2Pan,
    track1FadeIn, track1FadeOut,
    track2FadeIn, track2FadeOut,
    track1Trim, track2Trim,
    track1Level, track2Level,
    loop,
    setTrack1Volume, setTrack2Volume,
    setTrack1Pan, setTrack2Pan,
    setTrack1FadeIn: handleSetTrack1FadeIn,
    setTrack1FadeOut: handleSetTrack1FadeOut,
    setTrack2FadeIn: handleSetTrack2FadeIn,
    setTrack2FadeOut: handleSetTrack2FadeOut,
    setTrack1Trim, setTrack2Trim,
    setLoop,
    loadTracks, play, stop, startRecording, stopRecording, reset,
    elapsedTime,
  };
}

// Needed for TypeScript ref casts inside the loop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type React = any;
