import { useState } from "react";
import { useListSongs, useCreateSong, getListSongsQueryKey, getGetSongStatsQueryKey } from "@workspace/api-client-react";
import type { Song as ApiSong } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Play, Square, Disc, Loader2, Check, Volume2, SlidersHorizontal, Repeat,
  ChevronRight, Timer, Mic,
} from "lucide-react";
import { useAudioMixer } from "@/hooks/use-audio-mixer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type MixableSong = ApiSong & { audioUrl: string };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PanLabel({ value }: { value: number }) {
  if (Math.abs(value) < 0.05) return <span className="font-mono text-xs text-muted-foreground w-8 text-center">C</span>;
  const side = value < 0 ? "L" : "R";
  const pct = Math.round(Math.abs(value) * 100);
  return <span className="font-mono text-xs text-muted-foreground w-8 text-center">{side}{pct}</span>;
}

function VuMeter({ level, className }: { level: number; className?: string }) {
  const segments = 12;
  const filled = Math.round(level * segments);
  return (
    <div className={cn("flex gap-[2px] items-end h-5", className)}>
      {Array.from({ length: segments }, (_, i) => {
        const active = i < filled;
        const color =
          i >= 10 ? (active ? "bg-red-500" : "bg-red-950/40")
          : i >= 8 ? (active ? "bg-yellow-400" : "bg-yellow-950/40")
          : (active ? "bg-green-400" : "bg-green-950/40");
        return (
          <div
            key={i}
            className={cn("rounded-[1px] transition-colors duration-75", color)}
            style={{ width: 5, height: 8 + i * 1.2 }}
          />
        );
      })}
    </div>
  );
}

