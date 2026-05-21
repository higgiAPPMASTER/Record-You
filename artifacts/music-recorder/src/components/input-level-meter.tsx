import { useEffect, useRef, useState } from "react";

interface InputLevelMeterProps {
  analyserNode: AnalyserNode | null;
  active: boolean;
}

export function InputLevelMeter({ analyserNode, active }: InputLevelMeterProps) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!analyserNode || !active) {
      setLevel(0);
      return;
    }

    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const tick = () => {
      analyserNode.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const norm = Math.max(0, Math.min(1, rms * 2.5));
      setLevel((prev) => prev * 0.6 + norm * 0.4);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode, active]);

  const pct = Math.round(level * 100);
  const color =
    level > 0.85 ? "bg-destructive" : level > 0.5 ? "bg-yellow-400" : "bg-primary";

  return (
    <div className="w-full">
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden border border-border">
        <div
          data-testid="input-level-fill"
          className={`h-full ${color} transition-[width] duration-75 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground text-center mt-1.5 uppercase tracking-wider">
        Input Level
      </div>
    </div>
  );
}
