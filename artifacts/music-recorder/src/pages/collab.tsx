import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { Mic, MicOff, Play, Pause, Send, Music2, CheckCircle2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CollabSong {
  id: number;
  title: string;
  hasAudio: boolean;
  duration: number | null;
  audioUrl: string | null;
}

interface CollabTrack {
  id: number;
  authorName: string | null;
  audioUrl: string;
  duration: number | null;
  createdAt: string;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CollabPage() {
  const [, params] = useRoute("/collab/:token");
  const token = params?.token ?? "";
  const { toast } = useToast();

  const [song, setSong] = useState<CollabSong | null>(null);
  const [tracks, setTracks] = useState<CollabTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Playback
  const originalRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Submission
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Collab track playback
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const collabAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/collab/${token}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) { setSong(data); setLoading(false); }
      })
      .catch(() => { setNotFound(true); setLoading(false); });

    fetch(`/api/collab/${token}/tracks`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setTracks(data))
      .catch(() => {});
  }, [token]);

  const toggleOriginal = () => {
    if (!originalRef.current || !song?.audioUrl) return;
    if (isPlayingOriginal) {
      originalRef.current.pause();
    } else {
      originalRef.current.play().catch(() => setIsPlayingOriginal(false));
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000 },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const mr = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 192000 });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setAudioBlob(blob);
      };

      mr.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);

      // Play the original track alongside
      if (originalRef.current && song?.audioUrl) {
        originalRef.current.currentTime = 0;
        originalRef.current.play().catch(() => {});
      }
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  }, [song, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      setAudioDuration(recordingTime);
      mediaRecorderRef.current?.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    if (originalRef.current) {
      originalRef.current.pause();
      originalRef.current.currentTime = 0;
      setIsPlayingOriginal(false);
    }
  }, [recordingTime]);

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("audio", audioBlob, "collab.webm");
      if (authorName.trim()) form.append("authorName", authorName.trim());
      if (audioDuration) form.append("duration", String(audioDuration));

      const res = await fetch(`/api/collab/${token}/tracks`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const newTrack: CollabTrack = await res.json();
      setTracks((prev) => [newTrack, ...prev]);
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit track", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCollabTrack = (track: CollabTrack) => {
    if (!collabAudioRef.current) return;
    if (playingTrackId === track.id) {
      collabAudioRef.current.pause();
      setPlayingTrackId(null);
    } else {
      collabAudioRef.current.src = track.audioUrl;
      collabAudioRef.current.play().then(() => setPlayingTrackId(track.id)).catch(() => setPlayingTrackId(null));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !song) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center p-8">
        <Music2 className="w-12 h-12 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="text-muted-foreground">This share link may have expired or is invalid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Music2 className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold text-lg tracking-tight">Record You</span>
        <span className="text-muted-foreground text-sm ml-2">— Collaboration</span>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Original track */}
        <Card className="p-6 bg-card border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Original Track</p>
          <h1 className="text-2xl font-bold mb-4">{song.title}</h1>

          {song.hasAudio && song.audioUrl ? (
            <div className="flex items-center gap-4">
              <audio
                ref={originalRef}
                src={song.audioUrl}
                onPlay={() => setIsPlayingOriginal(true)}
                onPause={() => setIsPlayingOriginal(false)}
                onEnded={() => setIsPlayingOriginal(false)}
              />
              <Button
                size="icon"
                variant="secondary"
                className="w-12 h-12 rounded-full flex-shrink-0"
                onClick={toggleOriginal}
                disabled={isRecording}
              >
                {isPlayingOriginal ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-[1px]" />}
              </Button>
              <div className="text-sm text-muted-foreground font-mono">
                {formatDuration(song.duration)}
              </div>
              <p className="text-xs text-muted-foreground italic">
                {isRecording ? "Playing alongside your recording…" : "Listen before you record"}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm italic">No audio on this track.</p>
          )}
        </Card>

        {/* Record section */}
        {!submitted ? (
          <Card className="p-6 bg-card border-border space-y-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Your Part</p>

            {!audioBlob ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <Button
                  size="lg"
                  className={cn(
                    "w-full max-w-xs rounded-full gap-3 font-semibold text-base",
                    isRecording
                      ? "bg-destructive text-white hover:bg-destructive/90"
                      : ""
                  )}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      Stop Recording — {formatDuration(recordingTime)}
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      Start Recording
                    </>
                  )}
                </Button>
                {isRecording && (
                  <p className="text-sm text-muted-foreground animate-pulse text-center">
                    Recording your part — the original plays through your speakers
                  </p>
                )}
                {!isRecording && (
                  <p className="text-xs text-muted-foreground text-center max-w-xs">
                    Hit record, play along to the original track, then stop when you're done.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Recording captured</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(audioDuration)} — ready to submit</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-muted-foreground"
                    onClick={() => { setAudioBlob(null); setAudioDuration(null); }}
                  >
                    Re-record
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Your name (optional)</label>
                  <Input
                    placeholder="e.g. Jamie"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="bg-background/50"
                  />
                </div>

                <Button
                  className="w-full gap-2 rounded-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? "Uploading…" : "Send to Artist"}
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-8 bg-card border-border flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold">Part submitted!</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              The artist will receive your recording and can mix it with the original track.
            </p>
          </Card>
        )}

        {/* Existing collaborations */}
        {tracks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">{tracks.length} collaboration{tracks.length !== 1 ? "s" : ""} submitted</p>
            </div>
            <audio
              ref={collabAudioRef}
              onEnded={() => setPlayingTrackId(null)}
              className="hidden"
            />
            <div className="space-y-2">
              {tracks.map((track) => (
                <Card key={track.id} className="p-4 flex items-center gap-4 border-border/50 bg-card/60">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="w-9 h-9 rounded-full flex-shrink-0"
                    onClick={() => toggleCollabTrack(track)}
                  >
                    {playingTrackId === track.id
                      ? <Pause className="w-4 h-4" />
                      : <Play className="w-4 h-4 translate-x-[1px]" />}
                  </Button>
                  <div>
                    <p className="font-medium text-sm">{track.authorName || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatDuration(track.duration)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
