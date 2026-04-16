import { useEffect, useRef } from "react";
import { type WebcamPosition, type WebcamSize, type WebcamShape } from "~/types";
import { cn } from "@/lib/utils";

interface Props {
  enabled: boolean;
  position: WebcamPosition;
  size: WebcamSize;
  shape: WebcamShape;
  onPositionChange: (pos: WebcamPosition) => void;
  onSizeChange: (size: WebcamSize) => void;
  onShapeChange: (shape: WebcamShape) => void;
}

const SIZE_LABELS: Record<WebcamSize, string> = { sm: "Small", md: "Medium", lg: "Large" };
const POSITION_OPTIONS: { value: WebcamPosition; label: string }[] = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
];

export function WebcamControls({ enabled, position, size, shape, onPositionChange, onSizeChange, onShapeChange }: Props) {
  return (
    <div className={cn("space-y-3 transition-opacity", !enabled && "opacity-40 pointer-events-none")}>
      {/* Position grid */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Position</p>
        <div className="grid grid-cols-2 gap-1.5">
          {POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPositionChange(opt.value)}
              className={cn(
                "px-2 py-1.5 rounded-md text-xs font-medium border transition-colors",
                position === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</p>
        <div className="flex gap-1.5">
          {(["sm", "md", "lg"] as WebcamSize[]).map((s) => (
            <button
              key={s}
              onClick={() => onSizeChange(s)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors",
                size === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary text-foreground"
              )}
            >
              {SIZE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Shape */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Shape</p>
        <div className="flex gap-1.5">
          {(["circle", "rounded"] as WebcamShape[]).map((s) => (
            <button
              key={s}
              onClick={() => onShapeChange(s)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium border capitalize transition-colors",
                shape === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Floating webcam preview shown outside the main canvas (for UI feedback only) */
export function WebcamPreview({
  videoRef,
  shape,
  size,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  shape: WebcamShape;
  size: WebcamSize;
}) {
  const SIZE_PX: Record<WebcamSize, number> = { sm: 64, md: 96, lg: 128 };
  const px = SIZE_PX[size];

  return (
    <div
      className="absolute bottom-4 right-4 overflow-hidden border-2 border-white/80 shadow-lg"
      style={{
        width: px,
        height: px,
        borderRadius: shape === "circle" ? "50%" : 12,
      }}
    >
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        muted
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}
