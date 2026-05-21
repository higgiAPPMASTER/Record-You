import { useState, useEffect, useCallback } from "react";
import { useListSongs } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Play, Square, Disc, Loader2, Check, Volume2,
  SlidersHorizontal, Repeat, VolumeX, Zap,
} from "lucide-react";
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
  label, tracks, selectedKey, onChange, disabledKey,
}: {
  label: string;
  tracks: MixableTrack[];
  selectedKey: string | null;
  onChange: (key: string | null) => void;
  disabledKey: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                  track.source === "local" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                )}>
                  {track.source === "local" ? "device" : "cloud"}
                </span>
                {track.duration != null && (
                  <span className="font-mono text-xs text-muted-foreground">{formatDuration(track.duration)}</span>
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

const FADE_OPTIONS = [0, 1, 2, 3, 5];

function FadePicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {FADE_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              "px-2 py-1 rounded text-[11px] font-mono transition-colors",
              value === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {s}s
          </button>
        ))}
      </div>
    </div>
  );
}

function PanLabel(v: number) {
  if (v < -0.05) return `L${Math.round(Math.abs(v) * 100)}`;
  if (v > 0.05) return `R${Math.round(v * 100)}`;
  return "C";
}

export default function Mixer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: cloudSongs = [] } = useListSongs();
  const createSong = useCreateSong();

  const [localSongs, setLocalSongs] = useState<LocalSong[]>([]);
  useEffect(() => { setLocalSongs(listLocalSongs()); }, []);

  const tracks: MixableTrack[] = (() => {
    const items: MixableTrack[] = [];
    for (const s of cloudSongs) {
      if (s.hasAudio && typeof s.audioUrl === "string") {
        items.push({ key: `cloud-${s.id}`, title: s.title, duration: s.duration ?? null, source: "cloud", cloudId: s.id, cloudAudioUrl: s.audioUrl });
      }
    }
    const cloudedLocalIds = new Set(localSongs.map((s) => s.cloudId).filter(Boolean));
    for (const s of localSongs) {
      if (s.cloudId && cloudedLocalIds.has(s.cloudId)) continue;
      items.push({ key: `local-${s.id}`, title: s.title, duration: s.duration || null, source: "local", localId: s.id });
    }
    return items;
  })();

  const [track1Key, setTrack1Key] = useState<string | null>(null);
  const [track2Key, setTrack2Key] = useState<string | null>(null);
  const [mixTitle, setMixTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const {
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
  } = useAudioMixer();

  const track1 = tracks.find((t) => t.key === track1Key) ?? null;
  const track2 = tracks.find((t) => t.key === track2Key) ?? null;
  const canLoad = !!track1 && !!track2 && state === "idle";
  const isLoaded = state === "ready" || state === "playing" || state === "recording" || state === "done";

  const resolveAudioUrl = useCallback(async (track: MixableTrack): Promise<string> => {
    if (track.source === "cloud" && track.cloudAudioUrl) return track.cloudAudioUrl;
    if (track.source === "local" && track.localId) {
      const url = await getLocalAudioUrl(track.localId);
      if (!url) throw new Error(`No audio found on device for "${track.title}".`);
      return url;
    }
    throw new Error(`No audio URL for "${track.title}"`);
  }, []);

  const handleLoad = async () => {
    if (!track1 || !track2) return;
    setIsLoadingTracks(true);
    try {
      const [url1, url2] = await Promise.all([resolveAudioUrl(track1), resolveAudioUrl(track2)]);
      await loadTracks(
        { id: track1.cloudId ?? 0, title: track1.title, audioUrl: url1 },
        { id: track2.cloudId ?? 0, title: track2.title, audioUrl: url2 },
      );
    } catch (err) {
      toast({ title: "Could not load track", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleReset = () => { reset(); setTrack1Key(null); setTrack2Key(null); setMixTitle(""); };

  const handleSaveMix = async () => {
    if (!recordedBlob || !mixTitle.trim()) return;
    setIsSaving(true);
    try {
      const song = await new Promise<{ id: number }>((resolve, reject) => {
        createSong.mutate(
          { data: { title: mixTitle.trim(), notes: `Mixed from: ${track1?.title ?? "Track A"} + ${track2?.title ?? "Track B"}`, tags: "mix" } },
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

  const trackControls = [
    {
      label: "Track A", title: track1?.title ?? "",
      volume: track1Volume, setVolume: setTrack1Volume,
      pan: track1Pan, setPan: setTrack1Pan,
      mute: track1Mute, setMute: setTrack1Mute,
      solo: track1Solo, setSolo: setTrack1Solo,
    },
    {
      label: "Track B", title: track2?.title ?? "",
      volume: track2Volume, setVolume: setTrack2Volume,
      pan: track2Pan, setPan: setTrack2Pan,
      mute: track2Mute, setMute: setTrack2Mute,
      solo: track2Solo, setSolo: setTrack2Solo,
    },
  ];

  const isActive = state === "playing" || state === "recording";

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
          {/* Track selection (idle only) */}
          {state === "idle" && (
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: "Track A", key: track1Key, setKey: setTrack1Key, disabledKey: track2Key, vol: track1Volume, setVol: setTrack1Volume },
                { label: "Track B", key: track2Key, setKey: setTrack2Key, disabledKey: track1Key, vol: track2Volume, setVol: setTrack2Volume },
              ].map(({ label, key, setKey, disabledKey, vol, setVol }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-5 space-y-5">
                  <TrackSelector label={label} tracks={tracks} selectedKey={key} onChange={setKey} disabledKey={disabledKey} />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Volume {label.split(" ")[1]}</Label>
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{Math.round(vol * 100)}%</span>
                    </div>
                    <Slider min={0} max={1} step={0.01} value={[vol]} onValueChange={([v]) => setVol(v)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live track controls (after loading) */}
          {isLoaded && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="grid grid-cols-2 gap-8">
                {trackControls.map(({ label, title, volume, setVolume, pan, setPan, mute, setMute, solo, setSolo }) => (
                  <div key={label} className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
                      <span className="font-medium text-sm truncate max-w-[140px]">{title}</span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setMute(!mute)}
                          title={mute ? "Unmute" : "Mute"}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors",
                            mute ? "bg-destructive/20 border-destructive text-destructive" : "border-border text-muted-foreground hover:border-destructive/50"
                          )}
                        >
                          <VolumeX className="w-3 h-3" /> M
                        </button>
                        <button
                          onClick={() => setSolo(!solo)}
                          title={solo ? "Unsolo" : "Solo this track"}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors",
                            solo ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" : "border-border text-muted-foreground hover:border-yellow-500/50"
                          )}
                        >
                          <Zap className="w-3 h-3" /> S
                        </button>
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Vol</span>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{Math.round(volume * 100)}%</span>
                      </div>
                      <Slider
                        min={0} max={1} step={0.01}
                        value={[volume]}
                        onValueChange={([v]) => setVolume(v)}
                        disabled={state === "recording"}
                      />
                    </div>

                    {/* Pan */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Pan</span>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{PanLabel(pan)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">L</span>
                        <Slider
                          min={-1} max={1} step={0.01}
                          value={[pan]}
                          onValueChange={([v]) => setPan(v)}
                          disabled={state === "recording"}
                          className="flex-1"
                        />
                        <span className="text-[10px] text-muted-foreground">R</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                    : state === "loading" ? "Loading tracks..."
                    : state === "ready" ? "Ready"
                    : state === "playing" ? "Previewing..."
                    : state === "recording" ? "Recording..."
                    : "Mix captured"}
                </span>
              </div>
              {isActive && (
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {formatDuration(elapsedTime)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ {formatDuration(Math.ceil(mixDuration))}</span>
                </span>
              )}
              {state === "ready" && mixDuration > 0 && (
                <span className="font-mono text-sm text-muted-foreground">{formatDuration(Math.ceil(mixDuration))}</span>
              )}
            </div>

            {/* Progress bar */}
            {isActive && mixDuration > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full mb-5 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", state === "recording" ? "bg-red-500" : "bg-primary")}
                  style={{ width: `${Math.min((elapsedTime / mixDuration) * 100, 100)}%` }}
                />
              </div>
            )}

            {/* Fade + loop controls */}
            {(state === "ready" || state === "idle") && (
              <div className="flex flex-wrap gap-4 mb-5 pb-5 border-b border-border">
                <FadePicker label="Fade in" value={fadeInDuration} onChange={setFadeInDuration} />
                <FadePicker label="Fade out" value={fadeOutDuration} onChange={setFadeOutDuration} />
                <button
                  onClick={() => setLoop(!loop)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition-colors",
                    loop ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <Repeat className="w-3.5 h-3.5" /> Loop
                </button>
              </div>
            )}

            {/* Action buttons */}
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
                  <Button onClick={startRecording} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <span className="w-3 h-3 rounded-full bg-white" /> Record Mix
                  </Button>
                  <Button variant="ghost" onClick={handleReset} className="ml-auto text-muted-foreground">Start Over</Button>
                </>
              )}
              {state === "playing" && (
                <Button variant="outline" onClick={stop} className="gap-2">
                  <Square className="w-4 h-4" /> Stop
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

          {/* Save mix */}
          {state === "done" && recordedBlob && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
              <h2 className="font-semibold text-lg">Save Your Mix</h2>
              <p className="text-sm text-muted-foreground">Give your mix a name — it'll be added to your library as a new track.</p>
              <div className="space-y-2">
                <Label htmlFor="mix-title">Mix Title</Label>
                <Input
                  id="mix-title"
                  placeholder="e.g. Verse Jam — May 21"
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
