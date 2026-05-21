import { useState, useRef, useCallback } from "react";

export type MixerState = "idle" | "loading" | "ready" | "playing" | "recording" | "done";

interface Track {
  id: number;
  title: string;
  audioUrl: string;
}

interface UseAudioMixerResult {
  state: MixerState;
  error: string | null;
  mixDuration: number;
  recordedBlob: Blob | null;
  track1Volume: number;
  track2Volume: number;
  track1Pan: number;
  track2Pan: number;
  track1Mute: boolean;
  track2Mute: boolean;
  track1Solo: boolean;
  track2Solo: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  loop: boolean;
  elapsedTime: number;
  setTrack1Volume: (v: number) => void;
  setTrack2Volume: (v: number) => void;
  setTrack1Pan: (v: number) => void;
  setTrack2Pan: (v: number) => void;
  setTrack1Mute: (v: boolean) => void;
  setTrack2Mute: (v: boolean) => void;
  setTrack1Solo: (v: boolean) => void;
  setTrack2Solo: (v: boolean) => void;
  setFadeInDuration: (v: number) => void;
  setFadeOutDuration: (v: number) => void;
  setLoop: (v: boolean) => void;
  loadTracks: (track1: Track, track2: Track) => Promise<void>;
  play: () => void;
  stop: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
}

