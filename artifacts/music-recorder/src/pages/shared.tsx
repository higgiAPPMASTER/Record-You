import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useGetSong, getGetSongQueryKey } from "@workspace/api-client-react";
import { Play, Pause, Clock, Calendar, Loader2, Mic, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Shared() {
  const [, params] = useRoute("/shared/:id");
  const id = Number(params?.id);

  const { data: song, isLoading, error } = useGetSong(id, {
    query: { enabled: !!id, queryKey: getGetSongQueryKey(id) },
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current || !song?.audioUrl) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => setIsPlaying(false));
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">Track not found</h1>
        <p className="text-muted-foreground mb-6">This share link may have expired or been deleted.</p>
        <Button asChild>
          <Link href="/">Go to Library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <Mic className="w-3 h-3" />
          Shared recording
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{song.title}</h1>
      </div>

      <Card className="p-6 bg-card/80 border-border backdrop-blur-sm">
        <div className="flex items-center gap-6 text-sm text-muted-foreground font-mono mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {formatDuration(song.duration)}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {format(new Date(song.createdAt), "MMMM d, yyyy")}
          </div>
        </div>

        {song.hasAudio && song.audioUrl ? (
          <div className="bg-background/80 rounded-2xl p-6 border border-border shadow-inner space-y-4">
            <audio
              ref={audioRef}
              src={song.audioUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
              onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
            />
            <div className="flex items-center gap-6">
              <Button
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
                  onChange={(e) => {
                    const time = Number(e.target.value);
                    if (audioRef.current) audioRef.current.currentTime = time;
                    setCurrentTime(time);
                  }}
                  className="w-full accent-primary h-2 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary cursor-pointer"
                />
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(song.duration)}</span>
                </div>
              </div>
            </div>
            <a
              href={song.audioUrl}
              download={`${song.title.replace(/[^a-z0-9]/gi, "_")}.webm`}
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-2xl p-6 border border-border text-center text-muted-foreground text-sm">
            No audio available.
          </div>
        )}

        {song.tags && (
          <div className="flex flex-wrap gap-2 mt-6">
            {song.tags.split(",").map((tag) => (
              <Badge key={tag} variant="secondary" className="font-mono bg-background">
                {tag.trim()}
              </Badge>
            ))}
          </div>
        )}

        {song.notes && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Notes</h3>
            <div className="text-muted-foreground whitespace-pre-wrap">{song.notes}</div>
          </div>
        )}
      </Card>
    </div>
  );
}
