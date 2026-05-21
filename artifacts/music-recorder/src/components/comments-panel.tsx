import { useState } from "react";
import {
  useListComments,
  useCreateComment,
  getListCommentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const NAME_KEY = "ry:comment-author";

interface Props {
  songId: number;
  /** When true, shows the form for visitors to leave feedback. Owners can hide it. */
  allowPost?: boolean;
  title?: string;
}

export function CommentsPanel({ songId, allowPost = true, title = "Feedback" }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: comments = [], isLoading } = useListComments(songId, {
    query: { enabled: !!songId, queryKey: getListCommentsQueryKey(songId) },
  });
  const createComment = useCreateComment();

  const [author, setAuthor] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(NAME_KEY) ?? "";
  });
  const [body, setBody] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    try {
      await createComment.mutateAsync({
        id: songId,
        data: { author: author.trim(), body: body.trim() },
      });
      localStorage.setItem(NAME_KEY, author.trim());
      setBody("");
      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(songId) });
      toast({ title: "Comment posted", description: "Thanks for the feedback!" });
    } catch {
      toast({ title: "Could not post comment", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">
          {title} {comments.length > 0 && (
            <span className="text-muted-foreground font-normal ml-1">({comments.length})</span>
          )}
        </h3>
      </div>

      {allowPost && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            className="bg-background h-8 text-sm"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a note, suggestion, or compliment..."
            maxLength={2000}
            rows={3}
            className="bg-background text-sm resize-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!author.trim() || !body.trim() || createComment.isPending}
            className="w-full gap-2"
          >
            {createComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Post
          </Button>
        </form>
      )}

      {isLoading ? (
        <div className="text-center text-muted-foreground text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-6 border border-dashed border-border rounded-lg">
          No feedback yet.{allowPost ? " Be the first to leave one." : " Share the link to start getting feedback."}
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="font-semibold text-sm text-primary">{c.author}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