// ── WAV encoder ─────────────────────────────────────────────────────────────
// Encodes collected Float32 PCM chunks as a 16-bit stereo WAV Blob.
// Works entirely in-browser with no external dependencies.
function encodePCMasWAV(
  left: Float32Array[],
  right: Float32Array[],
  sampleRate: number,
): Blob {
  const totalSamples = left.reduce((s, a) => s + a.length, 0);
  if (totalSamples === 0) return new Blob([], { type: "audio/wav" });

  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);

  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  str(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  v.setUint16(32, numChannels * bytesPerSample, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataSize, true);

  let off = 44;
  let li = 0, lci = 0, ri = 0, rci = 0;
  for (let i = 0; i < totalSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[li][lci++]));
    const r = Math.max(-1, Math.min(1, right[ri][rci++]));
    v.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7fff, true); off += 2;
    v.setInt16(off, r < 0 ? r * 0x8000 : r * 0x7fff, true); off += 2;
    if (lci >= left[li].length) { li++; lci = 0; }
    if (rci >= right[ri].length) { ri++; rci = 0; }
  }

  return new Blob([buf], { type: "audio/wav" });
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useAudioMixer(): UseAudioMixerResult {
  const [state, setState] = useState<MixerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mixDuration, setMixDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Track controls
  const [track1Volume, setTrack1VolumeState] = useState(0.8);
  const [track2Volume, setTrack2VolumeState] = useState(0.8);
  const [track1Pan, setTrack1PanState] = useState(0);
  const [track2Pan, setTrack2PanState] = useState(0);
  const [track1Mute, setTrack1MuteState] = useState(false);
  const [track2Mute, setTrack2MuteState] = useState(false);
  const [track1Solo, setTrack1SoloState] = useState(false);
  const [track2Solo, setTrack2SoloState] = useState(false);
  const [fadeInDuration, setFadeInDurationState] = useState(0);
  const [fadeOutDuration, setFadeOutDurationState] = useState(0);
  const [loop, setLoopState] = useState(false);

  // Live refs (avoid stale closures)
  const t1VolumeRef = useRef(0.8);
  const t2VolumeRef = useRef(0.8);
  const t1PanRef = useRef(0);
  const t2PanRef = useRef(0);
  const t1MuteRef = useRef(false);
  const t2MuteRef = useRef(false);
  const t1SoloRef = useRef(false);
  const t2SoloRef = useRef(false);
  const fadeInRef = useRef(0);
  const fadeOutRef = useRef(0);
  const loopRef = useRef(false);
  const stateRef = useRef<MixerState>("idle");
  stateRef.current = state;

  // Audio nodes
  const ctxRef = useRef<AudioContext | null>(null);
  const el1Ref = useRef<HTMLAudioElement | null>(null);
  const el2Ref = useRef<HTMLAudioElement | null>(null);
  const gain1Ref = useRef<GainNode | null>(null);
  const gain2Ref = useRef<GainNode | null>(null);
  const pan1Ref = useRef<StereoPannerNode | null>(null);
  const pan2Ref = useRef<StereoPannerNode | null>(null);

  // PCM capture (replaces MediaRecorder — works on iOS Safari)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const pcmLeftRef = useRef<Float32Array[]>([]);
  const pcmRightRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(44100);

  const timerRef = useRef<number | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const fadeOutTimeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  // --- Helpers ---

  const effectiveGain1 = () => {
    if (t1MuteRef.current) return 0;
    if (t2SoloRef.current) return 0;
    return t1VolumeRef.current;
  };
  const effectiveGain2 = () => {
    if (t2MuteRef.current) return 0;
    if (t1SoloRef.current) return 0;
    return t2VolumeRef.current;
  };

  const applyGain1 = useCallback(() => {
    const ctx = ctxRef.current; const g = gain1Ref.current;
    if (!ctx || !g) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(effectiveGain1(), ctx.currentTime);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyGain2 = useCallback(() => {
    const ctx = ctxRef.current; const g = gain2Ref.current;
    if (!ctx || !g) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(effectiveGain2(), ctx.currentTime);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPan1 = useCallback(() => {
    if (pan1Ref.current) pan1Ref.current.pan.value = t1PanRef.current;
  }, []);

  const applyPan2 = useCallback(() => {
    if (pan2Ref.current) pan2Ref.current.pan.value = t2PanRef.current;
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (playTimeoutRef.current) { clearTimeout(playTimeoutRef.current); playTimeoutRef.current = null; }
    if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; }
  }, []);

  const startElapsedTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
  }, []);

  const haltElements = useCallback(() => {
    el1Ref.current?.pause();
    el2Ref.current?.pause();
    if (el1Ref.current) el1Ref.current.currentTime = 0;
    if (el2Ref.current) el2Ref.current.currentTime = 0;
  }, []);

  // Tear down the PCM capture graph and return the collected blob
  const finishCapture = useCallback((): Blob => {
    const sp = scriptProcessorRef.current;
    const sg = silentGainRef.current;
    if (sp) {
      sp.onaudioprocess = null;
      try { sp.disconnect(); } catch {}
      scriptProcessorRef.current = null;
    }
    if (sg) {
      try { sg.disconnect(); } catch {}
      silentGainRef.current = null;
    }
    const blob = encodePCMasWAV(pcmLeftRef.current, pcmRightRef.current, sampleRateRef.current);
    pcmLeftRef.current = [];
    pcmRightRef.current = [];
    return blob;
  }, []);

  // --- Public setters ---

  const setTrack1Volume = useCallback((v: number) => {
    t1VolumeRef.current = v; setTrack1VolumeState(v); applyGain1();
  }, [applyGain1]);

  const setTrack2Volume = useCallback((v: number) => {
    t2VolumeRef.current = v; setTrack2VolumeState(v); applyGain2();
  }, [applyGain2]);

  const setTrack1Pan = useCallback((v: number) => {
    t1PanRef.current = v; setTrack1PanState(v); applyPan1();
  }, [applyPan1]);

  const setTrack2Pan = useCallback((v: number) => {
    t2PanRef.current = v; setTrack2PanState(v); applyPan2();
  }, [applyPan2]);

  const setTrack1Mute = useCallback((v: boolean) => {
    t1MuteRef.current = v; setTrack1MuteState(v); applyGain1();
  }, [applyGain1]);

  const setTrack2Mute = useCallback((v: boolean) => {
    t2MuteRef.current = v; setTrack2MuteState(v); applyGain2();
  }, [applyGain2]);

  const setTrack1Solo = useCallback((v: boolean) => {
    t1SoloRef.current = v;
    if (v) { t2SoloRef.current = false; setTrack2SoloState(false); }
    setTrack1SoloState(v); applyGain1(); applyGain2();
  }, [applyGain1, applyGain2]);

  const setTrack2Solo = useCallback((v: boolean) => {
    t2SoloRef.current = v;
    if (v) { t1SoloRef.current = false; setTrack1SoloState(false); }
    setTrack2SoloState(v); applyGain1(); applyGain2();
  }, [applyGain1, applyGain2]);

  const setFadeInDuration = useCallback((v: number) => {
    fadeInRef.current = v; setFadeInDurationState(v);
  }, []);

  const setFadeOutDuration = useCallback((v: number) => {
    fadeOutRef.current = v; setFadeOutDurationState(v);
  }, []);

  const setLoop = useCallback((v: boolean) => {
    loopRef.current = v; setLoopState(v);
  }, []);

  // --- Core operations ---

  const loadTracks = useCallback(async (track1: Track, track2: Track) => {
    setError(null);
    setState("loading");
    setRecordedBlob(null);
    setElapsedTime(0);
    try {
      const audio1 = new Audio();
      const audio2 = new Audio();
      audio1.crossOrigin = "anonymous";
      audio2.crossOrigin = "anonymous";
      audio1.preload = "auto";
      audio2.preload = "auto";

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          audio1.onerror = () => reject(new Error(`Could not load "${track1.title}". Make sure it has audio recorded.`));
          audio1.oncanplaythrough = () => resolve();
          audio1.src = track1.audioUrl;
          audio1.load();
        }),
        new Promise<void>((resolve, reject) => {
          audio2.onerror = () => reject(new Error(`Could not load "${track2.title}". Make sure it has audio recorded.`));
          audio2.oncanplaythrough = () => resolve();
          audio2.src = track2.audioUrl;
          audio2.load();
        }),
      ]);

      const dur = Math.max(audio1.duration || 0, audio2.duration || 0);
      const ctx = new AudioContext();

      const src1 = ctx.createMediaElementSource(audio1);
      const src2 = ctx.createMediaElementSource(audio2);
      const pan1 = ctx.createStereoPanner();
      const pan2 = ctx.createStereoPanner();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      pan1.pan.value = t1PanRef.current;
      pan2.pan.value = t2PanRef.current;
      gain1.gain.value = effectiveGain1();
      gain2.gain.value = effectiveGain2();

      src1.connect(pan1).connect(gain1).connect(ctx.destination);
      src2.connect(pan2).connect(gain2).connect(ctx.destination);

      ctxRef.current = ctx;
      el1Ref.current = audio1;
      el2Ref.current = audio2;
      pan1Ref.current = pan1;
      pan2Ref.current = pan2;
      gain1Ref.current = gain1;
      gain2Ref.current = gain2;
      sampleRateRef.current = ctx.sampleRate;

      setMixDuration(dur);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracks");
      setState("idle");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    const el1 = el1Ref.current;
    const el2 = el2Ref.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    if (!ctx || !el1 || !el2 || !gain1 || !gain2) return;

    if (ctx.state === "suspended") ctx.resume();
    el1.currentTime = 0;
    el2.currentTime = 0;

    const fi = fadeInRef.current;
    if (fi > 0) {
      gain1.gain.cancelScheduledValues(ctx.currentTime);
      gain2.gain.cancelScheduledValues(ctx.currentTime);
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(effectiveGain1(), ctx.currentTime + fi);
      gain2.gain.linearRampToValueAtTime(effectiveGain2(), ctx.currentTime + fi);
    } else {
      applyGain1();
      applyGain2();
    }

    el1.play();
    el2.play();
    setState("playing");
    setElapsedTime(0);
    clearTimers();
    startElapsedTimer();

    const dur = mixDuration;
    const fo = fadeOutRef.current;
    const autoStopAt = Math.max(0, dur * 1000 - fo * 1000 - 100);

    playTimeoutRef.current = window.setTimeout(() => {
      if (stateRef.current !== "playing") return;
      if (loopRef.current) {
        el1.currentTime = 0;
        el2.currentTime = 0;
        startTimeRef.current = Date.now();
      } else if (fo > 0 && ctx && gain1 && gain2) {
        gain1.gain.cancelScheduledValues(ctx.currentTime);
        gain2.gain.cancelScheduledValues(ctx.currentTime);
        gain1.gain.setValueAtTime(gain1.gain.value, ctx.currentTime);
        gain2.gain.setValueAtTime(gain2.gain.value, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
        fadeOutTimeoutRef.current = window.setTimeout(() => {
          haltElements(); applyGain1(); applyGain2(); clearTimers();
          setState("ready"); setElapsedTime(0);
        }, fo * 1000 + 100);
      } else {
        haltElements(); clearTimers(); setState("ready"); setElapsedTime(0);
      }
    }, autoStopAt);
  }, [mixDuration, applyGain1, applyGain2, clearTimers, startElapsedTimer, haltElements]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    const ctx = ctxRef.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    const fo = fadeOutRef.current;

    if (fo > 0 && ctx && gain1 && gain2) {
      gain1.gain.cancelScheduledValues(ctx.currentTime);
      gain2.gain.cancelScheduledValues(ctx.currentTime);
      gain1.gain.setValueAtTime(gain1.gain.value, ctx.currentTime);
      gain2.gain.setValueAtTime(gain2.gain.value, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
      gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
      fadeOutTimeoutRef.current = window.setTimeout(() => {
        haltElements(); applyGain1(); applyGain2(); clearTimers();
        setState("ready"); setElapsedTime(0);
      }, fo * 1000 + 100);
    } else {
      haltElements(); clearTimers(); setState("ready"); setElapsedTime(0);
    }
  }, [haltElements, applyGain1, applyGain2, clearTimers]);

  const startRecording = useCallback(async () => {
    const ctx = ctxRef.current;
    const el1 = el1Ref.current;
    const el2 = el2Ref.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    if (!ctx || !el1 || !el2 || !gain1 || !gain2) return;

    haltElements();
    clearTimers();
    setError(null);

    // Wake the AudioContext — must happen before any audio graph activity
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      setError("Could not start audio. Tap anywhere on the page first, then try again.");
      setState("ready");
      return;
    }

    // Apply fade-in gain envelope
    const fi = fadeInRef.current;
    if (fi > 0) {
      gain1.gain.cancelScheduledValues(ctx.currentTime);
      gain2.gain.cancelScheduledValues(ctx.currentTime);
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(effectiveGain1(), ctx.currentTime + fi);
      gain2.gain.linearRampToValueAtTime(effectiveGain2(), ctx.currentTime + fi);
    } else {
      applyGain1();
      applyGain2();
    }

    // ── PCM capture via ScriptProcessorNode ──────────────────────────────
    // MediaRecorder + Web Audio streams is broken on iOS Safari.
    // ScriptProcessorNode captures raw float PCM that we encode as WAV,
    // which works on every browser including iOS.
    const bufferSize = 4096;
    const sp = ctx.createScriptProcessor(bufferSize, 2, 2);
    // Route through a silent gain so onaudioprocess fires without doubling output
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    pcmLeftRef.current = [];
    pcmRightRef.current = [];

    sp.onaudioprocess = (e) => {
      const inp = e.inputBuffer;
      const l = inp.getChannelData(0);
      const r = inp.numberOfChannels > 1 ? inp.getChannelData(1) : inp.getChannelData(0);
      pcmLeftRef.current.push(new Float32Array(l));
      pcmRightRef.current.push(new Float32Array(r));
    };

    gain1.connect(sp);
    gain2.connect(sp);
    sp.connect(silentGain);
    silentGain.connect(ctx.destination);

    scriptProcessorRef.current = sp;
    silentGainRef.current = silentGain;

    // Show recording UI immediately
    setState("recording");
    setElapsedTime(0);

    // Start playback (fire-and-forget — no await, keeps us in the user gesture window)
    el1.currentTime = 0;
    el2.currentTime = 0;
    el1.play().catch(() => {});
    el2.play().catch(() => {});

    startElapsedTimer();

    // Auto-stop when the longer track ends
    playTimeoutRef.current = window.setTimeout(() => {
      haltElements();
      clearTimers();
      const blob = finishCapture();
      setRecordedBlob(blob);
      setState("done");
    }, (mixDuration || 300) * 1000 + 500);
  }, [mixDuration, applyGain1, applyGain2, haltElements, clearTimers, startElapsedTimer, finishCapture]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    haltElements();
    clearTimers();
    const blob = finishCapture();
    setRecordedBlob(blob);
    setState("done");
  }, [haltElements, clearTimers, finishCapture]);

  const reset = useCallback(() => {
    haltElements();
    clearTimers();
    finishCapture(); // tear down any active sp
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    el1Ref.current = null;
    el2Ref.current = null;
    pan1Ref.current = null;
    pan2Ref.current = null;
    gain1Ref.current = null;
    gain2Ref.current = null;
    setRecordedBlob(null);
    setElapsedTime(0);
    setMixDuration(0);
    setError(null);
    setState("idle");
  }, [haltElements, clearTimers, finishCapture]);

  return {
    state, error, mixDuration, recordedBlob, elapsedTime,
    track1Volume, track2Volume, track1Pan, track2Pan,
    track1Mute, track2Mute, track1Solo, track2Solo,
    fadeInDuration, fadeOutDuration, loop,
    setTrack1Volume, setTrack2Volume,
    setTrack1Pan, setTrack2Pan,
    setTrack1Mute, setTrack2Mute,
    setTrack1Solo, setTrack2Solo,
    setFadeInDuration, setFadeOutDuration,
    setLoop,
    loadTracks, play, stop, startRecording, stopRecording, reset,
  };
}
