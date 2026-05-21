import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useGetListenPost } from "@workspace/api-client-react";
import { Play, Pause, Clock, Music, AlertCircle, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatDur(s: number | null | undefined) {
  if (!s && s !== 0) return null;
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function WaveformBars({ playing }: { playing: boolean }) {
  const bars = 28;
  return (
    <div className="flex items-end justify-center gap-[3px] h-12 mb-6">
      {Array.from({ length: bars }).map((_, i) => {
        const baseH = 20 + Math.sin(i * 0.7) * 14 + Math.cos(i * 1.3) * 8;
        const delay = (i * 0.07).toFixed(2);
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-colors duration-300",
              playing ? "bg-primary" : "bg-muted"
            )}
            style={{
              height: playing ? undefined : `${Math.max(4, baseH * 0.4)}px`,
              animation: playing
                ? `waveBar 0.9s ease-in-out ${delay}s infinite alternate`
                : undefined,
              ["--bar-h" as string]: `${Math.max(8, baseH)}px`,
              ["--bar-min" as string]: `${Math.max(4, baseH * 0.25)}px`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Listen() {
  const { token } = useParams<{ token: string }>();
  const { data: post, isLoading, isError } = useGetListenPost(token);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudio = () => {
    if (!audioRef.current && post?.audioUrl) {
      audioRef.current = new Audio(post.audioUrl);
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current;
        if (a && a.duration) {
          setProgress(a.currentTime / a.duration);
          setCurrentTime(a.currentTime);
        }
      };
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
    }
    return audioRef.current;
  };

  const togglePlay = () => {
    if (!post?.audioUrl) return;
    const a = getAudio();
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  const handleSpeed = (s: number) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
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
      <style>{`
        @keyframes waveBar {
          from { height: var(--bar-min); }
          to   { height: var(--bar-h); }
        }
      `}</style>

      <div className="w-full max-w-md">
        {/* Album art */}
        <div className="w-44 h-44 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
          <Music className="w-14 h-14 text-primary/40" />
        </div>

        {/* Track info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{post.title}</h1>
          {post.displayName && (
            <p className="text-muted-foreground text-sm font-medium">{post.displayName}</p>
          )}
          {post.note && (
            <p className="mt-3 text-sm text-muted-foreground/80 leading-relaxed max-w-sm mx-auto italic">
              "{post.note}"
            </p>
          )}
        </div>

        {/* Animated waveform */}
        <WaveformBars playing={playing} />

        {/* Player */}
        {post.hasAudio ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <div
              className="h-1.5 bg-muted rounded-full cursor-pointer relative overflow-hidden group"
              onClick={seek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{formatDur(currentTime) ?? "0:00"}</span>
              {formatDur(post.duration) && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />{formatDur(post.duration)}
                </span>
              )}
            </div>

            {/* Play button */}
            <div className="flex justify-center">
              <Button
                size="icon"
                className="w-16 h-16 rounded-full"
                onClick={togglePlay}
              >
                {playing
                  ? <Pause className="w-7 h-7" />
                  : <Play className="w-7 h-7 translate-x-0.5" />}
              </Button>
            </div>

            {/* Speed control */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeed(s)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-mono font-semibold border transition-colors",
                      speed === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm">No audio available for this recording.</p>
        )}

        <div className="mt-10 text-center">
          <a
            href="/"
            className="text-xs text-muted-foreground/40 hover:text-primary/60 transition-colors"
          >
            Shared via <span className="font-semibold">Record You</span> — your personal music studio
          </a>
        </div>
      </div>
    </div>
  );
}