function TrackControls({
  label,
  volume, onVolume,
  pan, onPan,
  fadeIn, onFadeIn,
  fadeOut, onFadeOut,
  trim, onTrim,
  level,
  isLive,
  disabled,
}: {
  label: string;
  volume: number; onVolume: (v: number) => void;
  pan: number; onPan: (v: number) => void;
  fadeIn: number; onFadeIn: (v: number) => void;
  fadeOut: number; onFadeOut: (v: number) => void;
  trim: number; onTrim: (v: number) => void;
  level: number;
  isLive: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Volume + VU */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vol</span>
          </div>
          <div className="flex items-center gap-2">
            {isLive && <VuMeter level={level} />}
            <span className="font-mono text-xs text-muted-foreground w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>
        <Slider
          data-testid={`slider-volume-${label.toLowerCase().replace(" ", "")}`}
          min={0} max={1} step={0.01}
          value={[volume]}
          onValueChange={([v]) => onVolume(v)}
          disabled={disabled}
        />
      </div>

      {/* Pan */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pan</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/50">L</span>
            <PanLabel value={pan} />
            <span className="text-[10px] text-muted-foreground/50">R</span>
          </div>
        </div>
        <Slider
          min={-1} max={1} step={0.01}
          value={[pan]}
          onValueChange={([v]) => onPan(v)}
          disabled={disabled}
        />
      </div>

      {/* Fade In / Fade Out */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fade In</span>
            <span className="font-mono text-xs text-muted-foreground">{fadeIn.toFixed(1)}s</span>
          </div>
          <Slider
            min={0} max={5} step={0.1}
            value={[fadeIn]}
            onValueChange={([v]) => onFadeIn(v)}
            disabled={isLive}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fade Out</span>
            <span className="font-mono text-xs text-muted-foreground">{fadeOut.toFixed(1)}s</span>
          </div>
          <Slider
            min={0} max={5} step={0.1}
            value={[fadeOut]}
            onValueChange={([v]) => onFadeOut(v)}
            disabled={isLive}
          />
        </div>
      </div>

      {/* Trim */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start offset</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{trim.toFixed(1)}s</span>
        </div>
        <Slider
          min={0} max={10} step={0.1}
          value={[trim]}
          onValueChange={([v]) => onTrim(v)}
          disabled={isLive}
        />
      </div>
    </div>
  );
}

function TrackSelector({
  label,
  songs,
  selectedId,
  onChange,
  disabledId,
}: {
  label: string;
  songs: MixableSong[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
  disabledId: number | null;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
        {songs.map((song) => {
          const isSelected = selectedId === song.id;
          const isDisabled = disabledId === song.id;
          return (
            <button
              key={song.id}
              data-testid={`track-select-${song.id}`}
              disabled={isDisabled}
              onClick={() => onChange(isSelected ? null : song.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md border text-sm transition-all",
                "flex items-center justify-between gap-2",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : isDisabled
                  ? "border-border/30 text-muted-foreground/40 cursor-not-allowed"
                  : "border-border/50 text-foreground hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
              )}
            >
              <span className="truncate font-medium">{song.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                {song.duration != null && (
                  <span className="font-mono text-xs text-muted-foreground">{formatDuration(song.duration)}</span>
                )}
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Mixer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allSongs = [] } = useListSongs();
  const createSong = useCreateSong();

  const songs = allSongs.filter(
    (s): s is MixableSong => s.hasAudio && typeof s.audioUrl === "string"
  );

  const [track1Id, setTrack1Id] = useState<number | null>(null);
  const [track2Id, setTrack2Id] = useState<number | null>(null);
  const [mixTitle, setMixTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const {
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
    setTrack1FadeIn, setTrack1FadeOut,
    setTrack2FadeIn, setTrack2FadeOut,
    setTrack1Trim, setTrack2Trim,
    setLoop,
    loadTracks, play, stop, startRecording, stopRecording, reset,
    elapsedTime,
  } = useAudioMixer();

  const track1 = songs.find((s) => s.id === track1Id) ?? null;
  const track2 = songs.find((s) => s.id === track2Id) ?? null;
  const canLoad = !!track1 && !!track2 && state === "idle";
  const isLive = state === "playing" || state === "recording";
  const isLoaded = state === "ready" || isLive || state === "done";

  const handleLoad = async () => {
    if (!track1 || !track2) return;
    setIsLoadingTracks(true);
    await loadTracks(
      { id: track1.id, title: track1.title, audioUrl: track1.audioUrl },
      { id: track2.id, title: track2.title, audioUrl: track2.audioUrl }
    );
    setIsLoadingTracks(false);
  };

  const handleReset = () => {
    reset();
    setTrack1Id(null);
    setTrack2Id(null);
    setMixTitle("");
  };

  const handleSaveMix = async () => {
    if (!recordedBlob || !mixTitle.trim()) return;
    setIsSaving(true);
    try {
      const song = await new Promise<{ id: number }>((resolve, reject) => {
        createSong.mutate(
          {
            data: {
              title: mixTitle.trim(),
              notes: `Mixed from: ${track1?.title ?? "Track A"} + ${track2?.title ?? "Track B"}`,
              tags: "mix",
            },
          },
          { onSuccess: resolve, onError: reject }
        );
      });

      const formData = new FormData();
      formData.append("audio", recordedBlob, "mix.webm");
      formData.append("duration", String(mixDuration));

      const res = await fetch(`/api/songs/${song.id}/audio`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to upload mix audio");

      await queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });

      toast({ title: "Mix saved!", description: `"${mixTitle.trim()}" added to your library.` });
      handleReset();
    } catch {
      toast({ title: "Save failed", description: "Could not save the mix. Try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const trackControlsProps = (which: 1 | 2) => which === 1
    ? {
        label: "Track A",
        volume: track1Volume, onVolume: setTrack1Volume,
        pan: track1Pan, onPan: setTrack1Pan,
        fadeIn: track1FadeIn, onFadeIn: setTrack1FadeIn,
        fadeOut: track1FadeOut, onFadeOut: setTrack1FadeOut,
        trim: track1Trim, onTrim: setTrack1Trim,
        level: track1Level,
      }
    : {
        label: "Track B",
        volume: track2Volume, onVolume: setTrack2Volume,
        pan: track2Pan, onPan: setTrack2Pan,
        fadeIn: track2FadeIn, onFadeIn: setTrack2FadeIn,
        fadeOut: track2FadeOut, onFadeOut: setTrack2FadeOut,
        trim: track2Trim, onTrim: setTrack2Trim,
        level: track2Level,
      };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Mixer</h1>
        </div>
        <p className="text-muted-foreground">Layer two tracks together with volume, pan, fades, and timing.</p>
      </div>

      {songs.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Disc className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">You need at least 2 recorded tracks to mix.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Head to the Studio to record some tracks first.</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Track setup (idle only) */}
          {state === "idle" && (
            <div className="grid grid-cols-2 gap-5">
              {([1, 2] as const).map((which) => {
                const props = trackControlsProps(which);
                return (
                  <div key={which} className="rounded-xl border border-border bg-card p-5 space-y-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">{props.label}</span>
                    </div>
                    <TrackSelector
                      label="Track"
                      songs={songs}
                      selectedId={which === 1 ? track1Id : track2Id}
                      onChange={which === 1 ? setTrack1Id : setTrack2Id}
                      disabledId={which === 1 ? track2Id : track1Id}
                    />
                    <div className="h-px bg-border" />
                    <TrackControls
                      {...props}
                      isLive={false}
                      disabled={false}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Loaded controls */}
          {isLoaded && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="grid grid-cols-2 gap-8">
                {([1, 2] as const).map((which) => {
                  const props = trackControlsProps(which);
                  const title = which === 1 ? track1?.title : track2?.title;
                  return (
                    <div key={which} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">{props.label}</span>
                        <span className="font-medium text-sm truncate max-w-[150px] text-muted-foreground">{title}</span>
                      </div>
                      <TrackControls
                        {...props}
                        isLive={isLive}
                        disabled={state === "recording"}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Fade/trim applied badge when live */}
              {(track1FadeIn > 0 || track1FadeOut > 0 || track2FadeIn > 0 || track2FadeOut > 0 || track1Trim > 0 || track2Trim > 0) && (
                <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2">
                  {[
                    track1FadeIn > 0 && `A fade in ${track1FadeIn.toFixed(1)}s`,
                    track1FadeOut > 0 && `A fade out ${track1FadeOut.toFixed(1)}s`,
                    track1Trim > 0 && `A offset +${track1Trim.toFixed(1)}s`,
                    track2FadeIn > 0 && `B fade in ${track2FadeIn.toFixed(1)}s`,
                    track2FadeOut > 0 && `B fade out ${track2FadeOut.toFixed(1)}s`,
                    track2Trim > 0 && `B offset +${track2Trim.toFixed(1)}s`,
                  ].filter(Boolean).map((label) => (
                    <span key={label as string} className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {label as string}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transport */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {state === "recording" && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
                {state === "playing" && <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
                <span className="text-sm font-medium text-muted-foreground">
                  {state === "idle" ? "Select two tracks above"
                    : state === "ready" ? "Ready — preview or record"
                    : state === "playing" ? "Previewing mix…"
                    : state === "recording" ? "Recording mix…"
                    : "Mix captured"}
                </span>
              </div>
              {(isLive) && (
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {formatDuration(elapsedTime)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ {formatDuration(Math.ceil(mixDuration))}</span>
                </span>
              )}
              {state === "ready" && mixDuration > 0 && (
                <span className="font-mono text-sm text-muted-foreground">
                  Mix: {formatDuration(Math.ceil(mixDuration))}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {isLive && mixDuration > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full mb-5 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", state === "recording" ? "bg-red-500" : "bg-primary")}
                  style={{ width: `${Math.min((elapsedTime / mixDuration) * 100, 100)}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {state === "idle" && (
                <Button
                  data-testid="button-load-tracks"
                  onClick={handleLoad}
                  disabled={!canLoad || isLoadingTracks}
                  className="gap-2"
                >
                  {isLoadingTracks ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  {isLoadingTracks ? "Loading…" : "Load Tracks"}
                </Button>
              )}

              {state === "ready" && (
                <>
                  <Button
                    data-testid="button-preview-mix"
                    variant="outline"
                    onClick={play}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Preview Mix
                  </Button>
                  <button
                    data-testid="button-loop-toggle"
                    onClick={() => setLoop(!loop)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                      loop
                        ? "bg-primary/15 border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    Loop
                  </button>
                  <Button
                    data-testid="button-record-mix"
                    onClick={startRecording}
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Mic className="w-4 h-4" />
                    Record Mix
                  </Button>
                  <Button
                    data-testid="button-reset-mixer"
                    variant="ghost"
                    onClick={handleReset}
                    className="ml-auto text-muted-foreground"
                  >
                    Start Over
                  </Button>
                </>
              )}

              {state === "playing" && (
                <Button data-testid="button-stop-preview" variant="outline" onClick={stop} className="gap-2">
                  <Square className="w-4 h-4" />
                  Stop Preview
                </Button>
              )}

              {state === "recording" && (
                <Button
                  data-testid="button-stop-recording"
                  onClick={stopRecording}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Square className="w-4 h-4" />
                  Stop Recording
                </Button>
              )}

              {state === "done" && !recordedBlob && (
                <span className="text-muted-foreground text-sm">Processing…</span>
              )}
            </div>
          </div>

          {/* Save form */}
          {state === "done" && recordedBlob && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
              <h2 className="font-semibold text-lg">Save Your Mix</h2>
              <p className="text-sm text-muted-foreground">Give your mix a name — it'll be added to your library as a new track.</p>
              <div className="space-y-2">
                <Label htmlFor="mix-title">Mix Title</Label>
                <Input
                  id="mix-title"
                  data-testid="input-mix-title"
                  placeholder="e.g. Verse Jam — May 20"
                  value={mixTitle}
                  onChange={(e) => setMixTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveMix()}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  data-testid="button-save-mix"
                  onClick={handleSaveMix}
                  disabled={!mixTitle.trim() || isSaving}
                  className="gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save to Library
                </Button>
                <Button
                  data-testid="button-record-again"
                  variant="outline"
                  onClick={() => reset()}
                  disabled={isSaving}
                >
                  Record Again
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
