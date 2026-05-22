import { useState, useEffect, useCallback, useRef } from "react";
import { useListSongs } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Play, Square, Disc, Loader2, Check, Volume2,
  SlidersHorizontal, Repeat, VolumeX, Zap, Download, Music2, Wand2,
} from "lucide-react";
import { useAudioMixer, type TrackState } from "@/hooks/use-audio-mixer";
import { MixerWaveform } from "@/components/mixer-waveform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { listLocalSongs, getLocalAudioUrl, type LocalSong } from "@/lib/local-songs";
import { getListSongsQueryKey, getGetSongStatsQueryKey, useCreateSong } from "@workspace/api-client-react";

const TRACK_LABELS = ["A", "B", "C", "D"];
const TRACK_COLORS = [
  "hsl(var(--primary))",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

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
  label, availableTracks, selectedKey, onChange, disabledKeys,
}: {
  label: string;
  availableTracks: MixableTrack[];
  selectedKey: string | null;
  onChange: (key: string | null) => void;
  disabledKeys: Set<string>;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="space-y-1">
        {availableTracks.map((track) => {
          const isSelected = selectedKey === track.key;
          const isDisabled = disabledKeys.has(track.key);
          return (
            <button
              key={track.key}
              disabled={isDisabled}
              onClick={() => onChange(isSelected ? null : track.key)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md border text-sm transition-all flex items-center justify-between gap-2",
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
                {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
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
              value === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
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

function TrackControls({
  idx, track, label, color, audioUrl, isRecording,
  setVolume, setPan, setMuted, setSoloed, setOffset, setReverbWet, setEqBass, setEqTreble,
}: {
  idx: number; track: TrackState; label: string; color: string; audioUrl: string | null; isRecording: boolean;
  setVolume: (v: number) => void; setPan: (v: number) => void;
  setMuted: (v: boolean) => void; setSoloed: (v: boolean) => void;
  setOffset: (v: number) => void; setReverbWet: (v: number) => void;
  setEqBass: (v: number) => void; setEqTreble: (v: number) => void;
}) {
  const [showFx, setShowFx] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: color + "30", color }}>
          {label}
        </span>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setMuted(!track.muted)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors",
              track.muted ? "bg-destructive/20 border-destructive text-destructive" : "border-border text-muted-foreground hover:border-destructive/50"
            )}
          >
            <VolumeX className="w-3 h-3" /> M
          </button>
          <button
            onClick={() => setSoloed(!track.soloed)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors",
              track.soloed ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" : "border-border text-muted-foreground hover:border-yellow-500/50"
            )}
          >
            <Zap className="w-3 h-3" /> S
          </button>
          <button
            onClick={() => setShowFx(!showFx)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors",
              showFx ? "bg-purple-500/20 border-purple-500 text-purple-500" : "border-border text-muted-foreground hover:border-purple-500/50"
            )}
          >
            <Wand2 className="w-3 h-3" /> FX
          </button>
        </div>
      </div>

      {/* Waveform */}
      {audioUrl && <MixerWaveform src={audioUrl} color={color} height={36} />}

      {/* Volume */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Volume</span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">{Math.round(track.volume * 100)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={[track.volume]} onValueChange={([v]) => setVolume(v)} disabled={isRecording} />
      </div>

      {/* Pan */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Pan</span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">{PanLabel(track.pan)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">L</span>
          <Slider min={-1} max={1} step={0.01} value={[track.pan]} onValueChange={([v]) => setPan(v)} disabled={isRecording} className="flex-1" />
          <span className="text-[10px] text-muted-foreground">R</span>
        </div>
      </div>

      {/* FX panel */}
      {showFx && (
        <div className="border-t border-border pt-3 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Bass EQ</span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{track.eqBass > 0 ? "+" : ""}{track.eqBass.toFixed(0)} dB</span>
            </div>
            <Slider min={-12} max={12} step={1} value={[track.eqBass]} onValueChange={([v]) => setEqBass(v)} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Treble EQ</span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{track.eqTreble > 0 ? "+" : ""}{track.eqTreble.toFixed(0)} dB</span>
            </div>
            <Slider min={-12} max={12} step={1} value={[track.eqTreble]} onValueChange={([v]) => setEqTreble(v)} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reverb</span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{Math.round(track.reverbWet * 100)}%</span>
            </div>
            <Slider min={0} max={1} step={0.01} value={[track.reverbWet]} onValueChange={([v]) => setReverbWet(v)} />
          </div>
        </div>
      )}

      {/* Offset (tracks > 0 only) */}
      {idx > 0 && (
        <div className="border-t border-border pt-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Timing vs A</span>
            <span className={cn(
              "font-mono text-[11px] px-1.5 py-0.5 rounded border",
              track.offset === 0 ? "border-border text-muted-foreground" : "border-primary/50 bg-primary/10 text-primary"
            )}>
              {track.offset === 0 ? "in sync" : track.offset > 0 ? `+${track.offset.toFixed(2)}s` : `${track.offset.toFixed(2)}s`}
            </span>
            {track.offset !== 0 && (
              <button onClick={() => setOffset(0)} className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto">reset</button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0">earlier ←</span>
            <Slider min={-10} max={10} step={0.25} value={[track.offset]} onValueChange={([v]) => setOffset(v)} className="flex-1" />
            <span className="text-[10px] text-muted-foreground shrink-0">→ later</span>
          </div>
        </div>
      )}
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

  const availableTracks: MixableTrack[] = (() => {
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

  const [trackCount, setTrackCount] = useState(2);
  const [trackKeys, setTrackKeys] = useState<(string | null)[]>([null, null, null, null]);
  const [loadedAudioUrls, setLoadedAudioUrls] = useState<(string | null)[]>([]);
  const [mixTitle, setMixTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const {
    state, error, mixDuration, recordedBlob, elapsedTime,
    tracks: hookTracks, fadeInDuration, fadeOutDuration, loop,
    clickEnabled, bpm,
    setTrackVolume, setTrackPan, setTrackMuted, setTrackSoloed,
    setTrackOffset, setTrackReverbWet, setTrackEqBass, setTrackEqTreble,
    setFadeInDuration, setFadeOutDuration, setLoop, setClickEnabled, setBpm,
    loadTracks, play, stop, startRecording, stopRecording, reset,
  } = useAudioMixer();

  const isLoaded = !["idle", "loading"].includes(state);
  const isActive = ["playing", "recording"].includes(state);

  const setTrackKey = (i: number, key: string | null) => {
    setTrackKeys(prev => prev.map((k, idx) => idx === i ? key : k));
  };

  const disabledKeysFor = (i: number): Set<string> => {
    const others = trackKeys.filter((_, idx) => idx !== i && idx < trackCount);
    return new Set(others.filter(Boolean) as string[]);
  };

  const getTrackAudioUrl = useCallback(async (track: MixableTrack): Promise<string> => {
    if (track.source === "cloud") return track.cloudAudioUrl!;
    const url = await getLocalAudioUrl(track.localId!);
    if (!url) throw new Error(`Could not load audio for "${track.title}"`);
    return url;
  }, []);

  const canLoad = trackKeys.slice(0, trackCount).every(k => k !== null);

  const handleLoad = useCallback(async () => {
    const selectedKeys = trackKeys.slice(0, trackCount);
    const selected = selectedKeys.map(k => availableTracks.find(t => t.key === k) ?? null);
    if (selected.some(t => !t)) return;
    setIsLoadingTracks(true);
    try {
      const urls = await Promise.all(selected.map(t => getTrackAudioUrl(t!)));
      const infos = selected.map((t, i) => ({ id: t!.cloudId ?? i, title: t!.title, audioUrl: urls[i] }));
      setLoadedAudioUrls(urls);
      await loadTracks(infos);
    } catch { /* hook captures error */ } finally {
      setIsLoadingTracks(false);
    }
  }, [trackKeys, trackCount, availableTracks, getTrackAudioUrl, loadTracks]);

  const handleReset = () => { reset(); setLoadedAudioUrls([]); };

  const handleSaveMix = async () => {
    if (!recordedBlob || !mixTitle.trim()) return;
    setIsSaving(true);
    try {
      const file = new File([recordedBlob], `${mixTitle.trim()}.wav`, { type: "audio/wav" });
      const form = new FormData();
      form.append("title", mixTitle.trim());
      form.append("audio", file);
      await createSong.mutateAsync(form as any);
      await queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
      toast({ title: "Mix saved!", description: `"${mixTitle.trim()}" added to your library.` });
      reset(); setMixTitle(""); setLoadedAudioUrls([]);
    } catch {
      toast({ title: "Save failed", description: "Could not upload the mix. Try downloading it instead.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const trackGridClass = hookTracks.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="p-6 max-w-5xl mx-auto pb-32">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Mixer</h1>
        </div>
        <p className="text-muted-foreground">Layer up to 4 tracks, shape the sound with EQ and reverb, then record the mix.</p>
      </div>

      {availableTracks.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Disc className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">You need at least 2 recorded tracks to mix.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Head to the Studio to record some tracks first.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Track count + selection (idle only) */}
          {state === "idle" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-muted-foreground">Tracks to mix:</span>
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setTrackCount(n)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
                      trackCount === n ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className={cn("grid gap-4", trackGridClass)}>
                {Array.from({ length: trackCount }, (_, i) => {
                  const t = availableTracks.find(t => t.key === trackKeys[i]) ?? null;
                  return (
                    <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: TRACK_COLORS[i] + "30", color: TRACK_COLORS[i] }}>
                          Track {TRACK_LABELS[i]}
                        </span>
                        {t && <span className="text-sm text-muted-foreground truncate">{t.title}</span>}
                      </div>
                      <TrackSelector
                        label={`Select track ${TRACK_LABELS[i]}`}
                        availableTracks={availableTracks}
                        selectedKey={trackKeys[i]}
                        onChange={(k) => setTrackKey(i, k)}
                        disabledKeys={disabledKeysFor(i)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live track controls */}
          {isLoaded && hookTracks.length > 0 && (
            <div className={cn("grid gap-4", trackGridClass)}>
              {hookTracks.map((track, i) => (
                <TrackControls
                  key={i}
                  idx={i}
                  track={track}
                  label={`Track ${TRACK_LABELS[i]}`}
                  color={TRACK_COLORS[i]}
                  audioUrl={loadedAudioUrls[i] ?? null}
                  isRecording={state === "recording"}
                  setVolume={v => setTrackVolume(i, v)}
                  setPan={v => setTrackPan(i, v)}
                  setMuted={v => setTrackMuted(i, v)}
                  setSoloed={v => setTrackSoloed(i, v)}
                  setOffset={v => setTrackOffset(i, v)}
                  setReverbWet={v => setTrackReverbWet(i, v)}
                  setEqBass={v => setTrackEqBass(i, v)}
                  setEqTreble={v => setTrackEqTreble(i, v)}
                />
              ))}
            </div>
          )}

          {/* Transport */}
          <div className="rounded-xl border border-border bg-card p-5">
            {/* Status + timer */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {state === "recording" && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
                {state === "playing" && <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
                <span className="text-sm font-medium text-muted-foreground">
                  {state === "idle" ? "Select tracks above"
                    : state === "loading" ? "Loading tracks..."
                    : state === "ready" ? "Ready"
                    : state === "playing" ? "Previewing..."
                    : state === "recording" ? "Recording mix..."
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
              <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", state === "recording" ? "bg-red-500" : "bg-primary")}
                  style={{ width: `${Math.min((elapsedTime / mixDuration) * 100, 100)}%` }}
                />
              </div>
            )}

            {/* Fade + loop + click controls */}
            {(state === "ready" || state === "idle") && (
              <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-border">
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
                {/* Click track */}
                <button
                  onClick={() => setClickEnabled(!clickEnabled)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition-colors",
                    clickEnabled ? "bg-orange-500/15 border-orange-500 text-orange-500" : "border-border text-muted-foreground hover:border-orange-500/50"
                  )}
                >
                  <Music2 className="w-3.5 h-3.5" /> Click
                </button>
                {clickEnabled && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">BPM</span>
                    <input
                      type="number"
                      min={20} max={300} value={bpm}
                      onChange={e => setBpm(Math.max(20, Math.min(300, parseInt(e.target.value) || 120)))}
                      className="w-16 h-7 px-2 rounded-md border border-border bg-background text-xs font-mono text-center"
                    />
                  </div>
                )}
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
              <p className="text-sm text-muted-foreground">Give your mix a name to add it to your library, or download it.</p>
              <div className="space-y-2">
                <Label htmlFor="mix-title">Mix Title</Label>
                <Input
                  id="mix-title"
                  placeholder="e.g. Verse Jam — May 21"
                  value={mixTitle}
                  onChange={e => setMixTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSaveMix()}
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button onClick={handleSaveMix} disabled={!mixTitle.trim() || isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save to Library
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const url = URL.createObjectURL(recordedBlob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `${mixTitle.trim() || "mix"}.wav`; a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  }}
                >
                  <Download className="w-4 h-4" /> Download WAV
                </Button>
                <Button variant="ghost" onClick={() => reset()} disabled={isSaving} className="ml-auto text-muted-foreground">Record Again</Button>
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
