import { useState, useRef, useCallback } from "react";

export type MixerState = "idle" | "loading" | "ready" | "playing" | "recording" | "done";

export interface TrackInfo {
  id: number;
  title: string;
  audioUrl: string;
}

export interface TrackState {
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  offset: number;     // seconds vs track 0; track 0 is always 0
  reverbWet: number;  // 0–1
  eqBass: number;     // dB −12..+12
  eqTreble: number;   // dB −12..+12
}

const DEFAULT_TRACK: TrackState = {
  volume: 0.8, pan: 0, muted: false, soloed: false,
  offset: 0, reverbWet: 0, eqBass: 0, eqTreble: 0,
};

export interface UseAudioMixerResult {
  state: MixerState;
  error: string | null;
  mixDuration: number;
  recordedBlob: Blob | null;
  elapsedTime: number;
  tracks: TrackState[];
  fadeInDuration: number;
  fadeOutDuration: number;
  loop: boolean;
  clickEnabled: boolean;
  bpm: number;
  setTrackVolume: (i: number, v: number) => void;
  setTrackPan: (i: number, v: number) => void;
  setTrackMuted: (i: number, v: boolean) => void;
  setTrackSoloed: (i: number, v: boolean) => void;
  setTrackOffset: (i: number, v: number) => void;
  setTrackReverbWet: (i: number, v: number) => void;
  setTrackEqBass: (i: number, v: number) => void;
  setTrackEqTreble: (i: number, v: number) => void;
  setFadeInDuration: (v: number) => void;
  setFadeOutDuration: (v: number) => void;
  setLoop: (v: boolean) => void;
  setClickEnabled: (v: boolean) => void;
  setBpm: (v: number) => void;
  loadTracks: (infos: TrackInfo[]) => Promise<void>;
  play: () => void;
  stop: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
}

// ── WAV encoder ───────────────────────────────────────────────────────────────
function encodePCMasWAV(left: Float32Array[], right: Float32Array[], sampleRate: number): Blob {
  const total = left.reduce((s, a) => s + a.length, 0);
  if (total === 0) return new Blob([], { type: "audio/wav" });
  const numCh = 2, bps = 2;
  const dataSize = total * numCh * bps;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numCh * bps, true); v.setUint16(32, numCh * bps, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, dataSize, true);
  let off = 44, li = 0, lci = 0, ri = 0, rci = 0;
  for (let i = 0; i < total; i++) {
    const l = Math.max(-1, Math.min(1, left[li][lci++]));
    const r = Math.max(-1, Math.min(1, right[ri][rci++]));
    v.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7fff, true); off += 2;
    v.setInt16(off, r < 0 ? r * 0x8000 : r * 0x7fff, true); off += 2;
    if (lci >= left[li].length) { li++; lci = 0; }
    if (rci >= right[ri].length) { ri++; rci = 0; }
  }
  return new Blob([buf], { type: "audio/wav" });
}

