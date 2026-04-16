import { useRef, useCallback } from "react";
import { formatMs } from "@/lib/utils";
import type { Chapter, Annotation } from "~/types";
import { cn } from "@/lib/utils";

interface Props {
  durationMs: number;
  currentTimeMs: number;
  trimStart: number;
  trimEnd: number;
  chapters: Chapter[];
  annotations: Annotation[];
  onSeek: (ms: number) => void;
  onTrimStartChange: (ms: number) => void;
  onTrimEndChange: (ms: number) => void;
}

const HANDLE_W = 8;

export function Timeline({
  durationMs,
  currentTimeMs,
  trimStart,
  trimEnd,
  chapters,
  annotations,
  onSeek,
  onTrimStartChange,
  onTrimEndChange,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<"start" | "end" | "playhead" | null>(null);

  const pct = (ms: number) => `${(ms / durationMs) * 100}%`;

  const msFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const rect = barRef.current!.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      return Math.round(ratio * durationMs);
    },
    [durationMs]
  );

  const onMouseDown = (which: "start" | "end" | "playhead") => (e: React.MouseEvent) => {
    e.stopPropagation();
    draggingRef.current = which;

    const onMove = (ev: MouseEvent) => {
      const ms = msFromEvent(ev);
      if (which === "start") onTrimStartChange(Math.min(ms, trimEnd - 500));
      else if (which === "end") onTrimEndChange(Math.max(ms, trimStart + 500));
      else onSeek(ms);
    };

    const onUp = () => {
      draggingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingRef.current) return;
    onSeek(msFromEvent(e));
  };

  return (
    <div className="space-y-1">
      {/* Time labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{formatMs(trimStart)}</span>
        <span className="text-foreground font-medium tabular-nums">{formatMs(currentTimeMs)}</span>
        <span>{formatMs(trimEnd)}</span>
      </div>

      {/* Track */}
      <div
        ref={barRef}
        className="relative h-12 bg-secondary rounded-lg cursor-pointer overflow-visible select-none"
        onClick={handleBarClick}
      >
        {/* Full duration bar */}
        <div className="absolute inset-0 rounded-lg bg-secondary" />

        {/* Trimmed-out regions (darkened) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-background/60 rounded-l-lg"
          style={{ width: pct(trimStart) }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-background/60 rounded-r-lg"
          style={{ left: pct(trimEnd) }}
        />

        {/* Active region */}
        <div
          className="absolute top-0 bottom-0 bg-primary/20"
          style={{ left: pct(trimStart), width: pct(trimEnd - trimStart) }}
        />

        {/* Chapter markers */}
        {chapters.map((ch) => (
          <div
            key={ch.id}
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/80"
            style={{ left: pct(ch.startTime) }}
            title={ch.title}
          />
        ))}

        {/* Annotation markers */}
        {annotations.map((ann) => (
          <div
            key={ann.id}
            className="absolute bottom-1 h-1.5 rounded-full bg-blue-400/70"
            style={{
              left: pct(ann.startTime),
              width: Math.max(4, ((ann.endTime - ann.startTime) / durationMs) * 100) + "%",
            }}
          />
        ))}

        {/* Trim start handle */}
        <div
          className="absolute top-0 bottom-0 flex items-center justify-center cursor-ew-resize z-10"
          style={{ left: `calc(${pct(trimStart)} - ${HANDLE_W / 2}px)`, width: HANDLE_W }}
          onMouseDown={onMouseDown("start")}
        >
          <div className="w-full h-full bg-primary rounded-l-sm" />
        </div>

        {/* Trim end handle */}
        <div
          className="absolute top-0 bottom-0 flex items-center justify-center cursor-ew-resize z-10"
          style={{ left: `calc(${pct(trimEnd)} - ${HANDLE_W / 2}px)`, width: HANDLE_W }}
          onMouseDown={onMouseDown("end")}
        >
          <div className="w-full h-full bg-primary rounded-r-sm" />
        </div>

        {/* Playhead */}
        <div
          className={cn(
            "absolute top-0 bottom-0 z-20 flex flex-col items-center cursor-pointer"
          )}
          style={{ left: pct(currentTimeMs), transform: "translateX(-50%)" }}
          onMouseDown={onMouseDown("playhead")}
        >
          {/* Head triangle */}
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-foreground mt-0" />
          {/* Line */}
          <div className="w-0.5 flex-1 bg-foreground" />
        </div>
      </div>
    </div>
  );
}
