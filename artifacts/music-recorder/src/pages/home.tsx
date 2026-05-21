import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Play, Pause, Mic, Clock, Calendar, MoreVertical, Trash, Edit3, Search, Download, X, Tag } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  listLocalSongs,
  deleteLocalSong,
  getLocalAudioUrl,
  getLocalBlob,
  type LocalSong,
} from "@/lib/local-songs";

function WaveformBars({ peaks, isPlaying }: { peaks: number[]; isPlaying: boolean }) {
  const W = 120;
  const H = 28;
  const bars = peaks.length;
  const barW = W / bars - 0.5;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0 opacity-70">
      {peaks.map((v, i) => {
        const bh = Math.max(2, v * (H - 2));
        const y = (H - bh) / 2;
        const x = i * (W / bars);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={barW / 2}
            className={isPlaying ? "fill-primary" : "fill-muted-foreground/50"}
          />
        );
      })}
    </svg>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [songs, setSongs] = useState<LocalSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const reload = useCallback(() => {
    setSongs(listLocalSongs());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  useEffect(() => {
    return () => {
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    };
  }, []);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    songs.forEach((s) => s.tags?.split(",").forEach((t) => tagSet.add(t.trim())));
    return Array.from(tagSet).filter(Boolean);
  }, [songs]);

  const filtered = useMemo(() => {
    return songs.filter((s) => {
      const matchesSearch = !search || s.title.toLowerCase().includes(search.toLowerCase());
      const matchesTag = !activeTag || s.tags?.split(",").map((t) => t.trim()).includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [songs, search, activeTag]);

  const togglePlay = async (songId: string) => {
    if (playingId === songId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const url = await getLocalAudioUrl(songId);
    if (!url) {
      toast({ title: "Audio missing", description: "Could not load this recording.", variant: "destructive" });
      return;
    }
    if (audioRef.current) {
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = url;
      audioRef.current.src = url;
      audioRef.current.play().then(() => setPlayingId(songId)).catch(() => {
        setPlayingId(null);
        toast({ title: "Playback failed", variant: "destructive" });
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this track?")) {
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      await deleteLocalSong(id);
      reload();
    }
  };

  const handleDownload = async (id: string, title: string, mimeType: string) => {
    const blob = await getLocalBlob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.${mimeType.includes("m4a") || mimeType.includes("mp4") ? "m4a" : "webm"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Library</h1>
          <p className="text-muted-foreground text-lg">Your recordings — saved on this device.</p>
        </div>
        <Button asChild size="lg" className="rounded-full px-8 gap-2 font-medium">
          <Link href="/record">
            <Mic className="w-5 h-5" />
            New Recording
          </Link>
        </Button>
      </div>

      {songs.length > 0 && (
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search tracks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              {allTags.map((tag) => (
                <button
                  key={tag}
                  data-testid={`tag-filter-${tag}`}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono border transition-colors ${
                    activeTag === tag
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-32 animate-pulse bg-card/50" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((song) => (
            <Card
              key={song.id}
              data-testid={`card-song-${song.id}`}
              className="group overflow-hidden border-border/50 bg-card hover:bg-accent/10 transition-all"
            >
              <div className="flex items-center p-4 gap-4 h-full">
                <Button
                  data-testid={`button-play-${song.id}`}
                  variant="secondary"
                  size="icon"
                  className={`w-14 h-14 rounded-full flex-shrink-0 transition-colors ${
                    playingId === song.id ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                  }`}
                  onClick={() => togglePlay(song.id)}
                >
                  {playingId === song.id ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 translate-x-[1px]" />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <Link href={`/song/${song.id}`} className="block">
                      <h3 className="font-semibold text-lg truncate hover:text-primary transition-colors">
                        {song.title}
                      </h3>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 -mt-1 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/song/${song.id}`} className="cursor-pointer">
                            <Edit3 className="w-4 h-4 mr-2" />
                            Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          data-testid={`button-download-${song.id}`}
                          onClick={() => handleDownload(song.id, song.title, song.mimeType)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(song.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(song.duration)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(song.createdAt), "MMM d, yyyy")}
                    </div>
                    {song.waveform && song.waveform.length > 0 && (
                      <div className="ml-auto">
                        <WaveformBars peaks={song.waveform} isPlaying={playingId === song.id} />
                      </div>
                    )}
                  </div>

                  {song.tags && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
                      {song.tags.split(",").map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={`bg-background/50 font-mono text-[10px] cursor-pointer transition-colors ${
                            activeTag === tag.trim() ? "border-primary text-primary" : ""
                          }`}
                          onClick={() => setActiveTag(activeTag === tag.trim() ? null : tag.trim())}
                        >
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : songs.length > 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tracks match your search.</p>
          <button onClick={() => { setSearch(""); setActiveTag(null); }} className="text-primary text-sm mt-2 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="text-center py-32 border-2 border-dashed border-border rounded-2xl bg-card/30">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mic className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No tracks yet</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Your studio is quiet. Start recording to capture your first idea.
          </p>
          <Button asChild size="lg" className="rounded-full">
            <Link href="/record">Record Track</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
