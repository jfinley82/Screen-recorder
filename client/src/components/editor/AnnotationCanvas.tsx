import { useRef, useEffect, useCallback, useState } from "react";
import type { Annotation, AnnotationType } from "~/types";
import type { DrawTool } from "./AnnotationToolbar";
import { randomUUID } from "@/lib/uuid";

interface Props {
  annotations: Annotation[];
  currentTimeMs: number;
  durationMs: number;
  activeTool: DrawTool;
  activeColor: string;
  containerWidth: number;
  containerHeight: number;
  onChange: (annotations: Annotation[]) => void;
}

export function AnnotationCanvas({
  annotations,
  currentTimeMs,
  durationMs,
  activeTool,
  activeColor,
  containerWidth,
  containerHeight,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragging, setDragging] = useState<{ startX: number; startY: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Annotations visible at the current time
  const visible = annotations.filter(
    (a) => currentTimeMs >= a.startTime && currentTimeMs <= a.endTime
  );

  // Render annotations on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const ann of visible) {
      const x = (ann.x / 100) * canvas.width;
      const y = (ann.y / 100) * canvas.height;
      const w = ((ann.width ?? 20) / 100) * canvas.width;
      const h = ((ann.height ?? 10) / 100) * canvas.height;

      ctx.save();
      ctx.strokeStyle = ann.color ?? "#ef4444";
      ctx.fillStyle = ann.color ?? "#ef4444";
      ctx.lineWidth = 2;

      if (ann.type === "arrow") {
        drawArrow(ctx, x, y, x + w, y + h, ann.color ?? "#ef4444");
      } else if (ann.type === "text") {
        ctx.font = `${ann.fontSize ?? 18}px sans-serif`;
        ctx.fillStyle = ann.color ?? "#ef4444";
        ctx.fillText(ann.text ?? "", x, y);
      } else if (ann.type === "highlight") {
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x, y, w, h);
      } else if (ann.type === "rectangle") {
        ctx.strokeRect(x, y, w, h);
      } else if (ann.type === "circle") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ann.type === "blur") {
        ctx.filter = "blur(8px)";
        ctx.fillStyle = "rgba(128,128,128,0.5)";
        ctx.fillRect(x, y, w, h);
        ctx.filter = "none";
      }

      // Selection ring
      if (ann.id === selectedId) {
        ctx.globalAlpha = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }, [visible, selectedId]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool === "select") {
        // Hit-test annotations in reverse order (top-most first)
        const { x, y } = getPos(e);
        const hit = [...visible].reverse().find(
          (a) =>
            x >= a.x &&
            x <= a.x + (a.width ?? 20) &&
            y >= a.y &&
            y <= a.y + (a.height ?? 10)
        );
        setSelectedId(hit?.id ?? null);
        return;
      }

      if (activeTool === "text") {
        const text = prompt("Enter annotation text:");
        if (!text) return;
        const { x, y } = getPos(e);
        const ann: Annotation = {
          id: randomUUID(),
          type: "text",
          startTime: currentTimeMs,
          endTime: Math.min(currentTimeMs + 5000, durationMs),
          x,
          y,
          text,
          color: activeColor,
          fontSize: 20,
        };
        onChange([...annotations, ann]);
        return;
      }

      const { x, y } = getPos(e);
      setDragging({ startX: x, startY: y });
    },
    [activeTool, visible, annotations, currentTimeMs, durationMs, activeColor, onChange]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging || activeTool === "select" || activeTool === "text") {
        setDragging(null);
        return;
      }

      const { x, y } = getPos(e);
      const dx = x - dragging.startX;
      const dy = y - dragging.startY;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        setDragging(null);
        return;
      }

      const ann: Annotation = {
        id: randomUUID(),
        type: activeTool as AnnotationType,
        startTime: currentTimeMs,
        endTime: Math.min(currentTimeMs + 5000, durationMs),
        x: Math.min(dragging.startX, x),
        y: Math.min(dragging.startY, y),
        width: Math.abs(dx),
        height: Math.abs(dy),
        color: activeColor,
      };
      onChange([...annotations, ann]);
      setDragging(null);
    },
    [dragging, activeTool, annotations, currentTimeMs, durationMs, activeColor, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        onChange(annotations.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      }
    },
    [selectedId, annotations, onChange]
  );

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth}
      height={containerHeight}
      className="absolute inset-0 w-full h-full"
      style={{
        cursor:
          activeTool === "select"
            ? "default"
            : activeTool === "text"
            ? "text"
            : "crosshair",
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    />
  );
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
) {
  const headLen = 14;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
