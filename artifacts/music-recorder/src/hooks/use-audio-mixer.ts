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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const fadeOutTimeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  // --- Helpers ---

  const effectiveGain1 = () => {
    if (t1MuteRef.current) return 0;
    if (t2SoloRef.current) return 0; // track 2 is soloed → track 1 silent
    return t1VolumeRef.current;
  };
  const effectiveGain2 = () => {
    if (t2MuteRef.current) return 0;
    if (t1SoloRef.current) return 0; // track 1 is soloed → track 2 silent
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

  // --- Public setters (update both state + live ref + node) ---

  const setTrack1Volume = useCallback((v: number) => {
    t1VolumeRef.current = v;
    setTrack1VolumeState(v);
    applyGain1();
  }, [applyGain1]);

  const setTrack2Volume = useCallback((v: number) => {
    t2VolumeRef.current = v;
    setTrack2VolumeState(v);
    applyGain2();
  }, [applyGain2]);

  const setTrack1Pan = useCallback((v: number) => {
    t1PanRef.current = v;
    setTrack1PanState(v);
    applyPan1();
  }, [applyPan1]);

  const setTrack2Pan = useCallback((v: number) => {
    t2PanRef.current = v;
    setTrack2PanState(v);
    applyPan2();
  }, [applyPan2]);

  const setTrack1Mute = useCallback((v: boolean) => {
    t1MuteRef.current = v;
    setTrack1MuteState(v);
    applyGain1();
  }, [applyGain1]);

  const setTrack2Mute = useCallback((v: boolean) => {
    t2MuteRef.current = v;
    setTrack2MuteState(v);
    applyGain2();
  }, [applyGain2]);

  const setTrack1Solo = useCallback((v: boolean) => {
    t1SoloRef.current = v;
    if (v) { t2SoloRef.current = false; setTrack2SoloState(false); }
    setTrack1SoloState(v);
    applyGain1();
    applyGain2();
  }, [applyGain1, applyGain2]);

  const setTrack2Solo = useCallback((v: boolean) => {
    t2SoloRef.current = v;
    if (v) { t1SoloRef.current = false; setTrack1SoloState(false); }
    setTrack2SoloState(v);
    applyGain1();
    applyGain2();
  }, [applyGain1, applyGain2]);

  const setFadeInDuration = useCallback((v: number) => {
    fadeInRef.current = v;
    setFadeInDurationState(v);
  }, []);

  const setFadeOutDuration = useCallback((v: number) => {
    fadeOutRef.current = v;
    setFadeOutDurationState(v);
  }, []);

  const setLoop = useCallback((v: boolean) => {
    loopRef.current = v;
    setLoopState(v);
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

    // Fade in
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
        // restart
        el1.currentTime = 0;
        el2.currentTime = 0;
        startTimeRef.current = Date.now();
      } else {
        // fade out then stop
        if (fo > 0 && ctx && gain1 && gain2) {
          gain1.gain.cancelScheduledValues(ctx.currentTime);
          gain2.gain.cancelScheduledValues(ctx.currentTime);
          gain1.gain.setValueAtTime(gain1.gain.value, ctx.currentTime);
          gain2.gain.setValueAtTime(gain2.gain.value, ctx.currentTime);
          gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
          gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
          fadeOutTimeoutRef.current = window.setTimeout(() => {
            haltElements();
            applyGain1();
            applyGain2();
            clearTimers();
            setState("ready");
            setElapsedTime(0);
          }, fo * 1000 + 100);
        } else {
          haltElements();
          clearTimers();
          setState("ready");
          setElapsedTime(0);
        }
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
        haltElements();
        applyGain1();
        applyGain2();
        clearTimers();
        setState("ready");
        setElapsedTime(0);
      }, fo * 1000 + 100);
    } else {
      haltElements();
      clearTimers();
      setState("ready");
      setElapsedTime(0);
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

    // Resume the AudioContext first — MUST happen before any audio flows
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      setError("Could not activate audio. Tap the screen first and try again.");
      setState("ready");
      return;
    }

    // Route through a capture destination as well
    const dest = ctx.createMediaStreamDestination();
    gain1.connect(dest);
    gain2.connect(dest);

    // Apply fade in for recording too
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

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";

    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
    } catch {
      gain1.disconnect(dest);
      gain2.disconnect(dest);
      setError("Your browser doesn't support audio recording. Try Chrome or Firefox.");
      setState("ready");
      return;
    }
    mediaRecorderRef.current = mr;

    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      try { gain1.disconnect(dest); } catch {}
      try { gain2.disconnect(dest); } catch {}
      const blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" });
      setRecordedBlob(blob);
      setState("done");
    };

    try {
      mr.start(100);
    } catch {
      gain1.disconnect(dest);
      gain2.disconnect(dest);
      setError("Recording could not start. Please try again.");
      setState("ready");
      return;
    }

    el1.currentTime = 0;
    el2.currentTime = 0;
    // These play() calls happen right after await ctx.resume() — still within user-gesture window
    try {
      await el1.play();
      await el2.play();
    } catch {
      // Non-fatal: audio may still play on some browsers even if play() promise rejects
    }

    setState("recording");
    setElapsedTime(0);
    startElapsedTimer();

    playTimeoutRef.current = window.setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      clearTimers();
    }, (mixDuration || 300) * 1000 + 500);
  }, [mixDuration, applyGain1, applyGain2, haltElements, clearTimers, startElapsedTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    haltElements();
    clearTimers();
  }, [haltElements, clearTimers]);

  const reset = useCallback(() => {
    haltElements();
    clearTimers();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    el1Ref.current = null;
    el2Ref.current = null;
    pan1Ref.current = null;
    pan2Ref.current = null;
    gain1Ref.current = null;
    gain2Ref.current = null;
    mediaRecorderRef.current = null;
    setRecordedBlob(null);
    setElapsedTime(0);
    setMixDuration(0);
    setError(null);
    setState("idle");
  }, [haltElements, clearTimers]);

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
