import type { Overlay } from "~/types";
import { cn } from "@/lib/utils";

interface Props {
  overlays: Overlay[];
  currentTimeMs: number;
}

/**
 * Renders overlay elements (lower thirds, CTAs, logos) as positioned HTML
 * on top of the video. Shown only when the current time falls within the
 * overlay's start/end window.
 */
export function OverlayCanvas({ overlays, currentTimeMs }: Props) {
  const visible = overlays.filter(
    (o) => currentTimeMs >= o.startTime && currentTimeMs <= o.endTime
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {visible.map((overlay) => {
        if (overlay.type === "lower-third") {
          return (
            <div
              key={overlay.id}
              className="absolute bottom-12 left-6 right-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="inline-block bg-black/80 backdrop-blur-sm px-4 py-2 rounded-lg border-l-4 border-primary">
                <p className="text-white font-semibold text-lg leading-tight">
                  {overlay.content}
                </p>
                {overlay.subtitle && (
                  <p className="text-white/70 text-sm mt-0.5">{overlay.subtitle}</p>
                )}
              </div>
            </div>
          );
        }

        if (overlay.type === "cta") {
          return (
            <div
              key={overlay.id}
              className="absolute bottom-8 right-6 pointer-events-auto animate-in fade-in slide-in-from-right-2 duration-300"
            >
              <div className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl shadow-lg font-medium text-sm">
                {overlay.content}
              </div>
            </div>
          );
        }

        if (overlay.type === "logo" && overlay.imageUrl) {
          const x = overlay.x ?? 2;
          const y = overlay.y ?? 2;
          const w = overlay.width ?? 15;
          return (
            <img
              key={overlay.id}
              src={overlay.imageUrl}
              alt="Logo"
              className="absolute object-contain"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${w}%`,
              }}
            />
          );
        }

        if (overlay.type === "zoom") {
          // Zoom effect — magnify a region of the video by scaling the container
          const { zoomX = 50, zoomY = 50, zoomScale = 2 } = overlay;
          return (
            <div
              key={overlay.id}
              className="absolute inset-0"
              style={{
                transform: `scale(${zoomScale}) translate(${(50 - zoomX) / zoomScale}%, ${(50 - zoomY) / zoomScale}%)`,
                transformOrigin: "center center",
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

// ── Overlay creator form ──────────────────────────────────────────────────────

interface OverlayFormProps {
  currentTimeMs: number;
  durationMs: number;
  onAdd: (overlay: Overlay) => void;
}

import { useState } from "react";
import type { OverlayType } from "~/types";
import { randomUUID } from "@/lib/uuid";
import { Plus } from "lucide-react";

const OVERLAY_TYPES: { id: OverlayType; label: string; description: string }[] = [
  { id: "lower-third", label: "Lower Third", description: "Name / title bar at the bottom" },
  { id: "cta", label: "Call to Action", description: "Button-style CTA in the corner" },
  { id: "logo", label: "Logo", description: "Image watermark with position control" },
];

export function OverlayCreator({ currentTimeMs, durationMs, onAdd }: OverlayFormProps) {
  const [type, setType] = useState<OverlayType>("lower-third");
  const [content, setContent] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [duration, setDuration] = useState(5000); // ms

  const handleAdd = () => {
    if (!content && type !== "logo") return;
    if (!imageUrl && type === "logo") return;

    const overlay: Overlay = {
      id: randomUUID(),
      type,
      startTime: currentTimeMs,
      endTime: Math.min(currentTimeMs + duration, durationMs),
      content: type !== "logo" ? content : undefined,
      subtitle: type === "lower-third" ? subtitle : undefined,
      imageUrl: type === "logo" ? imageUrl : undefined,
      x: type === "logo" ? 2 : undefined,
      y: type === "logo" ? 2 : undefined,
      width: type === "logo" ? 15 : undefined,
    };

    onAdd(overlay);
    setContent("");
    setSubtitle("");
    setImageUrl("");
  };

  return (
    <div className="space-y-3">
      {/* Type selector */}
      <div className="space-y-1">
        {OVERLAY_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors",
              type === t.id
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-secondary"
            )}
          >
            <p className="font-medium">{t.label}</p>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>

      {/* Fields */}
      {(type === "lower-third" || type === "cta") && (
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === "lower-third" ? "Name or title" : "Button text"}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-primary"
        />
      )}
      {type === "lower-third" && (
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional)"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-primary"
        />
      )}
      {type === "logo" && (
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (https://…)"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-primary"
        />
      )}

      {/* Duration */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Show for</span>
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-border bg-background outline-none focus:border-primary"
        >
          <option value={3000}>3 seconds</option>
          <option value={5000}>5 seconds</option>
          <option value={10000}>10 seconds</option>
          <option value={30000}>30 seconds</option>
          <option value={60000}>Until end</option>
        </select>
      </div>

      <button
        onClick={handleAdd}
        disabled={(!content && type !== "logo") || (!imageUrl && type === "logo")}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        <Plus className="w-3.5 h-3.5" />
        Add overlay at {Math.floor(currentTimeMs / 60000)}:{String(Math.floor((currentTimeMs % 60000) / 1000)).padStart(2, "0")}
      </button>
    </div>
  );
}
