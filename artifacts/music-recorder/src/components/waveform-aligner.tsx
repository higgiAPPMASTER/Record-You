import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  srcA: string;
  srcB: string;
  color?: string;
  offset: number;
  onOffset: (v: number) => void;
  height?: number;
}

const NUM_BARS = 100;
const MAX_OFFSET = 10;

async function decodePeaks(src: string): Promise<{ peaks: number[]; duration: number }> {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  const offlineCtx = new OfflineAudioContext(1, 44100, 44100);
  const decoded = await offlineCtx.decodeAudioData(buf);
  const data = decoded.getChannelData(0);
  const step = Math.floor(data.length / NUM_BARS);
  const peaks: number[] = [];
  for (let i = 0; i < NUM_BARS; i++) {
    let max = 0;
    for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j] ?? 0));
    peaks.push(max);
  }
  return { peaks, duration: decoded.duration };
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  peaksA: number[],
  peaksB: number[],
  durationA: number,
  durationB: number,
  color: string,
  offset: number,
  height: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  if (w === 0) return;
  canvas.width = w * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, height);

  const longerDuration = Math.max(durationA, durationB, 1);
  const pps = w / longerDuration; // pixels per second
  const barSlot = w / NUM_BARS;
  const barW = Math.max(1, barSlot - 1);

  const maxA = Math.max(...peaksA, 0.001);
  const maxB = Math.max(...peaksB, 0.001);

  // Draw Track A — dim reference
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#888888";
  peaksA.forEach((p, i) => {
    const barH = Math.max(2, (p / maxA) * (height - 6));
    const x = i * barSlot;
    const y = (height - barH) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 1);
    ctx.fill();
  });

  // Draw Track B — shifted by offset
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color;
  const shiftPx = offset * pps;
  peaksB.forEach((p, i) => {
    const barH = Math.max(2, (p / maxB) * (height - 6));
    const x = i * barSlot + shiftPx;
    if (x + barW < 0 || x > w) return; // off-screen
    const y = (height - barH) / 2;
    ctx.beginPath();
    ctx.roundRect(Math.max(0, x), y, barW - Math.max(0, -x), barH, 1);
    ctx.fill();
  });

  // Center alignment line
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(w / 2 - 0.5, 0, 1, height);

  ctx.globalAlpha = 1;
}

export function WaveformAligner({
  srcA, srcB, color = "hsl(var(--primary))", offset, onOffset, height = 64,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaksA, setPeaksA] = useState<number[] | null>(null);
  const [peaksB, setPeaksB] = useState<number[] | null>(null);
  const [durationA, setDurationA] = useState(1);
  const [durationB, setDurationB] = useState(1);
  const [loading, setLoading] = useState(true);

  const drag = useRef<{ startX: number; startOffset: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([decodePeaks(srcA), decodePeaks(srcB)]).then(([a, b]) => {
      if (cancelled) return;
      setPeaksA(a.peaks);
      setDurationA(a.duration);
      setPeaksB(b.peaks);
      setDurationB(b.duration);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [srcA, srcB]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaksA || !peaksB) return;
    drawCanvas(canvas, peaksA, peaksB, durationA, durationB, color, offset, height);
  }, [peaksA, peaksB, durationA, durationB, color, offset, height]);

  const getPps = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const w = canvas.offsetWidth;
    const longer = Math.max(durationA, durationB, 1);
    return w / longer;
  }, [durationA, durationB]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    drag.current = { startX: e.clientX, startOffset: offset };
    e.preventDefault();
  }, [offset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag.current) return;
    const delta = e.clientX - drag.current.startX;
    const newOffset = Math.round(
      Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, drag.current.startOffset + delta / getPps())) * 20
    ) / 20;
    onOffset(newOffset);
  }, [getPps, onOffset]);

  const onMouseUp = useCallback(() => { drag.current = null; }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    drag.current = { startX: e.touches[0].clientX, startOffset: offset };
  }, [offset]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drag.current) return;
    const delta = e.touches[0].clientX - drag.current.startX;
    const newOffset = Math.round(
      Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, drag.current.startOffset + delta / getPps())) * 20
    ) / 20;
    onOffset(newOffset);
    e.preventDefault();
  }, [getPps, onOffset]);

  const onTouchEnd = useCallback(() => { drag.current = null; }, []);

  if (loading) {
    return <div className="animate-pulse bg-muted/40 rounded" style={{ height }} />;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground select-none">
        <span>← drag to align</span>
        <span>drag to align →</span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded cursor-ew-resize touch-none"
        style={{ height, display: "block" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
}
