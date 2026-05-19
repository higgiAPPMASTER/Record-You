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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffer1Ref = useRef<AudioBuffer | null>(null);
  const buffer2Ref = useRef<AudioBuffer | null>(null);
  const gain1Ref = useRef<GainNode | null>(null);
  const gain2Ref = useRef<GainNode | null>(null);
  const source1Ref = useRef<AudioBufferSourceNode | null>(null);
  const source2Ref = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const loopRef = useRef<boolean>(loop);
  const stateRef = useRef<MixerState>("idle");
  const playTimeoutRef = useRef<number | null>(null);

  // Keep refs in sync
  loopRef.current = loop;
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
  }, []);

  const fetchBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer);
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

      const gain1 = ctx.createGain();
      gain1.gain.value = track1Volume;
      gain1Ref.current = gain1;

      const gain2 = ctx.createGain();
      gain2.gain.value = track2Volume;
      gain2Ref.current = gain2;

      gain1.connect(ctx.destination);
      gain2.connect(ctx.destination);

      setMixDuration(Math.max(buf1.duration, buf2.duration));
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracks");
      setState("idle");
    }
  }, [track1Volume, track2Volume]);

  const createSources = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buf1 = buffer1Ref.current;
    const buf2 = buffer2Ref.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    if (!ctx || !buf1 || !buf2 || !gain1 || !gain2) return;

    gain1.gain.value = track1Volume;
    gain2.gain.value = track2Volume;

    const src1 = ctx.createBufferSource();
    src1.buffer = buf1;
    src1.connect(gain1);
    source1Ref.current = src1;

    const src2 = ctx.createBufferSource();
    src2.buffer = buf2;
    src2.connect(gain2);
    source2Ref.current = src2;
  }, [track1Volume, track2Volume]);

  const stopSources = useCallback(() => {
    try { source1Ref.current?.stop(); } catch (_) {}
    try { source2Ref.current?.stop(); } catch (_) {}
    source1Ref.current = null;
    source2Ref.current = null;
  }, []);

  // Internal play that can restart itself when looping
  const playOnce = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    stopSources();
    createSources();
    source1Ref.current!.start(0);
    source2Ref.current!.start(0);

    const longestDuration = Math.max(
      buffer1Ref.current?.duration ?? 0,
      buffer2Ref.current?.duration ?? 0
    );

    playTimeoutRef.current = window.setTimeout(() => {
      if (stateRef.current === "playing") {
        if (loopRef.current) {
          // restart for another loop
          setElapsedTime(0);
          startTimeRef.current = Date.now();
          playOnce();
        } else {
          clearTimer();
          setState("ready");
          setElapsedTime(0);
        }
      }
    }, longestDuration * 1000);
  }, [createSources, stopSources, clearTimer, startTimer]);

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
    setState("ready");
    setElapsedTime(0);
  }, [stopSources, clearTimer]);

  const startRecording = useCallback(() => {
    const ctx = audioCtxRef.current;
    const gain1 = gain1Ref.current;
    const gain2 = gain2Ref.current;
    if (!ctx || !gain1 || !gain2) return;

    stopSources();
    clearTimer();

    const dest = ctx.createMediaStreamDestination();
    gain1.connect(dest);
    gain2.connect(dest);

    const mediaRecorder = new MediaRecorder(dest.stream);
    mediaRecorderRef.current = mediaRecorder;

    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      setRecordedBlob(blob);
      setState("done");
    };

    mediaRecorder.start(100);
    createSources();
    source1Ref.current!.start(0);
    source2Ref.current!.start(0);
    setState("recording");
    setElapsedTime(0);
    startTimer();

    const longestDuration = Math.max(
      buffer1Ref.current?.duration ?? 0,
      buffer2Ref.current?.duration ?? 0
    );
    playTimeoutRef.current = window.setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      clearTimer();
    }, longestDuration * 1000 + 200);
  }, [createSources, stopSources, clearTimer, startTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopSources();
    clearTimer();
  }, [stopSources, clearTimer]);

  const reset = useCallback(() => {
    stopSources();
    clearTimer();
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    buffer1Ref.current = null;
    buffer2Ref.current = null;
    gain1Ref.current = null;
    gain2Ref.current = null;
    mediaRecorderRef.current = null;
    setRecordedBlob(null);
    setElapsedTime(0);
    setMixDuration(0);
    setError(null);
    setState("idle");
  }, [stopSources, clearTimer]);

  return {
    state,
    error,
    mixDuration,
    recordedBlob,
    track1Volume,
    track2Volume,
    loop,
    setTrack1Volume,
    setTrack2Volume,
    setLoop,
    loadTracks,
    play,
    stop,
    startRecording,
    stopRecording,
    reset,
    elapsedTime,
  };
}
