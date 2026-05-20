import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Timer, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_BPM = 40;
const MAX_BPM = 240;
const TAP_WINDOW_MS = 3000;

function clampBpm(v: number) {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, v));
}

const SUBDIVISIONS = [
  { label: "1/4", beats: 1 },
  { label: "1/8", beats: 2 },
  { label: "1/16", beats: 4 },
];

const TIME_SIGS = [2, 3, 4, 6];

export default function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0); // 0-indexed current beat in measure
  const [subdivision, setSubdivision] = useState(1); // how many clicks per beat
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0); // raw click count (includes subdivisions)
  const bpmRef = useRef(bpm);
  const runningRef = useRef(running);
  const subdRef = useRef(subdivision);
  const bpmRef2 = useRef(bpm);

  useEffect(() => { bpmRef.current = bpm; bpmRef2.current = bpm; }, [bpm]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { subdRef.current = subdivision; }, [subdivision]);

  function getAudioCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  function playClick(time: number, accent: boolean) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1320 : 880;
    gain.gain.setValueAtTime(accent ? 0.7 : 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  const scheduleNote = useCallback(() => {
    const ctx = getAudioCtx();
    const scheduleAhead = 0.1;
    const secondsPerClick = 60 / (bpmRef.current * subdRef.current);

    while (nextNoteTimeRef.current < ctx.currentTime + scheduleAhead) {
      const isMainBeat = currentBeatRef.current % subdRef.current === 0;
      const beatInMeasure = Math.floor(currentBeatRef.current / subdRef.current) % beatsPerMeasure;
      const isAccent = isMainBeat && beatInMeasure === 0;
      playClick(nextNoteTimeRef.current, isAccent);

      if (isMainBeat) {
        const b = beatInMeasure;
        const t = nextNoteTimeRef.current;
        const delay = Math.max(0, (t - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (runningRef.current) setBeat(b);
        }, delay);
      }

      nextNoteTimeRef.current += secondsPerClick;
      currentBeatRef.current++;
    }

    schedulerRef.current = setTimeout(scheduleNote, 25);
  }, [beatsPerMeasure]);

  function start() {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    currentBeatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    setBeat(0);
    setRunning(true);
    scheduleNote();
  }

  function stop() {
    if (schedulerRef.current) clearTimeout(schedulerRef.current);
    setRunning(false);
    setBeat(0);
  }

  useEffect(() => () => { stop(); }, []);

  function handleTap() {
    const now = performance.now();
    const recent = [...tapTimes, now].filter((t) => now - t < TAP_WINDOW_MS);
    setTapTimes(recent);
    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(clampBpm(Math.round(60000 / avg)));
    }
  }

  const changeBpm = (delta: number) => setBpm((v) => clampBpm(v + delta));

  const dotSize = (i: number) => {
    const isActive = running && i === beat;
    const isAccent = i === 0;
    return { isActive, isAccent };
  };

  return (
    <div className="p-8 max-w-xl mx-auto flex flex-col items-center">
      {/* Header */}
      <div className="w-full mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Timer className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Metronome</h1>
        </div>
        <p className="text-muted-foreground">
          {MIN_BPM}–{MAX_BPM} BPM. Tap the tempo button to set by feel.
        </p>
      </div>

      {/* Main card */}
      <div className="w-full rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-8 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        {/* Beat dots */}
        <div className="relative z-10 flex items-center gap-3">
          {Array.from({ length: beatsPerMeasure }).map((_, i) => {
            const { isActive, isAccent } = dotSize(i);
            return (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-75",
                  isActive
                    ? isAccent
                      ? "w-8 h-8 bg-primary shadow-[0_0_16px_4px_hsl(var(--primary)/0.5)]"
                      : "w-6 h-6 bg-primary/80 shadow-[0_0_10px_2px_hsl(var(--primary)/0.35)]"
                    : isAccent
                    ? "w-8 h-8 bg-primary/20 border-2 border-primary/40"
                    : "w-6 h-6 bg-muted border border-border"
                )}
              />
            );
          })}
        </div>

        {/* BPM display */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div className="text-8xl font-bold font-mono tabular-nums text-foreground leading-none" data-testid="bpm-display">
            {bpm}
          </div>
          <div className="text-sm text-muted-foreground font-medium tracking-widest uppercase">BPM</div>
        </div>

        {/* BPM controls */}
        <div className="relative z-10 flex items-center gap-4 w-full justify-center">
          <button
            onClick={() => changeBpm(-10)}
            className="w-11 h-11 rounded-full border border-border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="−10 BPM"
          >
            <span className="text-sm font-semibold">−10</span>
          </button>
          <button
            onClick={() => changeBpm(-1)}
            className="w-11 h-11 rounded-full border border-border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="−1 BPM"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => changeBpm(1)}
            className="w-11 h-11 rounded-full border border-border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="+1 BPM"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => changeBpm(10)}
            className="w-11 h-11 rounded-full border border-border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="+10 BPM"
          >
            <span className="text-sm font-semibold">+10</span>
          </button>
        </div>

        {/* BPM slider */}
        <div className="relative z-10 w-full px-2">
          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))] cursor-pointer"
            aria-label="BPM slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
            <span>{MIN_BPM}</span>
            <span>{MAX_BPM}</span>
          </div>
        </div>
      </div>

      {/* Start/Stop + Tap */}
      <div className="mt-6 flex items-center gap-3 w-full">
        <Button
          data-testid="button-metronome-toggle"
          size="lg"
          onClick={running ? stop : start}
          className={cn(
            "flex-1 rounded-full gap-2 font-semibold text-base transition-all",
            running
              ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive hover:text-white"
              : ""
          )}
          variant={running ? "ghost" : "default"}
        >
          <Timer className="w-5 h-5" />
          {running ? "Stop" : "Start"}
        </Button>

        <Button
          data-testid="button-tap-tempo"
          size="lg"
          variant="outline"
          onClick={handleTap}
          className="flex-1 rounded-full font-semibold text-base"
        >
          Tap Tempo
        </Button>
      </div>

      {/* Time signature + subdivision */}
      <div className="mt-6 w-full grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Time Signature
          </p>
          <div className="flex gap-2 flex-wrap">
            {TIME_SIGS.map((ts) => (
              <button
                key={ts}
                onClick={() => { setBeatsPerMeasure(ts); if (running) { stop(); } }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors",
                  beatsPerMeasure === ts
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {ts}/4
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Subdivision
          </p>
          <div className="flex gap-2 flex-wrap">
            {SUBDIVISIONS.map(({ label, beats }) => (
              <button
                key={label}
                onClick={() => { setSubdivision(beats); if (running) { stop(); } }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors",
                  subdivision === beats
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Common tempos */}
      <div className="mt-4 w-full rounded-xl border border-border bg-card/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Common Tempos
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Largo", bpm: 50 },
            { label: "Andante", bpm: 76 },
            { label: "Moderato", bpm: 108 },
            { label: "Allegro", bpm: 132 },
            { label: "Presto", bpm: 180 },
          ].map(({ label, bpm: b }) => (
            <button
              key={label}
              onClick={() => { setBpm(b); if (running) stop(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {label} <span className="font-mono text-primary/80 ml-1">{b}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
