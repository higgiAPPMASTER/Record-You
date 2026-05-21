import { useState, useRef } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCommunityPosts,
  useListMyCommunityPosts,
  useCreateCommunityPost,
  useDeleteCommunityPost,
  useListSongs,
  getListCommunityPostsQueryKey,
  getListMyCommunityPostsQueryKey,
} from "@workspace/api-client-react";
import {
  Globe, Users, Play, Pause, Clock, Trash2, Link2, PlusCircle, X,
  ChevronDown, Check, Music, Lock, Search, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDur(s: number | null | undefined) {
  if (!s) return null;
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

type Post = {
  id: number; songId: number; userId: string; displayName: string | null;
  note: string | null; visibility: string; listenToken: string | null;
  title: string; hasAudio: boolean; duration: number | null;
  audioUrl: string | null; createdAt: string;
};

function PostCard({
  post, isOwn, onDelete,
}: { post: Post; isOwn?: boolean; onDelete?: (id: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const togglePlay = () => {
    if (!post.audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(post.audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setPlaying(true); }
  };

  const copyLink = () => {
    if (!post.listenToken) return;
    const url = `${window.location.origin}/listen/${post.listenToken}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied!", description: "Share it with anyone you'd like." })
    );
  };

  return (
    <Card className="p-5 border-border bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-4">
        <Button
          size="icon"
          variant={playing ? "default" : "secondary"}
          className={cn("w-12 h-12 rounded-full flex-shrink-0", !post.hasAudio && "opacity-30 cursor-default")}
          onClick={togglePlay}
          disabled={!post.hasAudio}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-5 h-5 translate-x-[2px]" />}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-base truncate">{post.title}</h3>
            <Badge
              variant="secondary"
              className={cn("shrink-0 text-xs border-0",
                post.visibility === "public"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {post.visibility === "public" ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
              {post.visibility === "public" ? "Public" : "Friends"}
            </Badge>
          </div>

          {post.note && (
            <p className="text-sm text-muted-foreground mb-1.5 line-clamp-2">{post.note}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
            {post.displayName && (
              <span className="flex items-center gap-1 text-foreground/70 font-sans font-medium">
                {post.displayName}
              </span>
            )}
            {formatDur(post.duration) && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDur(post.duration)}
              </span>
            )}
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {post.visibility === "friends" && post.listenToken && (
            <Button size="icon" variant="ghost" className="w-9 h-9" onClick={copyLink} title="Copy link">
              <Link2 className="w-4 h-4" />
            </Button>
          )}
          {isOwn && onDelete && (
            <Button
              size="icon" variant="ghost"
              className="w-9 h-9 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(post.id)}
              title="Remove post"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ShareModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  const { data: songs = [] } = useListSongs();
  const create = useCreateCommunityPost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<"form" | "success">("form");
  const [songId, setSongId] = useState<number | "">("");
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [displayName, setDisplayName] = useState(
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? ""
  );
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [createdPost, setCreatedPost] = useState<Post | null>(null);

  const filtered = songs.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!songId) return;
    try {
      const result = await create.mutateAsync({
        data: { songId: Number(songId), displayName: displayName || undefined, note: note || undefined, visibility },
      });
      queryClient.invalidateQueries({ queryKey: getListCommunityPostsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMyCommunityPostsQueryKey() });
      setCreatedPost(result as Post);
      setStep("success");
    } catch {
      toast({ title: "Failed to share", description: "Please try again.", variant: "destructive" });
    }
  };

  const copyLink = () => {
    if (!createdPost?.listenToken) return;
    const url = `${window.location.origin}/listen/${createdPost.listenToken}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied!" })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Share a Recording</h2>
          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {step === "success" ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">
              {createdPost?.visibility === "public" ? "Posted to community!" : "Friends link ready!"}
            </h3>
            {createdPost?.visibility === "friends" && createdPost.listenToken ? (
              <>
                <p className="text-sm text-muted-foreground">Anyone with this link can listen:</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 truncate text-muted-foreground">
                    {`${window.location.origin}/listen/${createdPost.listenToken}`}
                  </code>
                  <Button size="sm" onClick={copyLink} className="shrink-0">
                    <Link2 className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your recording is now visible in the Community feed.
              </p>
            )}
            <Button variant="outline" onClick={onClose} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Song picker */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Pick a recording
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search your library…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                />
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-border bg-background p-1">
                {filtered.length === 0 ? (
                  <p className="text-center py-4 text-sm text-muted-foreground">No recordings found</p>
                ) : filtered.map((s) => (
                  <button
                    key={s.id}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                      songId === s.id
                        ? "bg-primary/15 text-primary"
                        : "hover:bg-muted text-foreground"
                    )}
                    onClick={() => setSongId(s.id)}
                  >
                    <Music className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                    <span className="truncate">{s.title}</span>
                    {!s.hasAudio && <span className="text-xs text-muted-foreground ml-auto">(no audio)</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Who can see it
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["public", "friends"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                      visibility === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {v === "public" ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    <div className="text-left">
                      <div>{v === "public" ? "Public" : "Friends only"}</div>
                      <div className="text-[11px] opacity-70 font-normal">
                        {v === "public" ? "Visible in feed" : "Private link"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Your name (optional)
              </label>
              <input
                type="text"
                placeholder="How you want to appear"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Note (optional)
              </label>
              <textarea
                placeholder="Tell people about this recording — genre, vibe, story behind it…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground resize-none"
              />
            </div>

            <Button
              className="w-full"
              disabled={!songId || create.isPending}
              onClick={handleSubmit}
            >
              {create.isPending ? "Sharing…" : visibility === "public" ? "Post to Community" : "Get Friends Link"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Community() {
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(true);

  const { data: publicPosts = [], isLoading: loadingPublic } = useListCommunityPosts();
  const { data: myPosts = [], isLoading: loadingMine } = useListMyCommunityPosts();
  const deletePost = useDeleteCommunityPost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      await deletePost.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListCommunityPostsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMyCommunityPostsQueryKey() });
      toast({ title: "Post removed" });
    } catch {
      toast({ title: "Failed to remove post", variant: "destructive" });
    }
  };

  const filteredPublic = (publicPosts as Post[]).filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.displayName ?? "").toLowerCase().includes(q) ||
      (p.note ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {showModal && <ShareModal onClose={() => setShowModal(false)} />}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Community</h1>
        </div>
        <p className="text-muted-foreground max-w-lg">
          Share your recordings publicly for everyone to hear, or send a private link to friends.
        </p>
      </div>

      {/* Info box */}
      {showInfo && (
        <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-sm">
                <p className="font-semibold text-foreground">How sharing works</p>
                <ul className="text-muted-foreground space-y-1">
                  <li><span className="text-primary font-medium">Public</span> — your recording appears in this community feed for any logged-in user to browse and play.</li>
                  <li><span className="text-foreground/80 font-medium">Friends only</span> — you get a private link. Anyone with the link can listen — no account needed.</li>
                  <li>You can remove your posts at any time from <strong>My Shares</strong>.</li>
                </ul>
              </div>
            </div>
            <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs + Share button */}
      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
          {(["browse", "mine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "browse" ? (
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Browse</span>
              ) : (
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> My Shares</span>
              )}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2 shrink-0">
          <PlusCircle className="w-4 h-4" />
          Share a Recording
        </Button>
      </div>

      {/* Browse tab */}
      {tab === "browse" && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, name, or note…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
          </div>

          {loadingPublic ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-card/50 border border-border animate-pulse" />)}
            </div>
          ) : filteredPublic.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Globe className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="text-lg font-semibold text-muted-foreground/60">
                {search ? `No posts match "${search}"` : "Nothing here yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? "" : "Be the first to share a recording with the community."}
              </p>
              {!search && (
                <Button variant="outline" onClick={() => setShowModal(true)} className="mt-2">
                  Share your first recording
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPublic.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
          {filteredPublic.length > 0 && (
            <p className="text-center text-xs text-muted-foreground mt-8">
              {filteredPublic.length} public recording{filteredPublic.length !== 1 ? "s" : ""} shared
            </p>
          )}
        </>
      )}

      {/* My Shares tab */}
      {tab === "mine" && (
        <>
          {loadingMine ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-card/50 border border-border animate-pulse" />)}
            </div>
          ) : (myPosts as Post[]).length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Music className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="text-lg font-semibold text-muted-foreground/60">No shares yet</p>
              <p className="text-sm text-muted-foreground">Share a recording publicly or get a private link for friends.</p>
              <Button onClick={() => setShowModal(true)} className="mt-2 gap-2">
                <PlusCircle className="w-4 h-4" /> Share a Recording
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(myPosts as Post[]).map((p) => (
                <PostCard key={p.id} post={p} isOwn onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
