import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Upload, Trash2, Loader2, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListTakesQueryKey } from "@workspace/api-client-react";

const NAME_KEY = "ry:take-author";

type Status = "idle" | "recording" | "review" | "uploading";

interface Props {
  songId: number;
  originalAudioUrl: string;
}

export function TakeRecorder({ songId, originalAudioUrl }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const originalRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewOrigRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [author, setAuthor] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(NAME_KEY) ?? ""
  );

  useEffect(() => () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [blobUrl]);

  const start = async () => {
    if (!author.trim()) {
      toast({ title: "Enter your name first", variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(b);
        setBlob(b);
        setBlobUrl(url);
        setStatus("review");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      const audio = originalRef.current;
      if (audio) { audio.currentTime = 0; await audio.play(); }
      rec.start();
      recorderRef.current = rec;
      setStatus("recording");
      setElapsed(0);
      const t0 = performance.now();
      const tick = () => {
        if (recorderRef.current?.state !== "recording") return;
        setElapsed((performance.now() - t0) / 1000);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (err) {
      toast({ title: "Microphone access denied", description: String(err), variant: "destructive" });
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    originalRef.current?.pause();
  };

  const togglePreview = async () => {
    const orig = previewOrigRef.current;
    const take = previewRef.current;
    if (!orig || !take) return;
    if (previewing) {
      orig.pause(); take.pause();
      setPreviewing(false);
    } else {
      orig.currentTime = 0; take.currentTime = 0;
      await Promise.all([orig.play(), take.play()]);
      setPreviewing(true);
      take.onended = () => { orig.pause(); setPreviewing(false); };
    }
  };

  const discard = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(null); setBlobUrl(null); setStatus("idle"); setElapsed(0); setPreviewing(false);
  };

  const upload = async () => {
    if (!blob || !author.trim()) return;
    setStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "take.webm");
      fd.append("author", author.trim());
      fd.append("duration", String(elapsed));
      const res = await fetch(`/api/songs/${songId}/takes`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      localStorage.setItem(NAME_KEY, author.trim());
      queryClient.invalidateQueries({ queryKey: getListTakesQueryKey(songId) });
      toast({ title: "Take sent!", description: "The artist will hear it next time they open this song." });
      discard();
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
      setStatus("review");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Headphones className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Record your part</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Put on headphones (so the original doesn't bleed into your mic). The track will play while you record on top.
      </p>

      <Input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        maxLength={60}
        disabled={status === "recording" || status === "uploading"}
        className="bg-background h-8 text-sm"
      />

      <audio ref={originalRef} src={originalAudioUrl} preload="auto" />

      {status === "idle" && (
        <Button onClick={start} className="w-full gap-2" size="lg">
          <Mic className="w-4 h-4" /> Start recording
        </Button>
      )}

      {status === "recording" && (
        <div className="space-y-2">
          <div className="text-center font-mono text-2xl text-primary">
            ● {elapsed.toFixed(1)}s
          </div>
          <Button onClick={stop} variant="destructive" className="w-full gap-2" size="lg">
            <Square className="w-4 h-4" /> Stop
          </Button>
        </div>
      )}

      {status === "review" && blobUrl && (
        <div className="space-y-2">
          <audio ref={previewOrigRef} src={originalAudioUrl} preload="auto" />
          <audio ref={previewRef} src={blobUrl} preload="auto" />
          <div className="text-xs text-center text-muted-foreground">
            Recorded {elapsed.toFixed(1)}s — preview plays your take over the original
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={togglePreview} variant="outline" className="gap-1">
              {previewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {previewing ? "Stop" : "Preview"}
            </Button>
            <Button onClick={discard} variant="outline" className="gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Retake
            </Button>
            <Button onClick={upload} className="gap-1">
              <Upload className="w-3.5 h-3.5" /> Send
            </Button>
          </div>
        </div>
      )}

      {status === "uploading" && (
        <Button disabled className="w-full gap-2" size="lg">
          <Loader2 className="w-4 h-4 animate-spin" /> Sending your take...
        </Button>
      )}
    </div>
  );
}
