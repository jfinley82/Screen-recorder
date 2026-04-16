import { useRef, useState, useEffect } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { Annotation, Chapter, TranscriptSegment } from "~/types";
import { AnnotationCanvas } from "../editor/AnnotationCanvas";
import { formatMs } from "@/lib/utils";

interface Props {
  playbackId: string;
  annotations: Annotation[];
  chapters: Chapter[];
  trimStart: number;
  trimEnd: number;
  transcript?: TranscriptSegment[];
  onTimeUpdate?: (ms: number) => void;
}

export function VideoPlayer({
  playbackId,
  annotations,
  chapters,
  trimStart,
  trimEnd,
  transcript,
  onTimeUpdate,
}: Props) {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 450 });
  const [currentTimeMs, setCurrentTimeMs] = useState(trimStart);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: Math.round(width), h: Math.round(height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const handleTimeUpdate = () => {
    const video = playerRef.current;
    if (!video) return;
    const ms = video.currentTime * 1000;
    setCurrentTimeMs(ms);
    onTimeUpdate?.(ms);

    // Enforce trim
    if (ms < trimStart) {
      video.currentTime = trimStart / 1000;
    } else if (ms > trimEnd) {
      video.pause();
    }
  };

  // Seek to chapter
  const seekTo = (ms: number) => {
    if (playerRef.current) playerRef.current.currentTime = ms / 1000;
  };

  return (
    <div className="space-y-4">
      {/* Chapters bar */}
      {chapters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              onClick={() => seekTo(ch.startTime)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            >
              <span className="text-muted-foreground">{i + 1}.</span>
              {ch.title}
              <span className="text-muted-foreground">{formatMs(ch.startTime)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Video */}
      <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <MuxPlayer
          ref={playerRef as React.RefObject<HTMLVideoElement>}
          playbackId={playbackId}
          style={{ width: "100%", height: "100%" }}
          onTimeUpdate={handleTimeUpdate}
          streamType="on-demand"
          startTime={trimStart / 1000}
        />

        {/* Annotation overlay (read-only in viewer) */}
        <AnnotationCanvas
          annotations={annotations}
          currentTimeMs={currentTimeMs}
          durationMs={trimEnd - trimStart}
          activeTool="select"
          activeColor="#ef4444"
          containerWidth={containerSize.w}
          containerHeight={containerSize.h}
          onChange={() => {}} // read-only
        />
      </div>

      {/* Transcript */}
      {transcript && transcript.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-4 space-y-1 text-sm">
          {transcript.map((seg) => (
            <button
              key={seg.id}
              onClick={() => seekTo(seg.startTime)}
              className={`block w-full text-left px-2 py-1 rounded transition-colors hover:bg-secondary ${
                currentTimeMs >= seg.startTime && currentTimeMs <= seg.endTime
                  ? "bg-primary/10 text-primary"
                  : "text-foreground"
              }`}
            >
              <span className="text-muted-foreground text-xs mr-2">{formatMs(seg.startTime)}</span>
              {seg.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
