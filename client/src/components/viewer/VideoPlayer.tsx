import { useRef, useEffect } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { Annotation, Chapter } from "~/types";
import { AnnotationCanvas } from "../editor/AnnotationCanvas";
import { formatMs, cn } from "@/lib/utils";

interface Props {
  playbackId: string;
  annotations: Annotation[];
  chapters: Chapter[];
  trimStart: number;
  trimEnd: number;
  currentTimeMs: number;
  onTimeUpdate: (ms: number) => void;
  /** Called once so the parent can trigger seeks (e.g. from transcript clicks) */
  onSeekReady?: (seek: (ms: number) => void) => void;
}

export function VideoPlayer({
  playbackId,
  annotations,
  chapters,
  trimStart,
  trimEnd,
  currentTimeMs,
  onTimeUpdate,
  onSeekReady,
}: Props) {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Expose seek function to parent once player is ready
  useEffect(() => {
    if (!onSeekReady) return;
    onSeekReady((ms: number) => {
      if (playerRef.current) playerRef.current.currentTime = ms / 1000;
    });
  }, [onSeekReady]);

  const handleTimeUpdate = () => {
    const video = playerRef.current;
    if (!video) return;
    const ms = video.currentTime * 1000;

    // Enforce trim bounds
    if (ms < trimStart) {
      video.currentTime = trimStart / 1000;
      return;
    }
    if (ms > trimEnd) {
      video.pause();
      return;
    }

    onTimeUpdate(ms);
  };

  const seekTo = (ms: number) => {
    if (playerRef.current) playerRef.current.currentTime = ms / 1000;
  };

  return (
    <div className="space-y-3">
      {/* Chapter pills */}
      {chapters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              onClick={() => seekTo(ch.startTime)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors",
                currentTimeMs >= ch.startTime &&
                  (i === chapters.length - 1 || currentTimeMs < chapters[i + 1].startTime)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-border text-foreground"
              )}
            >
              <span className="opacity-60">{i + 1}.</span>
              {ch.title}
              <span className="opacity-50 ml-0.5">{formatMs(ch.startTime)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Player with annotation overlay */}
      <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <MuxPlayer
          ref={playerRef as React.RefObject<HTMLVideoElement>}
          playbackId={playbackId}
          style={{ width: "100%", height: "100%" }}
          onTimeUpdate={handleTimeUpdate}
          streamType="on-demand"
          startTime={trimStart / 1000}
        />

        {/* Annotation overlay — read-only in viewer */}
        <AnnotationCanvas
          annotations={annotations}
          currentTimeMs={currentTimeMs}
          durationMs={trimEnd - trimStart}
          activeTool="select"
          activeColor="#ef4444"
          containerWidth={containerRef.current?.clientWidth ?? 800}
          containerHeight={containerRef.current?.clientHeight ?? 450}
          onChange={() => {}}
        />
      </div>
    </div>
  );
}
