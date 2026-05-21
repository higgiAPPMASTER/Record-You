import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useGetListenPost } from "@workspace/api-client-react";
import { Play, Pause, Clock, Music, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatDur(s: number | null | undefined) {
  if (!s) return null;
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function Listen() {
  const { token } = useParams<{ token: string }>();
  const { data: post, isLoading, isError } = useGetListenPost(token);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!post?.audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(post.audioUrl);
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current;
        if (a && a.duration) setProgress(a.currentTime / a.duration);
      };
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = ratio * a.duration;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 px-4 text-center">
        <AlertCircle className="w-14 h-14 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="text-muted-foreground max-w-sm">
          This listen link may have expired or been removed by the artist.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Album art placeholder */}
        <div className="w-48 h-48 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
          <Music className="w-16 h-16 text-primary/40" />
        </div>

        {/* Track info */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{post.title}</h1>
          {post.displayName && (
            <p className="text-muted-foreground text-sm">{post.displayName}</p>
          )}
          {post.note && (
            <p className="mt-3 text-sm text-muted-foreground/80 leading-relaxed max-w-sm mx-auto">
              "{post.note}"
            </p>
          )}
        </div>

        {/* Player */}
        {post.hasAudio ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <div
              className="h-1.5 bg-muted rounded-full cursor-pointer relative overflow-hidden"
              onClick={seek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{audioRef.current ? formatDur(audioRef.current.currentTime) ?? "0:00" : "0:00"}</span>
              {formatDur(post.duration) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDur(post.duration)}</span>}
            </div>

            <div className="flex justify-center">
              <Button
                size="icon"
                className="w-16 h-16 rounded-full text-xl"
                onClick={togglePlay}
              >
                {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 translate-x-0.5" />}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm">No audio available for this recording.</p>
        )}

        <p className="text-center text-xs text-muted-foreground/50 mt-10">
          Shared via <span className="text-primary/70 font-medium">Record You</span>
        </p>
      </div>
    </div>
  );
}
