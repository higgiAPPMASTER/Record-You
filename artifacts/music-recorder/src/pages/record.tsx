import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateSong, useUpdateSong, getListSongsQueryKey, getGetSongStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Square, Pause, Play, Loader2, RefreshCcw, Timer, CheckCircle2 } from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { extractWaveformPeaks } from "@/lib/waveform";
import { useMetronome } from "@/hooks/use-metronome";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function generateTempTitle() {
  return `Recording — ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`;
}

export default function Record() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSong = useCreateSong();
  const updateSong = useUpdateSong();

  // Pre-recording metadata (filled on the right while recording)
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  // Auto-save state
  const [isSaving, setIsSaving] = useState(false);
  const [savedSongId, setSavedSongId] = useState<number | null>(null);
  const saveTriggeredRef = useRef(false);

  // Rename dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    analyserNode,
    error: recorderError,
    reset,
  } = useAudioRecorder();

  // Show mic error
  useEffect(() => {
    if (!recorderError) return;
    const isPermission = recorderError.name === "NotAllowedError" || recorderError.name === "PermissionDeniedError";
    toast({
      title: isPermission ? "Microphone blocked" : "Recording failed",
      description: isPermission ? "Allow microphone access in your browser and try again." : recorderError.message,
      variant: "destructive",
    });
  }, [recorderError]);

  // Auto-save as soon as a blob is available
  useEffect(() => {
    if (!audioBlob || saveTriggeredRef.current) return;
    saveTriggeredRef.current = true;
    autoSave(audioBlob);
  }, [audioBlob]);

  const autoSave = async (blob: Blob) => {
    setIsSaving(true);
    const tempTitle = generateTempTitle();
    const capturedTags = tags.trim();
    const capturedNotes = notes.trim();

    try {
      const song = await createSong.mutateAsync({
        data: { title: tempTitle, tags: capturedTags, notes: capturedNotes },
      });

      const peaks = await extractWaveformPeaks(blob);
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("duration", recordingTime.toString());
      if (peaks.length > 0) formData.append("waveform", JSON.stringify(peaks));

      const uploadRes = await fetch(`/api/songs/${song.id}/audio`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Audio upload failed");

      await queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });

      setSavedSongId(song.id);
      setDialogTitle(tempTitle);
      setDialogOpen(true);
    } catch {
      toast({ title: "Auto-save failed", description: "Something went wrong while saving. Try again.", variant: "destructive" });
      saveTriggeredRef.current = false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRename = async () => {
    if (!savedSongId || !dialogTitle.trim()) return;
    setIsRenaming(true);
    try {
      await updateSong.mutateAsync({
        id: savedSongId,
        data: { title: dialogTitle.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      setDialogOpen(false);
      setLocation(`/song/${savedSongId}`);
    } catch {
      toast({ title: "Rename failed", description: "Your recording is saved — you can rename it on the song page.", variant: "destructive" });
      setDialogOpen(false);
      setLocation(`/song/${savedSongId}`);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDialogSkip = () => {
    setDialogOpen(false);
    if (savedSongId) setLocation(`/song/${savedSongId}`);
  };

  const handleDiscard = () => {
    reset();
    saveTriggeredRef.current = false;
    setSavedSongId(null);
    setDialogTitle("");
  };

  const { isRunning: metronomeOn, bpm, setBpm, beat, toggle: toggleMetronome, tapTempo } = useMetronome();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Naming dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleDialogSkip(); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <DialogTitle className="text-lg">Recording saved!</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Give it a name — or keep the auto-generated one.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dialog-title" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Track Name
              </Label>
              <Input
                id="dialog-title"
                data-testid="input-track-title"
                value={dialogTitle}
                onChange={(e) => setDialogTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                className="text-base"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={handleDialogSkip} disabled={isRenaming}>
              Skip
            </Button>
            <Button
              data-testid="button-save-track"
              onClick={handleRename}
              disabled={!dialogTitle.trim() || isRenaming}
              className="gap-2"
            >
              {isRenaming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isRenaming ? "Saving…" : "Save Name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-8 max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Studio</h1>
          <p className="text-muted-foreground text-lg">Capture your ideas directly to the cloud.</p>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Visualizer & Controls */}
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col p-8 border-border bg-card shadow-lg relative overflow-hidden flex-1">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none opacity-50" />

              <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                <div className="text-6xl font-mono font-light mb-12 tracking-wider text-primary">
                  {formatTime(recordingTime)}
                </div>

                <div className="w-full bg-background/50 rounded-xl p-6 mb-12 border border-border">
                  <AudioVisualizer analyserNode={analyserNode} isRecording={isRecording && !isPaused} />
                </div>

                <div className="flex items-center gap-6">
                  {isRecording ? (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-16 h-16 rounded-full"
                        onClick={isPaused ? resumeRecording : pauseRecording}
                      >
                        {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="w-20 h-20 rounded-full hover:bg-destructive/90 transition-transform active:scale-95"
                        onClick={stopRecording}
                      >
                        <Square className="w-8 h-8 fill-current" />
                      </Button>
                    </>
                  ) : isSaving ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </div>
                      <span className="text-sm text-muted-foreground animate-pulse">Saving…</span>
                    </div>
                  ) : !audioBlob ? (
                    <Button
                      data-testid="button-record"
                      size="icon"
                      className="w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-transform active:scale-95 group"
                      onClick={startRecording}
                    >
                      <Mic className="w-10 h-10 group-hover:scale-110 transition-transform" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="lg" onClick={handleDiscard} className="rounded-full px-6">
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Discard & Re-record
                    </Button>
                  )}
                </div>

                {isSaving && (
                  <div className="mt-8 text-center text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-full">
                    Auto-saving your recording…
                  </div>
                )}
              </div>
            </Card>

            {/* Metronome */}
            <Card className="p-5 border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Metronome</span>
                </div>
                <Button
                  data-testid="button-metronome-toggle"
                  size="sm"
                  variant={metronomeOn ? "default" : "outline"}
                  onClick={toggleMetronome}
                  className={cn("rounded-full px-4", metronomeOn && "bg-primary")}
                >
                  {metronomeOn ? "On" : "Off"}
                </Button>
              </div>

              <div className="flex gap-2 justify-center mb-4">
                {[0, 1, 2, 3].map((b) => (
                  <div
                    key={b}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all duration-75",
                      metronomeOn && beat === b
                        ? b === 0
                          ? "bg-primary border-primary scale-110"
                          : "bg-primary/70 border-primary/70 scale-105"
                        : "border-border bg-muted/30"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <input
                  data-testid="input-bpm"
                  type="range"
                  min={40}
                  max={240}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="flex-1 accent-primary h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
                <span className="font-mono text-lg font-bold w-16 text-right tabular-nums">{bpm}</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
                <span>40</span><span>BPM</span><span>240</span>
              </div>

              <Button
                data-testid="button-tap-tempo"
                variant="outline"
                size="sm"
                onClick={tapTempo}
                className="w-full mt-3 font-mono"
              >
                Tap Tempo
              </Button>
            </Card>
          </div>

          {/* Right: Notes & Tags */}
          <Card
            className={`p-8 border-border bg-card transition-opacity duration-300 ${
              !isRecording && !audioBlob && !isSaving ? "opacity-50 pointer-events-none grayscale-[50%]" : "opacity-100"
            }`}
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Track Details</h2>
              <p className="text-sm text-muted-foreground mt-1">Fill these in while you record — they'll be saved automatically when you stop.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tags" className="text-muted-foreground uppercase text-xs tracking-wider">
                  Tags (comma separated)
                </Label>
                <Input
                  id="tags"
                  placeholder="acoustic, draft, verse"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="font-mono text-sm bg-background/50"
                  disabled={isSaving || !!savedSongId}
                />
              </div>

              <div className="space-y-2 flex-1">
                <Label htmlFor="notes" className="text-muted-foreground uppercase text-xs tracking-wider">
                  Notes & Lyrics
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Capo on 3rd fret. Chorus needs work..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[260px] resize-none bg-background/50"
                  disabled={isSaving || !!savedSongId}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
