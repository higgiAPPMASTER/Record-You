import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useCreateSong } from "@workspace/api-client-react";
import {
  Play, Pause, Trash, Clock, Calendar, Save, ArrowLeft, Loader2, Download, Gauge, Share2, Copy, Check, HardDrive,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getLocalSong, updateLocalSong, deleteLocalSong, getLocalAudioUrl, getLocalBlob, formatBytes, type LocalSong,
} from "@/lib/local-songs";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function SongDetail() {
  const [, params] = useRoute("/song/:id");
  const id = String(params?.id ?? "");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [song, setSong] = useState<LocalSong | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const createSong = useCreateSong();
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    const s = getLocalSong(id);
    setSong(s);
    setIsLoading(false);
    if (s) {
      setTitle(s.title);
      setTags(s.tags || "");
      setNotes(s.notes || "");
      if (s.cloudId != null) {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        setShareUrl(`${window.location.origin}${base}/shared/${s.cloudId}`);
      }
      getLocalAudioUrl(id).then(setAudioUrl);
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => setIsPlaying(false));
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = Number(e.target.value);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const handleDownload = async () => {
    if (!song) return;
    const blob = await getLocalBlob(song.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ext = song.mimeType.includes("m4a") || song.mimeType.includes("mp4") ? "m4a" : "webm";
    a.href = url;
    a.download = `${song.title.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSave = async () => {
    if (!song || !title.trim()) return;
    const updated = updateLocalSong(song.id, { title: title.trim(), tags: tags.trim(), notes: notes.trim() });
    if (updated) setSong(updated);
    setIsEditing(false);
    toast({ title: "Track updated" });
  };

  const handleDelete = async () => {
    if (!song) return;
    if (window.confirm("Are you sure you want to delete this track permanently?")) {
      await deleteLocalSong(song.id);
      toast({ title: "Track deleted" });
      setLocation("/");
    }
  };

  const handleShare = async () => {
    if (!song) return;
    setIsSharing(true);
    try {
      const blob = await getLocalBlob(song.id);
      if (!blob) throw new Error("No audio");

      let cloudId = song.cloudId;
      if (cloudId == null) {
        const created = await createSong.mutateAsync({
          data: { title: song.title, tags: song.tags, notes: song.notes },
        });
        cloudId = created.id;

        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        formData.append("duration", song.duration.toString());
        if (song.waveform && song.waveform.length > 0) {
          formData.append("waveform", JSON.stringify(song.waveform));
        }
        const res = await fetch(`/api/songs/${cloudId}/audio`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");

        const updated = updateLocalSong(song.id, { cloudId });
        if (updated) setSong(updated);
      }

      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const url = `${window.location.origin}${base}/shared/${cloudId}`;
      setShareUrl(url);

      if (navigator.share) {
        try {
          await navigator.share({ title: song.title, url });
        } catch {
          // user canceled — fallback to copy below
          await copyShareUrl(url);
        }
      } else {
        await copyShareUrl(url);
      }
    } catch {
      toast({ title: "Share failed", description: "Could not create a share link.", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const copyShareUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied", description: "Share link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!song) return <div className="p-8">Song not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => setLocation("/")}
        className="mb-6 -ml-4 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Library
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-card/80 border-border backdrop-blur-sm">
            <div className="flex justify-between items-start mb-6">
              {isEditing ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-3xl font-bold h-auto py-2 px-3 -ml-3 bg-background/50 border-primary/50"
                  autoFocus
                />
              ) : (
                <h1 className="text-3xl font-bold tracking-tight">{song.title}</h1>
              )}
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground font-mono mb-8 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatDuration(song.duration)}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {format(new Date(song.createdAt), "MMMM d, yyyy")}
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                {formatBytes(song.bytes)} · on this device
              </div>
            </div>

            {audioUrl ? (
              <div className="bg-background/80 rounded-2xl p-6 border border-border shadow-inner space-y-4">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
                  onTimeUpdate={handleTimeUpdate}
                />

                <div className="flex items-center gap-6">
                  <Button
                    data-testid="button-play-song"
                    size="icon"
                    className="w-16 h-16 rounded-full flex-shrink-0 shadow-lg shadow-primary/20"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 translate-x-[2px]" />}
                  </Button>

                  <div className="flex-1 space-y-2">
                    <input
                      type="range"
                      min={0}
                      max={song.duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full accent-primary h-2 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-xs font-mono text-muted-foreground">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(song.duration)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                  <Gauge className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-medium">Speed</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        data-testid={`button-speed-${speed}`}
                        onClick={() => handleSpeedChange(speed)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-mono font-semibold border transition-colors",
                          playbackSpeed === speed
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-2xl p-6 border border-border text-center text-muted-foreground text-sm">
                Loading audio...
              </div>
            )}
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Notes & Lyrics</h3>
            </div>
            {isEditing ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[300px] bg-background/50 border-primary/50 text-base leading-relaxed resize-none"
              />
            ) : (
              <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap min-h-[300px]">
                {song.notes || <span className="italic opacity-50">No notes added.</span>}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-card border-border">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Tags</h3>
            {isEditing ? (
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="acoustic, draft..."
                className="bg-background/50 border-primary/50 font-mono text-sm"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {song.tags ? (
                  song.tags.split(",").map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-mono bg-background">
                      {tag.trim()}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground italic">No tags</span>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 bg-card border-border flex flex-col gap-3">
            {isEditing ? (
              <>
                <Button onClick={handleSave} className="w-full gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="w-full">
                  Cancel
                </Button>
              </>
            ) : (
              <Button data-testid="button-edit" onClick={() => setIsEditing(true)} variant="outline" className="w-full">
                Edit Details
              </Button>
            )}

            <Button
              data-testid="button-share"
              className="w-full gap-2"
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {isSharing ? "Uploading..." : song.cloudId != null ? "Share Link" : "Upload & Share"}
            </Button>

            {shareUrl && (
              <div className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Share link
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="text-xs font-mono bg-background h-8"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyShareUrl(shareUrl)}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            <Button
              data-testid="button-download"
              variant="outline"
              className="w-full gap-2"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" />
              Download Audio
            </Button>

            <div className="h-px bg-border my-2" />
            <Button
              data-testid="button-delete"
              onClick={handleDelete}
              variant="destructive"
              className="w-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <Trash className="w-4 h-4 mr-2" /> Delete Track
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
