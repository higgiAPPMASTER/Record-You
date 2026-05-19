import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateSong, getListSongsQueryKey, getGetSongStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Square, Pause, Play, Save, Loader2, RefreshCcw, Timer } from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useMetronome } from "@/hooks/use-metronome";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Record() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSong = useCreateSong();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    reset,
  } = useAudioRecorder();

  const { isRunning: metronomeOn, bpm, setBpm, beat, toggle: toggleMetronome, tapTempo } = useMetronome();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please give your track a name.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const song = await createSong.mutateAsync({
        data: { title: title.trim(), tags: tags.trim(), notes: notes.trim() },
      });

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("duration", recordingTime.toString());

      const uploadRes = await fetch(`/api/songs/${song.id}/audio`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Audio upload failed");

      queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });

      toast({ title: "Track saved", description: "Your recording has been saved to the library." });
      setLocation(`/song/${song.id}`);
    } catch {
      toast({ title: "Error saving track", description: "Something went wrong while saving.", variant: "destructive" });
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Studio</h1>
        <p className="text-muted-foreground text-lg">Capture your ideas directly to the cloud.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Visualizer & Controls */}
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
                  <div className="flex gap-4">
                    <Button variant="outline" size="lg" onClick={reset} className="rounded-full px-6">
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Discard
                    </Button>
                  </div>
                )}
              </div>

              {audioBlob && (
                <div className="mt-8 text-center text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-full">
                  Recording captured! Add details and save.
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

            {/* Beat visualizer */}
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
              <span>40</span>
              <span>BPM</span>
              <span>240</span>
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

        {/* Right Column: Metadata Form */}
        <Card
          className={`p-8 border-border bg-card transition-opacity duration-300 ${
            !audioBlob && !isRecording && !isSaving ? "opacity-50 pointer-events-none grayscale-[50%]" : "opacity-100"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Track Details</h2>
            <Button
              data-testid="button-save-track"
              onClick={handleSave}
              disabled={!audioBlob || isSaving || !title.trim()}
              className="gap-2 rounded-full px-6"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Saving..." : "Save Track"}
            </Button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-muted-foreground uppercase text-xs tracking-wider">
                Title *
              </Label>
              <Input
                id="title"
                placeholder="Late night acoustic idea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl font-medium py-6 bg-background/50"
                disabled={isSaving}
              />
            </div>

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
                disabled={isSaving}
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
                className="min-h-[200px] resize-none bg-background/50"
                disabled={isSaving}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
