import { Circle, Square, Pause, Play, Loader2 } from "lucide-react";
import { type RecordState } from "@/hooks/useScreenRecorder";
import { formatSec } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  state: RecordState;
  duration: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function RecordingControls({ state, duration, onStart, onPause, onResume, onStop }: Props) {
  return (
    <div className="flex items-center gap-3">
      {/* Timer */}
      <div
        className={cn(
          "font-mono text-sm tabular-nums min-w-[52px]",
          state === "recording" && "text-red-500"
        )}
      >
        {state === "recording" || state === "paused" ? formatSec(duration) : "0:00"}
      </div>

      {state === "idle" && (
        <button
          onClick={onStart}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
        >
          <Circle className="w-3.5 h-3.5 fill-current" />
          Start Recording
        </button>
      )}

      {state === "recording" && (
        <>
          {/* Pulse indicator */}
          <span className="rec-pulse inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-sm font-medium transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        </>
      )}

      {state === "paused" && (
        <>
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-sm font-medium transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Resume
          </button>
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        </>
      )}

      {(state === "processing") && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Processing…
        </div>
      )}
    </div>
  );
}
