import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  color?: string;
  height?: number;
}

export function MixerWaveform({ src, color = "hsl(var(--primary))", height = 40 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(src);
        const arrayBuf = await res.arrayBuffer();
        const offlineCtx = new OfflineAudioContext(1, 44100, 44100);
        const decoded = await offlineCtx.decodeAudioData(arrayBuf);
        if (cancelled) return;

        const data = decoded.getChannelData(0);
        const numBars = 120;
        const step = Math.floor(data.length / numBars);
        const peaks: number[] = [];
        for (let i = 0; i < numBars; i++) {
          let max = 0;
          for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j] ?? 0));
          peaks.push(max);
        }

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.offsetWidth, height);

        const maxPeak = Math.max(...peaks, 0.001);
        const barW = canvas.offsetWidth / numBars - 0.5;

        peaks.forEach((p, i) => {
          const barH = Math.max(2, (p / maxPeak) * (height - 4));
          const x = i * (canvas.offsetWidth / numBars);
          const y = (height - barH) / 2;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.roundRect(x, y, barW, barH, 1);
          ctx.fill();
        });

        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [src, color, height]);

  if (loading) {
    return <div className="animate-pulse bg-muted/40 rounded" style={{ height }} />;
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded"
      style={{ height, display: "block" }}
    />
  );
}
