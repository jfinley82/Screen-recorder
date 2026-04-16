import { useRef, useEffect } from "react";
import type { TranscriptSegment } from "~/types";
import { formatMs, cn } from "@/lib/utils";

interface Props {
  segments: TranscriptSegment[];
  currentTimeMs: number;
  onSeek: (ms: number) => void;
}

export function TranscriptPanel({ segments, currentTimeMs, onSeek }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll the active segment into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentTimeMs]);

  if (!segments.length) {
    return (
      <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
        No transcript available for this recording.
      </div>
    );
  }

  // Find the active segment
  const activeIdx = segments.findLastIndex((s) => currentTimeMs >= s.startTime);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Transcript
        </p>
        <span className="text-xs text-muted-foreground">{segments.length} segments</span>
      </div>
      <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
        {segments.map((seg, i) => (
          <button
            key={seg.id}
            ref={i === activeIdx ? (activeRef as React.RefObject<HTMLButtonElement>) : undefined}
            onClick={() => onSeek(seg.startTime)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group",
              i === activeIdx
                ? "bg-primary/10 text-primary"
                : "hover:bg-secondary text-foreground"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-mono mr-2 transition-colors",
                i === activeIdx ? "text-primary/70" : "text-muted-foreground group-hover:text-foreground"
              )}
            >
              {formatMs(seg.startTime)}
            </span>
            {seg.text}
          </button>
        ))}
      </div>
    </div>
  );
}
