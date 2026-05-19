import { useTuner } from "@/hooks/use-tuner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Guitar } from "lucide-react";

const CENT_RANGE = 50;

// Note color: greener as you approach center, orange/red further away
function getNeedleColor(cents: number, inTune: boolean) {
  if (inTune) return "hsl(142 72% 50%)";
  if (Math.abs(cents) <= 20) return "hsl(38 92% 55%)";
  return "hsl(0 72% 55%)";
}

function TunerNeedle({ cents }: { cents: number }) {
  // Clamp to ±50
  const clamped = Math.max(-CENT_RANGE, Math.min(CENT_RANGE, cents));
  // Convert to angle: -50 = -60deg, 0 = 0deg, +50 = +60deg
  const angle = (clamped / CENT_RANGE) * 60;
  const color = getNeedleColor(cents, Math.abs(cents) <= 8);

  return (
    <div className="relative w-72 h-36 mx-auto select-none" aria-hidden>
      {/* Arc background */}
      <svg viewBox="0 0 288 144" className="absolute inset-0 w-full h-full" fill="none">
        {/* Outer arc */}
        <path
          d="M 20 140 A 124 124 0 0 1 268 140"
          stroke="hsl(var(--border))"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Center green zone */}
        <path
          d="M 132 140 A 12 12 0 0 1 156 140"
          stroke="hsl(142 72% 40%)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Tick marks */}
        {[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((cent) => {
          const a = (cent / 50) * 60; // degrees
          const rad = (a - 90) * (Math.PI / 180);
          const r = 114;
          const cx = 144 + r * Math.cos(rad);
          const cy = 144 + r * Math.sin(rad);
          const tickLen = cent === 0 ? 14 : Math.abs(cent) % 10 === 0 ? 10 : 6;
          const ir = r - tickLen;
          const ix = 144 + ir * Math.cos(rad);
          const iy = 144 + ir * Math.sin(rad);
          return (
            <line
              key={cent}
              x1={cx}
              y1={cy}
              x2={ix}
              y2={iy}
              stroke={cent === 0 ? "hsl(142 72% 45%)" : "hsl(var(--muted-foreground))"}
              strokeWidth={cent === 0 ? 2.5 : 1.5}
              strokeOpacity={cent === 0 ? 1 : 0.5}
            />
          );
        })}
        {/* Labels */}
        {[-40, -20, 0, 20, 40].map((cent) => {
          const a = (cent / 50) * 60;
          const rad = (a - 90) * (Math.PI / 180);
          const r = 96;
          const cx = 144 + r * Math.cos(rad);
          const cy = 144 + r * Math.sin(rad);
          return (
            <text
              key={cent}
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize="9"
              fill="hsl(var(--muted-foreground))"
              opacity={0.6}
            >
              {cent > 0 ? `+${cent}` : cent}
            </text>
          );
        })}
        {/* Needle */}
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: "144px 140px",
            transition: "transform 80ms ease-out",
          }}
        >
          <line
            x1={144}
            y1={140}
            x2={144}
            y2={30}
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transition: "stroke 150ms" }}
          />
          <circle cx={144} cy={140} r={5} fill={color} style={{ transition: "fill 150ms" }} />
        </g>
      </svg>
    </div>
  );
}

export default function Tuner() {
  const { tunerState, result, errorMsg, toggle } = useTuner();
  const isListening = tunerState === "listening";
  const hasResult = isListening && result !== null;

  const inTune = result?.inTune ?? false;
  const cents = result?.cents ?? 0;

  const sharpFlat =
    !result ? null :
    result.cents === 0 ? "In tune" :
    result.cents > 0 ? `+${result.cents}¢ sharp` :
    `${result.cents}¢ flat`;

  return (
    <div className="p-8 max-w-xl mx-auto flex flex-col items-center">
      {/* Header */}
      <div className="w-full mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Guitar className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Tuner</h1>
        </div>
        <p className="text-muted-foreground">
          Chromatic tuner — play a note and get it in tune.
        </p>
      </div>

      {/* Main tuner card */}
      <div className="w-full rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-6 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        {/* Note display */}
        <div className="relative z-10 flex flex-col items-center gap-1 min-h-[100px] justify-center">
          {hasResult ? (
            <>
              <div
                className="text-8xl font-bold tracking-tight transition-colors duration-150"
                style={{ color: getNeedleColor(cents, inTune) }}
                data-testid="text-detected-note"
              >
                {result.note}
                <span className="text-4xl text-muted-foreground ml-1 font-light">
                  {result.octave}
                </span>
              </div>
              <div
                className="text-sm font-mono tabular-nums transition-colors duration-150"
                style={{ color: getNeedleColor(cents, inTune) }}
                data-testid="text-frequency"
              >
                {result.frequency} Hz
              </div>
            </>
          ) : isListening ? (
            <div className="text-center space-y-2">
              <div className="text-5xl font-bold text-muted-foreground/30">—</div>
              <p className="text-sm text-muted-foreground animate-pulse">Listening for a note...</p>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="text-5xl font-bold text-muted-foreground/20">—</div>
              <p className="text-sm text-muted-foreground">Press start to begin tuning</p>
            </div>
          )}
        </div>

        {/* Needle */}
        <div className="relative z-10 w-full">
          <TunerNeedle cents={hasResult ? cents : 0} />
        </div>

        {/* Sharp / Flat label */}
        <div
          className="relative z-10 h-7 flex items-center justify-center"
          data-testid="text-tuning-status"
        >
          {hasResult && (
            <span
              className={cn(
                "px-4 py-1 rounded-full text-sm font-semibold transition-all duration-150",
                inTune
                  ? "bg-green-500/20 text-green-400"
                  : Math.abs(cents) <= 20
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              )}
            >
              {sharpFlat}
            </span>
          )}
        </div>

        {/* In-tune glow ring */}
        {inTune && hasResult && (
          <div className="absolute inset-0 rounded-2xl ring-2 ring-green-500/40 pointer-events-none transition-all" />
        )}
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col items-center gap-3 w-full">
        <Button
          data-testid="button-tuner-toggle"
          size="lg"
          onClick={toggle}
          className={cn(
            "w-full max-w-xs rounded-full gap-3 font-semibold text-base transition-all",
            isListening
              ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive hover:text-white"
              : ""
          )}
          variant={isListening ? "ghost" : "default"}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              Stop Tuner
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Start Tuner
            </>
          )}
        </Button>

        {errorMsg && (
          <p className="text-sm text-destructive text-center max-w-xs">{errorMsg}</p>
        )}

        {/* Reference table */}
        <div className="mt-6 w-full rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Standard Tuning Reference
          </p>
          <div className="grid grid-cols-6 gap-2 text-center">
            {[
              { string: "E2", freq: "82.4" },
              { string: "A2", freq: "110" },
              { string: "D3", freq: "146.8" },
              { string: "G3", freq: "196" },
              { string: "B3", freq: "246.9" },
              { string: "E4", freq: "329.6" },
            ].map(({ string, freq }) => (
              <div key={string} className="flex flex-col items-center gap-1">
                <span className="text-base font-bold text-primary font-mono">{string.charAt(0)}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{string.slice(1)}</span>
                <span className="text-[10px] text-muted-foreground/60 font-mono">{freq}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