// ── Synthetic reverb impulse ──────────────────────────────────────────────────
function createImpulse(ctx: AudioContext, durationSec = 1.5, decay = 3): AudioBuffer {
  const sr = ctx.sampleRate, len = Math.floor(sr * durationSec);
  const b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

// ── Per-track audio node bundle ───────────────────────────────────────────────
interface TrackNodes {
  el: HTMLAudioElement;
  pan: StereoPannerNode;
  bass: BiquadFilterNode;
  treble: BiquadFilterNode;
  convolver: ConvolverNode;
  reverbGain: GainNode;
  sumGain: GainNode;
  masterGain: GainNode;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAudioMixer(): UseAudioMixerResult {
  const [state, setState] = useState<MixerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mixDuration, setMixDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [fadeInDuration, setFadeInDurationState] = useState(0);
  const [fadeOutDuration, setFadeOutDurationState] = useState(0);
  const [loop, setLoopState] = useState(false);
  const [clickEnabled, setClickEnabledState] = useState(false);
  const [bpm, setBpmState] = useState(120);

  // Refs for stale-closure-free access in async callbacks
  const tracksRef = useRef<TrackState[]>([]);
  const fadeInRef = useRef(0);
  const fadeOutRef = useRef(0);
  const loopRef = useRef(false);
  const clickEnabledRef = useRef(false);
  const bpmRef = useRef(120);
  const stateRef = useRef<MixerState>("idle");
  stateRef.current = state;

  // Audio graph
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<TrackNodes[]>([]);

  // Timers
  const timerRef = useRef<number | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const fadeOutTimeoutRef = useRef<number | null>(null);
  const offsetTimersRef = useRef<(number | null)[]>([]);
  const clickIntervalRef = useRef<number | null>(null);
  const nextClickTimeRef = useRef(0);
  const startTimeRef = useRef(0);

  // PCM capture
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const pcmLeftRef = useRef<Float32Array[]>([]);
  const pcmRightRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(44100);

  // ── Effective gain ──────────────────────────────────────────────────────────
  const effectiveGain = useCallback((i: number): number => {
    const ts = tracksRef.current;
    const t = ts[i];
    if (!t) return 0;
    if (t.muted) return 0;
    const anySoloed = ts.some(tt => tt.soloed);
    if (anySoloed && !t.soloed) return 0;
    return t.volume;
  }, []);

  const applyGain = useCallback((i: number) => {
    const ctx = ctxRef.current; const n = nodesRef.current[i];
    if (!ctx || !n) return;
    n.masterGain.gain.cancelScheduledValues(ctx.currentTime);
    n.masterGain.gain.setValueAtTime(effectiveGain(i), ctx.currentTime);
  }, [effectiveGain]);

  const applyAllGains = useCallback(() => {
    nodesRef.current.forEach((_, i) => applyGain(i));
  }, [applyGain]);

  // ── Click track ─────────────────────────────────────────────────────────────
  const stopClick = useCallback(() => {
    if (clickIntervalRef.current) { clearInterval(clickIntervalRef.current); clickIntervalRef.current = null; }
  }, []);

  const startClick = useCallback((ctx: AudioContext) => {
    if (!clickEnabledRef.current) return;
    nextClickTimeRef.current = ctx.currentTime;
    clickIntervalRef.current = window.setInterval(() => {
      const beatInterval = 60 / Math.max(20, bpmRef.current);
      while (nextClickTimeRef.current < ctx.currentTime + 0.12) {
        const t = nextClickTimeRef.current;
        const osc = ctx.createOscillator();
        const cg = ctx.createGain();
        osc.frequency.value = 1200;
        cg.gain.setValueAtTime(0.4, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
        osc.connect(cg).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.02);
        nextClickTimeRef.current += beatInterval;
      }
    }, 25);
  }, []);

  // ── Timer management ────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (playTimeoutRef.current) { clearTimeout(playTimeoutRef.current); playTimeoutRef.current = null; }
    if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; }
    offsetTimersRef.current.forEach((t, i) => {
      if (t != null) { clearTimeout(t); offsetTimersRef.current[i] = null; }
    });
    stopClick();
  }, [stopClick]);

  const startElapsedTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
  }, []);

  const haltElements = useCallback(() => {
    nodesRef.current.forEach(n => { if (!n) return; n.el.pause(); n.el.currentTime = 0; });
  }, []);

  // ── PCM capture teardown ────────────────────────────────────────────────────
  const finishCapture = useCallback((): Blob => {
    const sp = scriptProcessorRef.current; const sg = silentGainRef.current;
    if (sp) { sp.onaudioprocess = null; try { sp.disconnect(); } catch {} scriptProcessorRef.current = null; }
    if (sg) { try { sg.disconnect(); } catch {} silentGainRef.current = null; }
    const blob = encodePCMasWAV(pcmLeftRef.current, pcmRightRef.current, sampleRateRef.current);
    pcmLeftRef.current = []; pcmRightRef.current = [];
    return blob;
  }, []);

  // ── Track state update helper ───────────────────────────────────────────────
  const updateTrack = useCallback((i: number, patch: Partial<TrackState>) => {
    tracksRef.current = tracksRef.current.map((t, idx) => idx === i ? { ...t, ...patch } : t);
    setTracks([...tracksRef.current]);
  }, []);

  // ── Public setters ──────────────────────────────────────────────────────────
  const setTrackVolume = useCallback((i: number, v: number) => {
    updateTrack(i, { volume: v }); applyGain(i);
  }, [updateTrack, applyGain]);

  const setTrackPan = useCallback((i: number, v: number) => {
    updateTrack(i, { pan: v });
    const n = nodesRef.current[i]; if (n) n.pan.pan.value = v;
  }, [updateTrack]);

  const setTrackMuted = useCallback((i: number, v: boolean) => {
    updateTrack(i, { muted: v }); applyAllGains();
  }, [updateTrack, applyAllGains]);

  const setTrackSoloed = useCallback((i: number, v: boolean) => {
    tracksRef.current = tracksRef.current.map((t, idx) => ({ ...t, soloed: idx === i ? v : false }));
    setTracks([...tracksRef.current]); applyAllGains();
  }, [applyAllGains]);

  const setTrackOffset = useCallback((i: number, v: number) => { updateTrack(i, { offset: v }); }, [updateTrack]);

  const setTrackReverbWet = useCallback((i: number, v: number) => {
    updateTrack(i, { reverbWet: v });
    const n = nodesRef.current[i]; if (n) n.reverbGain.gain.value = v;
  }, [updateTrack]);

  const setTrackEqBass = useCallback((i: number, v: number) => {
    updateTrack(i, { eqBass: v });
    const n = nodesRef.current[i]; if (n) n.bass.gain.value = v;
  }, [updateTrack]);

  const setTrackEqTreble = useCallback((i: number, v: number) => {
    updateTrack(i, { eqTreble: v });
    const n = nodesRef.current[i]; if (n) n.treble.gain.value = v;
  }, [updateTrack]);

  const setFadeInDuration = useCallback((v: number) => { fadeInRef.current = v; setFadeInDurationState(v); }, []);
  const setFadeOutDuration = useCallback((v: number) => { fadeOutRef.current = v; setFadeOutDurationState(v); }, []);
  const setLoop = useCallback((v: boolean) => { loopRef.current = v; setLoopState(v); }, []);
  const setClickEnabled = useCallback((v: boolean) => { clickEnabledRef.current = v; setClickEnabledState(v); }, []);
  const setBpm = useCallback((v: number) => { bpmRef.current = v; setBpmState(v); }, []);

  // ── loadTracks ──────────────────────────────────────────────────────────────
  const loadTracks = useCallback(async (infos: TrackInfo[]) => {
    setError(null); setState("loading"); setRecordedBlob(null); setElapsedTime(0);
    try {
      const audioEls = infos.map(() => {
        const a = new Audio(); a.crossOrigin = "anonymous"; a.preload = "auto"; return a;
      });
      await Promise.all(infos.map((info, i) =>
        new Promise<void>((resolve, reject) => {
          audioEls[i].onerror = () => reject(new Error(`Could not load "${info.title}". Make sure it has audio recorded.`));
          audioEls[i].oncanplaythrough = () => resolve();
          audioEls[i].src = info.audioUrl;
          audioEls[i].load();
        })
      ));

      const dur = Math.max(...audioEls.map(a => a.duration || 0));
      const ctx = new AudioContext();
      const impulse = createImpulse(ctx);

      const nodes: TrackNodes[] = audioEls.map((el, i) => {
        const src = ctx.createMediaElementSource(el);
        const pan = ctx.createStereoPanner();
        const bass = ctx.createBiquadFilter();
        bass.type = "lowshelf"; bass.frequency.value = 200;
        const treble = ctx.createBiquadFilter();
        treble.type = "highshelf"; treble.frequency.value = 3000;
        const convolver = ctx.createConvolver();
        convolver.buffer = impulse;
        const reverbGain = ctx.createGain(); reverbGain.gain.value = 0;
        const sumGain = ctx.createGain(); sumGain.gain.value = 1;
        const masterGain = ctx.createGain();

        const init = tracksRef.current[i] ?? DEFAULT_TRACK;
        pan.pan.value = init.pan;
        bass.gain.value = init.eqBass;
        treble.gain.value = init.eqTreble;
        reverbGain.gain.value = init.reverbWet;

        // Dry path: src → pan → bass → treble → sumGain
        src.connect(pan).connect(bass).connect(treble).connect(sumGain);
        // Wet (reverb) path: treble → convolver → reverbGain → sumGain
        treble.connect(convolver).connect(reverbGain).connect(sumGain);
        // sumGain → masterGain → destination
        sumGain.connect(masterGain).connect(ctx.destination);

        return { el, pan, bass, treble, convolver, reverbGain, sumGain, masterGain };
      });

      const initialTracks = infos.map((_, i) => ({
        ...(i === 0 ? { ...DEFAULT_TRACK, offset: 0 } : DEFAULT_TRACK),
        ...(tracksRef.current[i] ? { pan: tracksRef.current[i].pan, volume: tracksRef.current[i].volume } : {}),
      }));
      tracksRef.current = initialTracks;
      ctxRef.current = ctx;
      nodesRef.current = nodes;
      offsetTimersRef.current = new Array(infos.length).fill(null);
      sampleRateRef.current = ctx.sampleRate;
      setTracks(initialTracks);
      setMixDuration(dur);
      setState("ready");
      initialTracks.forEach((_, i) => applyGain(i));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracks");
      setState("idle");
    }
  }, [applyGain]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared playback start ───────────────────────────────────────────────────
  const _startElements = useCallback((ctx: AudioContext, fi: number) => {
    const nodes = nodesRef.current;
    nodes.forEach((n, i) => {
      n.el.currentTime = 0;
      const g = n.masterGain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      if (fi > 0) {
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(effectiveGain(i), ctx.currentTime + fi);
      } else {
        g.gain.setValueAtTime(effectiveGain(i), ctx.currentTime);
      }
    });
    nodes.forEach((n, i) => {
      const offset = tracksRef.current[i]?.offset ?? 0;
      if (offset > 0) {
        offsetTimersRef.current[i] = window.setTimeout(() => {
          n.el.currentTime = 0; n.el.play().catch(() => {}); offsetTimersRef.current[i] = null;
        }, offset * 1000);
      } else if (offset < 0) {
        n.el.currentTime = Math.min(Math.abs(offset), n.el.duration || 9999);
        n.el.play().catch(() => {});
      } else {
        n.el.play().catch(() => {});
      }
    });
  }, [effectiveGain]);

  // ── play ────────────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    const ctx = ctxRef.current; const nodes = nodesRef.current;
    if (!ctx || nodes.length === 0) return;
    if (ctx.state === "suspended") ctx.resume();
    clearTimers();
    _startElements(ctx, fadeInRef.current);
    setState("playing"); setElapsedTime(0);
    startElapsedTimer(); startClick(ctx);

    const dur = mixDuration; const fo = fadeOutRef.current;
    playTimeoutRef.current = window.setTimeout(() => {
      if (stateRef.current !== "playing") return;
      if (loopRef.current) {
        nodes.forEach(n => { n.el.currentTime = 0; });
        startTimeRef.current = Date.now();
      } else if (fo > 0 && ctx) {
        nodes.forEach(n => {
          n.masterGain.gain.cancelScheduledValues(ctx.currentTime);
          n.masterGain.gain.setValueAtTime(n.masterGain.gain.value, ctx.currentTime);
          n.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
        });
        fadeOutTimeoutRef.current = window.setTimeout(() => {
          haltElements(); applyAllGains(); clearTimers(); setState("ready"); setElapsedTime(0);
        }, fo * 1000 + 100);
      } else {
        haltElements(); clearTimers(); setState("ready"); setElapsedTime(0);
      }
    }, Math.max(0, dur * 1000 - fo * 1000 - 100));
  }, [mixDuration, effectiveGain, applyAllGains, clearTimers, startElapsedTimer, startClick, haltElements, _startElements]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── stop ────────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    const ctx = ctxRef.current; const nodes = nodesRef.current; const fo = fadeOutRef.current;
    if (fo > 0 && ctx && nodes.length > 0) {
      nodes.forEach(n => {
        n.masterGain.gain.cancelScheduledValues(ctx.currentTime);
        n.masterGain.gain.setValueAtTime(n.masterGain.gain.value, ctx.currentTime);
        n.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fo);
      });
      fadeOutTimeoutRef.current = window.setTimeout(() => {
        haltElements(); applyAllGains(); clearTimers(); setState("ready"); setElapsedTime(0);
      }, fo * 1000 + 100);
    } else {
      haltElements(); clearTimers(); setState("ready"); setElapsedTime(0);
    }
  }, [haltElements, applyAllGains, clearTimers]);

  // ── startRecording ──────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    const ctx = ctxRef.current; const nodes = nodesRef.current;
    if (!ctx || nodes.length === 0) return;
    haltElements(); clearTimers(); setError(null);
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      setError("Could not start audio. Tap anywhere on the page first, then try again.");
      setState("ready"); return;
    }

    // PCM capture via ScriptProcessorNode (works on iOS Safari)
    const sp = ctx.createScriptProcessor(4096, 2, 2);
    const silentGain = ctx.createGain(); silentGain.gain.value = 0;
    pcmLeftRef.current = []; pcmRightRef.current = [];
    sp.onaudioprocess = (e) => {
      const inp = e.inputBuffer;
      const l = inp.getChannelData(0);
      const r = inp.numberOfChannels > 1 ? inp.getChannelData(1) : inp.getChannelData(0);
      pcmLeftRef.current.push(new Float32Array(l));
      pcmRightRef.current.push(new Float32Array(r));
    };
    nodes.forEach(n => n.masterGain.connect(sp));
    sp.connect(silentGain); silentGain.connect(ctx.destination);
    scriptProcessorRef.current = sp; silentGainRef.current = silentGain;

    setState("recording"); setElapsedTime(0);
    _startElements(ctx, fadeInRef.current);
    startElapsedTimer(); startClick(ctx);

    playTimeoutRef.current = window.setTimeout(() => {
      haltElements(); clearTimers();
      const blob = finishCapture(); setRecordedBlob(blob); setState("done");
    }, (mixDuration || 300) * 1000 + 500);
  }, [mixDuration, haltElements, clearTimers, startElapsedTimer, startClick, finishCapture, _startElements]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── stopRecording ───────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    haltElements(); clearTimers();
    const blob = finishCapture(); setRecordedBlob(blob); setState("done");
  }, [haltElements, clearTimers, finishCapture]);

  // ── reset ────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    haltElements(); clearTimers(); finishCapture();
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    nodesRef.current = []; tracksRef.current = []; offsetTimersRef.current = [];
    setTracks([]); setRecordedBlob(null); setElapsedTime(0); setMixDuration(0);
    setError(null); setState("idle");
  }, [haltElements, clearTimers, finishCapture]);

  return {
    state, error, mixDuration, recordedBlob, elapsedTime,
    tracks, fadeInDuration, fadeOutDuration, loop, clickEnabled, bpm,
    setTrackVolume, setTrackPan, setTrackMuted, setTrackSoloed,
    setTrackOffset, setTrackReverbWet, setTrackEqBass, setTrackEqTreble,
    setFadeInDuration, setFadeOutDuration, setLoop, setClickEnabled, setBpm,
    loadTracks, play, stop, startRecording, stopRecording, reset,
  };
}
