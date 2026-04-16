import { SIZE_PRESETS, type SizePreset } from "~/types";
import { cn } from "@/lib/utils";
import { Monitor, Square, Smartphone } from "lucide-react";

interface Props {
  value: SizePreset;
  onChange: (preset: SizePreset) => void;
}

function PresetIcon({ id }: { id: string }) {
  if (id === "vertical") return <Smartphone className="w-4 h-4" />;
  if (id === "square") return <Square className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

export function SizePresetPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Recording Size
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SIZE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onChange(preset)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all",
              value.id === preset.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40 hover:bg-secondary text-foreground"
            )}
          >
            <PresetIcon id={preset.id} />
            <span className="text-xs font-medium leading-none">{preset.label}</span>
            <span className="text-[10px] text-muted-foreground leading-none">
              {preset.width}×{preset.height}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
