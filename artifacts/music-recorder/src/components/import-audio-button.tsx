import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { saveLocalSong } from "@/lib/local-songs";
import { extractWaveformPeaks } from "@/lib/waveform";

interface Props {
  onImported?: () => void;
  variant?: "default" | "outline" | "ghost";
}

export function ImportAudioButton({ onImported, variant = "outline" }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const ctx = new AudioContext();
      let duration = 0;
      try {
        const ab = await file.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        duration = buf.duration;
      } catch { duration = 0; }
      await ctx.close();

      const peaks = await extractWaveformPeaks(file).catch(() => [] as number[]);
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || file.name;
      const mimeType = file.type || "audio/wav";

      await saveLocalSong({ title, tags: "", notes: "", duration, blob: file, mimeType, waveform: peaks.length > 0 ? peaks : null });
      toast({ title: "Imported!", description: `"${title}" added to your library.` });
      onImported?.();
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        multiple
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(handleFile);
        }}
      />
      <Button variant={variant} disabled={importing} onClick={() => inputRef.current?.click()} className="gap-2">
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {importing ? "Importing..." : "Import File"}
      </Button>
    </>
  );
}
