import { useEffect, useRef, useState } from "react";
import {
  useListTakes,
  useUpdateTake,
  useDeleteTake,
  getListTakesQueryKey,
} from "@workspace/api-client-react";
import type { Take } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Pause, Download, Trash2, Loader2, Users, Volume2, AlignHorizontalSpaceAround } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { audioBufferToWav } from "@/lib/wav-encoder";
import { formatDistanceToNow } from "date-fns";

interface Props {
  songId: number;
  songTitle: string;
  originalAudioUrl: string;
}

type LoadedBuffer = { take: Take | null; buffer: AudioBuffer };

async function fetchBuffer(ctx: AudioContext | OfflineAudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const ab = await res.arrayBuffer();
  return await ctx.decodeAudioData(ab);
}

export function TakesMixer({ songId, songTitle, originalAudioUrl }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: takes = [], isLoading } = useListTakes(songId, {
    query: { queryKey: getListTakesQueryKey(songId) },
  });
  const updateTake = useUpdateTake();
  const deleteTake = useDeleteTake();

  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<{ original?: AudioBuffer; takes: Map<number, AudioBuffer> }>({ takes: new Map() });
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Local mix-state mirror so sliders feel instant (debounced PATCH)
  const [mix, setMix] = useState<Record<number, { volume: number; pan: number; offsetMs: number }>>({});
  useEffect(() => {
    setMix((prev) => {
      const next = { ...prev };
      for (const t of takes) {
        if (!next[t.id]) next[t.id] = { volume: t.volume, pan: t.pan, offsetMs: t.offsetMs };
      }
      return next;
    });
  }, [takes]);

  const stop = () => {
    sourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* ignore */ } });
    sourcesRef.current = [];
    setPlaying(false);
  };

  useEffect(() => () => { stop(); ctxRef.current?.close(); }, []);

  const ensureBuffers = async (ctx: AudioContext | OfflineAudioContext) => {
    if (!buffersRef.current.original) {
      buffersRef.current.original = await fetchBuffer(ctx, originalAudioUrl);
    }
    for (const t of takes) {
      if (!buffersRef.current.takes.has(t.id)) {
        buffersRef.current.takes.set(t.id, await fetchBuffer(ctx, t.audioUrl));
      }
    }
  };

  const buildGraph = (
    ctx: AudioContext | OfflineAudioContext,
    destination: AudioNode,
    items: LoadedBuffer[],
    startAt: number,
  ): AudioBufferSourceNode[] => {
    const sources: AudioBufferSourceNode[] = [];
    for (const { take, buffer } of items) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      gain.gain.value = take ? (mix[take.id]?.volume ?? take.volume) : 1;
      panner.pan.value = take ? (mix[take.id]?.pan ?? take.pan) : 0;
      src.connect(gain).connect(panner).connect(destination);
      const offsetSec = take ? ((mix[take.id]?.offsetMs ?? take.offsetMs) / 1000) : 0;
      src.start(startAt + Math.max(0, offsetSec), Math.max(0, -offsetSec));
      sources.push(src);
    }
    return sources;
  };

  const playMix = async () => {
    if (playing) { stop(); return; }
    setLoading(true);
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      await ensureBuffers(ctx);
      const items: LoadedBuffer[] = [
        { take: null, buffer: buffersRef.current.original! },
        ...takes.map((t) => ({ take: t, buffer: buffersRef.current.takes.get(t.id)! })),
      ];
      const startAt = ctx.currentTime + 0.05;
      sourcesRef.current = buildGraph(ctx, ctx.destination, items, startAt);
      const longest = Math.max(
        buffersRef.current.original!.duration,
        ...takes.map((t) => (buffersRef.current.takes.get(t.id)?.duration ?? 0) + Math.max(0, (mix[t.id]?.offsetMs ?? t.offsetMs) / 1000)),
      );
      setPlaying(true);
      setTimeout(() => setPlaying(false), longest * 1000 + 100);
    } catch (err) {
      toast({ title: "Could not play mix", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportMix = async () => {
    setExporting(true);
    try {
      // Use a regular AudioContext just to decode once if needed
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      await ensureBuffers(ctxRef.current);
      const original = buffersRef.current.original!;
      const longest = Math.max(
        original.duration,
        ...takes.map((t) => (buffersRef.current.takes.get(t.id)?.duration ?? 0) + Math.max(0, (mix[t.id]?.offsetMs ?? t.offsetMs) / 1000)),
      );
      const sampleRate = original.sampleRate;
      const offline = new OfflineAudioContext(2, Math.ceil(longest * sampleRate) + sampleRate, sampleRate);
      const items: LoadedBuffer[] = [
        { take: null, buffer: original },
        ...takes.map((t) => ({ take: t, buffer: buffersRef.current.takes.get(t.id)! })),
      ];
      buildGraph(offline, offline.destination, items, 0);
      const rendered = await offline.startRendering();
      const wav = audioBufferToWav(rendered);
      const url = URL.createObjectURL(wav);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${songTitle.replace(/[^a-z0-9]+/gi, "_")}_mix.wav`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Mix downloaded" });
    } catch (err) {
      toast({ title: "Could not export mix", description: String(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const persist = (takeId: number, patch: Partial<{ volume: number; pan: number; offsetMs: number }>) => {
    updateTake.mutate(
      { songId, takeId, data: patch },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTakesQueryKey(songId) }) },
    );
  };

  const removeTake = (takeId: number) => {
    if (!confirm("Remove this take?")) return;
    deleteTake.mutate(
      { songId, takeId },
      {
        onSuccess: () => {
          buffersRef.current.takes.delete(takeId);
          queryClient.invalidateQueries({ queryKey: getListTakesQueryKey(songId) });
          toast({ title: "Take removed" });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">
            Takes from friends {takes.length > 0 && (
              <span className="text-muted-foreground font-normal ml-1">({takes.length})</span>
            )}
          </h3>
        </div>
        {takes.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" onClick={playMix} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {playing ? "Stop" : "Play mix"}
            </Button>
            <Button size="sm" variant="outline" onClick={exportMix} disabled={exporting} className="gap-1.5">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download mix
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
      ) : takes.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-lg">
          No takes yet. Share the link with a friend and ask them to record their part.
        </div>
      ) : (
        <div className="space-y-3">
          {takes.map((t) => {
            const m = mix[t.id] ?? { volume: t.volume, pan: t.pan, offsetMs: t.offsetMs };
            return (
              <div key={t.id} className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="font-semibold text-sm text-primary">{t.author}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-2">
                      {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      {t.duration && ` · ${t.duration.toFixed(1)}s`}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeTake(t.id)} className="h-7 w-7 p-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <audio src={t.audioUrl} controls className="w-full h-8" />

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Volume2 className="w-3 h-3" /> Vol {Math.round(m.volume * 100)}%
                    </label>
                    <Slider
                      value={[m.volume]} min={0} max={2} step={0.05}
                      onValueChange={([v]) => setMix((s) => ({ ...s, [t.id]: { ...m, volume: v } }))}
                      onValueCommit={([v]) => persist(t.id, { volume: v })}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-muted-foreground mb-1">
                      <AlignHorizontalSpaceAround className="w-3 h-3" /> Pan {m.pan === 0 ? "C" : m.pan < 0 ? `L${Math.round(-m.pan * 100)}` : `R${Math.round(m.pan * 100)}`}
                    </label>
                    <Slider
                      value={[m.pan]} min={-1} max={1} step={0.05}
                      onValueChange={([v]) => setMix((s) => ({ ...s, [t.id]: { ...m, pan: v } }))}
                      onValueCommit={([v]) => persist(t.id, { pan: v })}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground mb-1 block">Offset {m.offsetMs > 0 ? "+" : ""}{m.offsetMs}ms</label>
                    <Slider
                      value={[m.offsetMs]} min={-500} max={500} step={10}
                      onValueChange={([v]) => setMix((s) => ({ ...s, [t.id]: { ...m, offsetMs: Math.round(v) } }))}
                      onValueCommit={([v]) => persist(t.id, { offsetMs: Math.round(v) })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
