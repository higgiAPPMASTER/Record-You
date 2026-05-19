import { useState, useRef, useCallback, useEffect } from "react";

export function useMetronome() {
  const [isRunning, setIsRunning] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [beat, setBeat] = useState(0); // 0-3 for visual pulse

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextTickRef = useRef<number>(0);
  const schedulerRef = useRef<number | null>(null);
  const beatCountRef = useRef<number>(0);
  const bpmRef = useRef<number>(bpm);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const tick = useCallback((ctx: AudioContext, time: number, isDownbeat: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = isDownbeat ? 1000 : 800;
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.start(time);
    osc.stop(time + 0.1);
  }, []);

  const schedule = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const lookahead = 0.1; // seconds
    const scheduleAhead = 0.15; // seconds

    while (nextTickRef.current < ctx.currentTime + scheduleAhead) {
      const isDownbeat = beatCountRef.current % 4 === 0;
      tick(ctx, nextTickRef.current, isDownbeat);

      // Update visual beat state
      const beatIndex = beatCountRef.current % 4;
      const scheduledTime = (nextTickRef.current - ctx.currentTime) * 1000;
      setTimeout(() => setBeat(beatIndex), Math.max(0, scheduledTime));

      nextTickRef.current += 60.0 / bpmRef.current;
      beatCountRef.current++;
    }

    schedulerRef.current = window.setTimeout(schedule, lookahead * 1000);
  }, [tick]);

  const start = useCallback(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    nextTickRef.current = ctx.currentTime + 0.05;
    beatCountRef.current = 0;
    setIsRunning(true);
    schedule();
  }, [schedule]);

  const stop = useCallback(() => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsRunning(false);
    setBeat(0);
  }, []);

  const toggle = useCallback(() => {
    if (isRunning) stop();
    else start();
  }, [isRunning, start, stop]);

  const tapRef = useRef<number[]>([]);
  const tapTempo = useCallback(() => {
    const now = Date.now();
    tapRef.current.push(now);
    if (tapRef.current.length > 4) tapRef.current.shift();

    if (tapRef.current.length >= 2) {
      const intervals = tapRef.current
        .slice(1)
        .map((t, i) => t - tapRef.current[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avg);
      if (newBpm >= 40 && newBpm <= 240) setBpm(newBpm);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  return { isRunning, bpm, setBpm, beat, toggle, tapTempo };
}
