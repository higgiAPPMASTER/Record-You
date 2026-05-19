import { useState, useRef } from "react";
import { Link } from "wouter";
import { useListSongs, useDeleteSong, getListSongsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Pause, Mic, Clock, Calendar, MoreVertical, Trash, Edit3 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { data: songs, isLoading } = useListSongs();
  const deleteSong = useDeleteSong();
  const queryClient = useQueryClient();
  
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (songId: number, audioUrl: string | null | undefined) => {
    if (!audioUrl) return;
    
    if (playingId === songId) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setPlayingId(songId);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this track?")) {
      await deleteSong.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Library</h1>
          <p className="text-muted-foreground text-lg">Your recent ideas and recordings.</p>
        </div>
        <Button asChild size="lg" className="rounded-full px-8 gap-2 font-medium">
          <Link href="/record">
            <Mic className="w-5 h-5" />
            New Recording
          </Link>
        </Button>
      </div>

      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-card/50" />
          ))}
        </div>
      ) : songs && songs.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {songs.map((song) => (
            <Card key={song.id} className="group overflow-hidden border-border/50 bg-card hover:bg-accent/10 transition-all">
              <div className="flex items-center p-4 gap-4 h-full">
                <Button
                  variant="secondary"
                  size="icon"
                  className={`w-14 h-14 rounded-full flex-shrink-0 transition-colors ${playingId === song.id ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
                  disabled={!song.hasAudio}
                  onClick={() => togglePlay(song.id, song.audioUrl)}
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
                        <Button variant="ghost" size="icon" className="w-8 h-8 -mt-1 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        <DropdownMenuItem onClick={() => handleDelete(song.id)} className="text-destructive focus:text-destructive">
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
                  </div>
                  
                  {song.tags && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
                      {song.tags.split(',').map(tag => (
                        <Badge key={tag} variant="outline" className="bg-background/50 font-mono text-[10px]">
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
