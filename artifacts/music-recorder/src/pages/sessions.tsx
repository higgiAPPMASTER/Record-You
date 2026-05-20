import { useState } from "react";
import { useLocation } from "wouter";
import { useListSessions } from "@workspace/api-client-react";
import { Users, Play, Clock, Mic, Globe, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Sessions() {
  const [, setLocation] = useLocation();
  const { data: sessions = [], isLoading } = useListSessions();
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ id: number; audio: HTMLAudioElement } | null>(null);

  const filtered = sessions.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.seekingHelp ?? "").toLowerCase().includes(q)
    );
  });

  const handlePreview = (session: typeof sessions[0]) => {
    if (!session.audioUrl) return;
    if (preview?.id === session.id) {
      preview.audio.pause();
      setPreview(null);
      return;
    }
    if (preview) {
      preview.audio.pause();
    }
    const audio = new Audio(session.audioUrl);
    audio.play().catch(() => {});
    audio.onended = () => setPreview(null);
    setPreview({ id: session.id, audio });
  };

  const handleJoin = (shareToken: string) => {
    if (preview) { preview.audio.pause(); setPreview(null); }
    setLocation(`/collab/${shareToken}`);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Globe className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Open Sessions</h1>
        </div>
        <p className="text-muted-foreground max-w-lg">
          Musicians posting their ideas and looking for collaborators. Grab a session, record your part, and send it back.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by title or what they need..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-card/50 border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          {search ? (
            <>
              <Search className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">No sessions match "{search}"</p>
            </>
          ) : (
            <>
              <Globe className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="text-lg font-semibold text-muted-foreground/60">No open sessions yet</p>
              <p className="text-sm text-muted-foreground">
                Post one of your songs and invite the world to collab.
              </p>
              <Button onClick={() => setLocation("/")} variant="outline" className="mt-2">
                Go to Library
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((session) => {
            const isPlaying = preview?.id === session.id;
            const dur = formatDuration(session.duration);

            return (
              <Card
                key={session.id}
                className="p-5 border-border bg-card hover:border-primary/40 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  {/* Play preview */}
                  <Button
                    size="icon"
                    variant={isPlaying ? "default" : "secondary"}
                    className={cn(
                      "w-12 h-12 rounded-full flex-shrink-0 transition-all",
                      !session.hasAudio && "opacity-30 cursor-default"
                    )}
                    onClick={() => session.hasAudio && handlePreview(session)}
                    disabled={!session.hasAudio}
                    title={session.hasAudio ? "Preview" : "No audio"}
                  >
                    {isPlaying ? (
                      <span className="flex gap-0.5 items-end h-4">
                        <span className="w-1 bg-primary-foreground rounded animate-bounce" style={{ height: "60%", animationDelay: "0ms" }} />
                        <span className="w-1 bg-primary-foreground rounded animate-bounce" style={{ height: "100%", animationDelay: "150ms" }} />
                        <span className="w-1 bg-primary-foreground rounded animate-bounce" style={{ height: "40%", animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <Play className="w-5 h-5 translate-x-[2px]" />
                    )}
                  </Button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-base truncate">{session.title}</h3>
                      {session.seekingHelp && (
                        <Badge variant="secondary" className="bg-primary/15 text-primary border-0 text-xs font-medium shrink-0">
                          {session.seekingHelp}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                      {dur && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {dur}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {session.collabCount === 0
                          ? "Be the first to collab"
                          : `${session.collabCount} collab${session.collabCount !== 1 ? "s" : ""}`}
                      </span>
                      <span>{timeAgo(session.createdAt)}</span>
                    </div>
                  </div>

                  {/* Join button */}
                  <Button
                    size="sm"
                    className="gap-1.5 shrink-0 font-semibold"
                    onClick={() => handleJoin(session.shareToken)}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Collab
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer hint */}
      {filtered.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-8">
          {filtered.length} open session{filtered.length !== 1 ? "s" : ""} · Post yours from any song in your Library
        </p>
      )}
    </div>
  );
}
