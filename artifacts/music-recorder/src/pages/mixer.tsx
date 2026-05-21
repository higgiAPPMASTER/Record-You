import { useState, useEffect, useCallback } from "react";
import { useListSongs } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Square, Disc, Loader2, Check, Volume2, SlidersHorizontal, Repeat } from "lucide-react";
import { useAudioMixer } from "@/hooks/use-audio-mixer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { listLocalSongs, getLocalAudioUrl, type LocalSong } from "@/lib/local-songs";
import { getListSongsQueryKey, getGetSongStatsQueryKey, useCreateSong } from "@workspace/api-client-react";

type MixableTrack = {
  key: string;
  title: string;
  duration: number | null;
  source: "local" | "cloud";
  localId?: string;
  cloudId?: number;
  cloudAudioUrl?: string;
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TrackSelector({
  label,
  tracks,
  selectedKey,
  onChange,
  disabledKey,
}: {
  label: string;
  tracks: MixableTrack[];
  selectedKey: string | null;
  onChange: (key: string | null) => void;
  disabledKey: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </Label>
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {tracks.map((track) => {
          const isSelected = selectedKey === track.key;
          const isDisabled = disabledKey === track.key;
          return (
            <button
              key={track.key}
              disabled={isDisabled}
              onClick={() => onChange(isSelected ? null : track.key)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-md border text-sm transition-all",
                "flex items-center justify-between gap-2",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : isDisabled
                  ? "border-border/30 text-muted-foreground/40 cursor-not-allowed"
                  : "border-border/50 text-foreground hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
              )}
            >
              <span className="truncate font-medium">{track.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  "text-[10px] font-mono px-1 rounded",
                  track.source === "local"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary"
                )}>
                  {track.source === "local" ? "device" : "cloud"}
                </span>
                {track.duration != null && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDuration(track.duration)}
                  </span>
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
  const { data: cloudSongs = [] } = useListSongs();
  const createSong = useCreateSong();

  const [localSongs, setLocalSongs] = useState<LocalSong[]>([]);
  useEffect(() => { setLocalSongs(listLocalSongs()); }, []);

  // Combine local + cloud into a unified mixable list (skip duplicates: local songs
  // that are already uploaded appear as both — prefer the cloud version so it has a
  // stable API audio URL, unless it's local-only)
  const tracks: MixableTrack[] = (() => {
    const items: MixableTrack[] = [];
    // Cloud songs first (they have server-side audio)
    for (const s of cloudSongs) {
      if (s.hasAudio && typeof s.audioUrl === "string") {
        items.push({
          key: `cloud-${s.id}`,
          title: s.title,
          duration: s.duration ?? null,
          source: "cloud",
          cloudId: s.id,
          cloudAudioUrl: s.audioUrl,
        });
      }
    }
    // Local songs — skip any that have already been uploaded (cloudId present, already in list)
    const cloudedLocalIds = new Set(localSongs.map((s) => s.cloudId).filter(Boolean));
    for (const s of localSongs) {
      if (s.cloudId && cloudedLocalIds.has(s.cloudId)) continue; // already represented
      items.push({
        key: `local-${s.id}`,
        title: s.title,
        duration: s.duration || null,
        source: "local",
        localId: s.id,
      });
    }
    return items;
  })();

  const [track1Key, setTrack1Key] = useState<string | null>(null);
  const [track2Key, setTrack2Key] = useState<string | null>(null);
  const [mixTitle, setMixTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const {
    state, error, mixDuration, recordedBlob,
    track1Volume, track2Volume, loop,
    setTrack1Volume, setTrack2Volume, setLoop,
    loadTracks, play, stop, startRecording, stopRecording, reset, elapsedTime,
  } = useAudioMixer();

  const track1 = tracks.find((t) => t.key === track1Key) ?? null;
  const track2 = tracks.find((t) => t.key === track2Key) ?? null;
  const canLoad = !!track1 && !!track2 && state === "idle";
  const isLoaded = state === "ready" || state === "playing" || state === "recording" || state === "done";

  const resolveAudioUrl = useCallback(async (track: MixableTrack): Promise<string> => {
    if (track.source === "cloud" && track.cloudAudioUrl) return track.cloudAudioUrl;
    if (track.source === "local" && track.localId) {
      const url = await getLocalAudioUrl(track.localId);
      if (!url) throw new Error(`No audio found on device for "${track.title}". Try recording it again.`);
      return url;
    }
    throw new Error(`No audio URL for "${track.title}"`);
  }, []);

  const handleLoad = async () => {
    if (!track1 || !track2) return;
    setIsLoadingTracks(true);
    try {
      const [url1, url2] = await Promise.all([
        resolveAudioUrl(track1),
        resolveAudioUrl(track2),
      ]);
      await loadTracks(
        { id: track1.cloudId ?? 0, title: track1.title, audioUrl: url1 },
        { id: track2.cloudId ?? 0, title: track2.title, audioUrl: url2 },
      );
    } catch (err) {
      toast({
        title: "Could not load track",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleReset = () => {
    reset();
    setTrack1Key(null);
    setTrack2Key(null);
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Mixer</h1>
        </div>
        <p className="text-muted-foreground">Layer two tracks together and save the result as a new song.</p>
      </div>

      {tracks.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Disc className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">You need at least 2 recorded tracks to mix.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Head to the Studio to record some tracks first.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {state === "idle" && (
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                <TrackSelector
                  label="Track A"
                  tracks={tracks}
                  selectedKey={track1Key}
                  onChange={setTrack1Key}
                  disabledKey={track2Key}
                />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Volume A</Label>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{Math.round(track1Volume * 100)}%</span>
                  </div>
                  <Slider min={0} max={1} step={0.01} value={[track1Volume]} onValueChange={([v]) => setTrack1Volume(v)} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                <TrackSelector
                  label="Track B"
                  tracks={tracks}
                  selectedKey={track2Key}
                  onChange={setTrack2Key}
                  disabledKey={track1Key}
                />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Volume B</Label>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{Math.round(track2Volume * 100)}%</span>
                  </div>
                  <Slider min={0} max={1} step={0.01} value={[track2Volume]} onValueChange={([v]) => setTrack2Volume(v)} />
                </div>
              </div>
            </div>
          )}

          {isLoaded && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="grid grid-cols-2 gap-8">
                {[
                  { label: "Track A", title: track1?.title ?? "", volume: track1Volume, setVolume: setTrack1Volume },
                  { label: "Track B", title: track2?.title ?? "", volume: track2Volume, setVolume: setTrack2Volume },
                ].map(({ label, title, volume, setVolume }) => (
                  <div key={label} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
                      <span className="font-medium text-sm truncate max-w-[160px]">{title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <Slider min={0} max={1} step={0.01} value={[volume]} onValueChange={([v]) => setVolume(v)} disabled={state === "recording"} />
                      <span className="font-mono text-xs text-muted-foreground w-8 text-right">{Math.round(volume * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {state === "recording" && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
                {state === "playing" && <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
                <span className="text-sm font-medium text-muted-foreground">
                  {state === "idle" ? "Select two tracks above"
                    : state === "loading" ? "Loading tracks..."
                    : state === "ready" ? "Ready to play or record"
                    : state === "playing" ? "Previewing mix..."
                    : state === "recording" ? "Recording mix..."
                    : "Mix captured"}
                </span>
              </div>
              {(state === "playing" || state === "recording") && (
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {formatDuration(elapsedTime)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ {formatDuration(Math.ceil(mixDuration))}</span>
                </span>
              )}
              {state === "ready" && mixDuration > 0 && (
                <span className="font-mono text-sm text-muted-foreground">Mix length: {formatDuration(Math.ceil(mixDuration))}</span>
              )}
            </div>

            {(state === "playing" || state === "recording") && mixDuration > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full mb-6 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", state === "recording" ? "bg-red-500" : "bg-primary")}
                  style={{ width: `${Math.min((elapsedTime / mixDuration) * 100, 100)}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {state === "idle" && (
                <Button onClick={handleLoad} disabled={!canLoad || isLoadingTracks} className="gap-2">
                  {isLoadingTracks && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoadingTracks ? "Loading..." : "Load Tracks"}
                </Button>
              )}

              {state === "ready" && (
                <>
                  <Button variant="outline" onClick={play} className="gap-2">
                    <Play className="w-4 h-4" /> Preview Mix
                  </Button>
                  <button
                    onClick={() => setLoop(!loop)}
                    title={loop ? "Loop on" : "Loop off"}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                      loop ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    <Repeat className="w-3.5 h-3.5" /> Loop
                  </button>
                  <Button onClick={startRecording} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <span className="w-3 h-3 rounded-full bg-white" /> Record Mix
                  </Button>
                  <Button variant="ghost" onClick={handleReset} className="ml-auto text-muted-foreground">Start Over</Button>
                </>
              )}

              {state === "playing" && (
                <Button variant="outline" onClick={stop} className="gap-2">
                  <Square className="w-4 h-4" /> Stop Preview
                </Button>
              )}

              {state === "recording" && (
                <Button onClick={stopRecording} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                  <Square className="w-4 h-4" /> Stop Recording
                </Button>
              )}

              {state === "done" && !recordedBlob && (
                <span className="text-muted-foreground text-sm">Processing...</span>
              )}
            </div>
          </div>

          {state === "done" && recordedBlob && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
              <h2 className="font-semibold text-lg">Save Your Mix</h2>
              <p className="text-sm text-muted-foreground">Give your mix a name and it will be added to your library as a new track.</p>
              <div className="space-y-2">
                <Label htmlFor="mix-title">Mix Title</Label>
                <Input
                  id="mix-title"
                  placeholder="e.g. Verse Jam — May 19"
                  value={mixTitle}
                  onChange={(e) => setMixTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveMix()}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSaveMix} disabled={!mixTitle.trim() || isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save to Library
                </Button>
                <Button variant="outline" onClick={() => reset()} disabled={isSaving}>Record Again</Button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <strong>Error:</strong> {error}
              {error.includes("decode") && (
                <span className="block mt-1 text-destructive/70">
                  Your browser may not support this audio format. Try a different browser (Chrome works best).
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
