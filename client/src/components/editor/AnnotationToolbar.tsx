import { MousePointer, ArrowRight, Type, Highlighter, Square, Circle, Blend } from "lucide-react";
import type { AnnotationType } from "~/types";
import { cn } from "@/lib/utils";

export type DrawTool = "select" | AnnotationType;

const TOOLS: { id: DrawTool; icon: React.ReactNode; label: string }[] = [
  { id: "select", icon: <MousePointer className="w-4 h-4" />, label: "Select" },
  { id: "arrow", icon: <ArrowRight className="w-4 h-4" />, label: "Arrow" },
  { id: "text", icon: <Type className="w-4 h-4" />, label: "Text" },
  { id: "highlight", icon: <Highlighter className="w-4 h-4" />, label: "Highlight" },
  { id: "rectangle", icon: <Square className="w-4 h-4" />, label: "Rectangle" },
  { id: "circle", icon: <Circle className="w-4 h-4" />, label: "Circle" },
  { id: "blur", icon: <Blend className="w-4 h-4" />, label: "Blur" },
];

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ffffff", "#000000"];

interface Props {
  activeTool: DrawTool;
  activeColor: string;
  onToolChange: (tool: DrawTool) => void;
  onColorChange: (color: string) => void;
}

export function AnnotationToolbar({ activeTool, activeColor, onToolChange, onColorChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl shadow-sm">
      {/* Tools */}
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
              activeTool === tool.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={cn(
              "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
              activeColor === color ? "border-foreground scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
