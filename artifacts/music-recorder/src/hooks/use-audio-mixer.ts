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
  loop: boolean;
  setTrack1Volume: (v: number) => void;
  setTrack2Volume: (v: number) => void;
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
  const [track1Volume, setTrack1Volume] = useState(0.8);
  const [track2Volume, setTrack2Volume] = useState(0.8);
  const [loop, setLoop] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const el1Ref = useRef<HTMLAudioElement | null>(null);
  const el2Ref = useRef<HTMLAudioElement | null>(null);
  const gain1Ref = useRef<GainNode | null>(null);
  const gain2Ref = useRef<GainNode | null>(null);
  const src1Ref = useRef<MediaElementAudioSourceNode | null>(null);
  const src2Ref = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const loopRef = useRef(loop);
  const stateRef = useRef<MixerState>("idle");
  loopRef.current = loop;
  stateRef.current = state;

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

  const loadTracks = useCallback(async (track1: Track, track2: Track) => {
    setError(null);
    setState("loading");
    setRecordedBlob(null);
    setElapsedTime(0);

    try {
      // Create audio elements — let the browser handle format detection
      const audio1 = new Audio();
      const audio2 = new Audio();
      audio1.crossOrigin = "anonymous";
      audio2.crossOrigin = "anonymous";
      audio1.preload = "auto";
      audio2.preload = "auto";

      // Wait for both tracks to load enough to determine duration
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          audio1.onerror = () => reject(new Error(
            `Could not load "${track1.title}". Make sure it has audio recorded and try again.`
          ));
          audio1.oncanplaythrough = () => resolve();
          audio1.src = track1.audioUrl;
          audio1.load();
        }),
        new Promise<void>((resolve, reject) => {
          audio2.onerror = () => reject(new Error(
            `Could not load "${track2.title}". Make sure it has audio recorded and try again.`
          ));
          audio2.oncanplaythrough = () => resolve();
          audio2.src = track2.audioUrl;
          audio2.load();
        }),
      ]);

      const dur = Math.max(audio1.duration || 0, audio2.duration || 0);

      // Build Web Audio graph using MediaElementSource — no decodeAudioData needed
      const ctx = new AudioContext();
      const src1 = ctx.createMediaElementSource(audio1);
      const src2 = ctx.createMediaElementSource(audio2);
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();
      gain1.gain.value = track1Volume;
      gain2.gain.value = track2Volume;
      src1.connect(gain1).connect(ctx.destination);
      src2.connect(gain2).connect(ctx.destination);

      ctxRef.current = ctx;
      el1Ref.current = audio1;
      el2Ref.current = audio2;
      src1Ref.current = src1;
      src2Ref.current = src2;
      gain1Ref.current = gain1;
      gain2Ref.current = gain2;

      setMixDuration(dur);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracks");
      setState("idle");
    }
  }, [track1Volume, track2Volume]);

  const stopPlayback = useCallback(() => {
    el1Ref.current?.pause();
    el2Ref.current?.pause();
    if (el1Ref.current) el1Ref.current.currentTime = 0;
    if (el2Ref.current) el2Ref.current.currentTime = 0;
  }, []);

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    const el1 = el1Ref.current;
    const el2 = el2Ref.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    if (!ctx || !el1 || !el2 || !gain1 || !gain2) return;

    gain1.gain.value = track1Volume;
    gain2.gain.value = track2Volume;

    if (ctx.state === "suspended") ctx.resume();
    el1.currentTime = 0;
    el2.currentTime = 0;
    el1.play();
    el2.play();

    setState("playing");
    setElapsedTime(0);
    clearTimer();
    startTimer();

    const longestDuration = mixDuration;
    playTimeoutRef.current = window.setTimeout(() => {
      if (stateRef.current === "playing") {
        if (loopRef.current) {
          setElapsedTime(0);
          startTimeRef.current = Date.now();
          el1.currentTime = 0;
          el2.currentTime = 0;
          el1.play();
          el2.play();
        } else {
          clearTimer();
          stopPlayback();
          setState("ready");
          setElapsedTime(0);
        }
      }
    }, longestDuration * 1000 + 200);
  }, [track1Volume, track2Volume, mixDuration, clearTimer, startTimer, stopPlayback]);

  const stop = useCallback(() => {
    stopPlayback();
    clearTimer();
    setState("ready");
    setElapsedTime(0);
  }, [stopPlayback, clearTimer]);

  const startRecording = useCallback(() => {
    const ctx = ctxRef.current;
    const el1 = el1Ref.current;
    const el2 = el2Ref.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    if (!ctx || !el1 || !el2 || !gain1 || !gain2) return;

    gain1.gain.value = track1Volume;
    gain2.gain.value = track2Volume;

    stopPlayback();
    clearTimer();

    // Route gains → capture destination
    const dest = ctx.createMediaStreamDestination();
    gain1.connect(dest);
    gain2.connect(dest);

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus" : "audio/webm";
    const mr = new MediaRecorder(dest.stream, { mimeType: mime });
    mediaRecorderRef.current = mr;

    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      setRecordedBlob(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      setState("done");
    };

    mr.start(100);

    if (ctx.state === "suspended") ctx.resume();
    el1.currentTime = 0;
    el2.currentTime = 0;
    el1.play();
    el2.play();

    setState("recording");
    setElapsedTime(0);
    startTimer();

    playTimeoutRef.current = window.setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      clearTimer();
    }, (mixDuration || 300) * 1000 + 500);
  }, [track1Volume, track2Volume, mixDuration, clearTimer, startTimer, stopPlayback]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopPlayback();
    clearTimer();
  }, [stopPlayback, clearTimer]);

  const reset = useCallback(() => {
    stopPlayback();
    clearTimer();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
    el1Ref.current = null;
    el2Ref.current = null;
    src1Ref.current = null;
    src2Ref.current = null;
    gain1Ref.current = null;
    gain2Ref.current = null;
    mediaRecorderRef.current = null;
    setRecordedBlob(null);
    setElapsedTime(0);
    setMixDuration(0);
    setError(null);
    setState("idle");
  }, [stopPlayback, clearTimer]);

  return {
    state, error, mixDuration, recordedBlob,
    track1Volume, track2Volume, loop,
    setTrack1Volume, setTrack2Volume, setLoop,
    loadTracks, play, stop, startRecording, stopRecording, reset, elapsedTime,
  };
}
