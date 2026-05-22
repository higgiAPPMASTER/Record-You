import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { Scissors, Play, Square, Check, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { listLocalSongs, getLocalAudioUrl } from "@/lib/local-songs";
import { useGetSong, useCreateSong } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListSongsQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

function encodeWAV(left: Float32Array, right: Float32Array, sr: number): Blob {
  const total = left.length;
  const numCh = 2, bps = 2;
  const dataSize = total * numCh * bps;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * numCh * bps, true); v.setUint16(32, numCh * bps, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < total; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    v.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7fff, true); off += 2;
    v.setInt16(off, r < 0 ? r * 0x8000 : r * 0x7fff, true); off += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

function formatTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function Trim() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSong = useCreateSong();

  const params = new URLSearchParams(search);
  const cloudId = params.get("cloudId");
  const localId = params.get("localId");
  const songTitle = params.get("title") ?? "Untitled";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trimStartPct, setTrimStartPct] = useState(0);
  const [trimEndPct, setTrimEndPct] = useState(100);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState(`${songTitle} (trimmed)`);

  const duration = audioBuffer?.duration ?? 0;
  const trimStart = (trimStartPct / 100) * duration;
  const trimEnd = (trimEndPct / 100) * duration;
  const trimDuration = Math.max(0, trimEnd - trimStart);

  // Load audio
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true); setLoadError(null);

    (async () => {
      try {
        let url: string | null = null;
        if (localId) {
          const locals = listLocalSongs();
          const song = locals.find(s => s.id === localId);
          if (!song) throw new Error("Local song not found");
          url = await getLocalAudioUrl(localId);
        } else if (cloudId) {
          const res = await fetch(`/api/songs/${cloudId}`);
          if (!res.ok) throw new Error("Could not load song");
          const data = await res.json();
          url = data.audioUrl;
        }
        if (!url || cancelled) return;
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        await ctx.close();
        if (cancelled) return;
        setAudioBuffer(decoded);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load audio");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cloudId, localId]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth; const H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const data = audioBuffer.getChannelData(0);
    const numBars = 200;
    const step = Math.floor(data.length / numBars);
    const peaks: number[] = [];
    for (let i = 0; i < numBars; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j] ?? 0));
      peaks.push(max);
    }
    const maxPeak = Math.max(...peaks, 0.001);

    peaks.forEach((p, i) => {
      const x = (i / numBars) * W;
      const barW = W / numBars - 0.5;
      const barH = Math.max(2, (p / maxPeak) * (H - 8));
      const y = (H - barH) / 2;
      const frac = i / numBars;
      const inRange = frac >= trimStartPct / 100 && frac <= trimEndPct / 100;
      ctx.fillStyle = inRange ? "hsl(var(--primary))" : "hsl(var(--muted))";
      ctx.globalAlpha = inRange ? 0.85 : 0.35;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 1);
      ctx.fill();
    });
  }, [audioBuffer, trimStartPct, trimEndPct]);

  const stopPreview = useCallback(() => {
    previewSourceRef.current?.stop();
    previewSourceRef.current = null;
    setIsPreviewing(false);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!audioBuffer) return;
    stopPreview();
    if (previewCtxRef.current) { await previewCtxRef.current.close(); previewCtxRef.current = null; }

    const ctx = new AudioContext();
    previewCtxRef.current = ctx;

    // Slice the buffer to trimmed section
    const startSample = Math.floor(trimStart * audioBuffer.sampleRate);
    const endSample = Math.floor(trimEnd * audioBuffer.sampleRate);
    const len = endSample - startSample;
    if (len <= 0) return;

    const sliced = ctx.createBuffer(audioBuffer.numberOfChannels, len, audioBuffer.sampleRate);
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      sliced.copyToChannel(audioBuffer.getChannelData(c).slice(startSample, endSample), c);
    }

    const src = ctx.createBufferSource();
    src.buffer = sliced;
    src.connect(ctx.destination);
    src.start();
    src.onended = () => setIsPreviewing(false);
    previewSourceRef.current = src;
    setIsPreviewing(true);
  }, [audioBuffer, trimStart, trimEnd, stopPreview]);

  useEffect(() => () => { stopPreview(); previewCtxRef.current?.close(); }, [stopPreview]);

  const handleSave = useCallback(async () => {
    if (!audioBuffer || !saveTitle.trim()) return;
    setIsSaving(true);
    try {
      const startSample = Math.floor(trimStart * audioBuffer.sampleRate);
      const endSample = Math.floor(trimEnd * audioBuffer.sampleRate);
      const len = endSample - startSample;
      const sr = audioBuffer.sampleRate;
      const ch = audioBuffer.numberOfChannels;

      let left = audioBuffer.getChannelData(0).slice(startSample, endSample);
      let right = ch > 1 ? audioBuffer.getChannelData(1).slice(startSample, endSample) : left;

      const blob = encodeWAV(left, right, sr);
      const file = new File([blob], `${saveTitle.trim()}.wav`, { type: "audio/wav" });
      const form = new FormData();
      form.append("title", saveTitle.trim());
      form.append("audio", file);
      await createSong.mutateAsync(form as any);
      await queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      toast({ title: "Saved!", description: `"${saveTitle.trim()}" added to your library.` });
      navigate("/");
    } catch {
      toast({ title: "Save failed", description: "Could not save the trimmed track.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [audioBuffer, trimStart, trimEnd, saveTitle, createSong, queryClient, toast, navigate]);

  return (
    <div className="p-6 max-w-3xl mx-auto pb-32">
      <div className="mb-6">
        <button onClick={() => navigate(-1 as any)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 mb-1">
          <Scissors className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Trim</h1>
        </div>
        <p className="text-muted-foreground text-sm">Drag the handles to cut the start or end of <strong>{songTitle}</strong>.</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong>Error:</strong> {loadError}
        </div>
      )}

      {audioBuffer && !isLoading && (
        <div className="space-y-6">
          {/* Waveform canvas */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <canvas
              ref={canvasRef}
              className="w-full rounded"
              style={{ height: 80, display: "block" }}
            />

            {/* Start/end sliders */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs w-20 text-muted-foreground font-mono">Start</span>
                <input
                  type="range" min={0} max={trimEndPct - 1} step={0.1}
                  value={trimStartPct}
                  onChange={e => setTrimStartPct(parseFloat(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs w-12 font-mono text-muted-foreground text-right">{formatTime(trimStart)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs w-20 text-muted-foreground font-mono">End</span>
                <input
                  type="range" min={trimStartPct + 1} max={100} step={0.1}
                  value={trimEndPct}
                  onChange={e => setTrimEndPct(parseFloat(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs w-12 font-mono text-muted-foreground text-right">{formatTime(trimEnd)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Duration: <strong className="text-foreground font-mono">{formatTime(trimDuration)}</strong></span>
              <span>Original: <span className="font-mono">{formatTime(duration)}</span></span>
              <button
                onClick={() => { setTrimStartPct(0); setTrimEndPct(100); }}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3">
            {isPreviewing ? (
              <Button variant="outline" onClick={stopPreview} className="gap-2">
                <Square className="w-4 h-4" /> Stop Preview
              </Button>
            ) : (
              <Button variant="outline" onClick={handlePreview} className="gap-2">
                <Play className="w-4 h-4" /> Preview Trim
              </Button>
            )}
            <span className="text-sm text-muted-foreground">Hear the trimmed section before saving.</span>
          </div>

          {/* Save */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
            <h2 className="font-semibold">Save Trimmed Track</h2>
            <div className="space-y-2">
              <Label htmlFor="save-title">Track Title</Label>
              <Input
                id="save-title"
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </div>
            <Button onClick={handleSave} disabled={!saveTitle.trim() || isSaving || trimDuration <= 0} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save to Library
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
