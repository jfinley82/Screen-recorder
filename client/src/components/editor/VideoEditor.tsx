import { useRef, useState, useEffect, useCallback } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { Play, Pause, SkipBack, Sparkles, Loader2, BookOpen, Share2, Check } from "lucide-react";
import { Timeline } from "./Timeline";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { AnnotationToolbar, type DrawTool } from "./AnnotationToolbar";
import { trpc } from "@/lib/trpc";
import type { Annotation, Chapter, Overlay, Recording } from "~/types";
import { randomUUID } from "@/lib/uuid";
import { formatMs, cn } from "@/lib/utils";

interface Props {
  recording: Recording;
  onSaved?: () => void;
}

export function VideoEditor({ recording, onSaved }: Props) {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 450 });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const durationMs = (recording.duration ?? 0) * 1000;
  const [trimStart, setTrimStart] = useState(recording.trimStart ?? 0);
  const [trimEnd, setTrimEnd] = useState(recording.trimEnd ?? durationMs);
  const [annotations, setAnnotations] = useState<Annotation[]>(
    (recording.annotations as Annotation[]) ?? []
  );
  const [chapters, setChapters] = useState<Chapter[]>(
    (recording.chapters as Chapter[]) ?? []
  );
  const [overlays] = useState<Overlay[]>((recording.overlays as Overlay[]) ?? []);

  const [activeTool, setActiveTool] = useState<DrawTool>("select");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [activeTab, setActiveTab] = useState<"annotations" | "chapters" | "overlays" | "ai">("annotations");
  const [saved, setSaved] = useState(false);

  const saveEdits = trpc.recordings.saveEdits.useMutation();
  const autoEditMut = trpc.ai.autoEdit.useMutation();
  const updateTitle = trpc.recordings.updateTitle.useMutation();
  const updateSharing = trpc.recordings.updateSharing.useMutation();

  // Track container size for annotation canvas
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: Math.round(width), h: Math.round(height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Sync playhead with the Mux player
  const handleTimeUpdate = useCallback(() => {
    const video = playerRef.current;
    if (!video) return;
    const ms = video.currentTime * 1000;
    setCurrentTimeMs(ms);

    // Auto-stop at trim end
    if (ms >= trimEnd) {
      video.pause();
      setIsPlaying(false);
    }
  }, [trimEnd]);

  const seek = useCallback((ms: number) => {
    const video = playerRef.current;
    if (video) video.currentTime = ms / 1000;
    setCurrentTimeMs(ms);
  }, []);

  const togglePlay = () => {
    const video = playerRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (currentTimeMs >= trimEnd) seek(trimStart);
      video.play();
      setIsPlaying(true);
    }
  };

  const handleSave = async () => {
    await saveEdits.mutateAsync({
      id: recording.id,
      trimStart,
      trimEnd,
      annotations: annotations as object[],
      chapters: chapters as object[],
      overlays: overlays as object[],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  const handleAddChapter = () => {
    const title = prompt("Chapter title:");
    if (!title) return;
    setChapters((prev) => [
      ...prev,
      { id: randomUUID(), title, startTime: currentTimeMs },
    ].sort((a, b) => a.startTime - b.startTime));
  };

  const handleAutoEdit = async () => {
    if (!recording.muxPlaybackId) return;
    // For demo, pass a placeholder transcript. In production, fetch real VTT from Mux.
    const transcript = `[0:00] Welcome to this tutorial.
[0:05] Today we will cover, um, the basics of the topic.
[0:12] Let me share my screen. Actually, let me... let me just reload this.
[0:25] Okay, so first things first. You need to understand the fundamentals.
[0:45] There are three key concepts. One: setup. Two: configuration. Three: deployment.
[1:20] And that's basically it for the first section.
[1:30] Next we will look at... uh... advanced features.`;

    const result = await autoEditMut.mutateAsync({
      recordingId: recording.id,
      transcript,
      durationSeconds: recording.duration ?? 0,
    });

    if (result.chapters?.length) {
      setChapters(result.chapters as Chapter[]);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/v/${recording.shareToken}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="flex h-full">
      {/* Left: Video + timeline */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editable title */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-3">
          <input
            defaultValue={recording.title}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== recording.title) {
                updateTitle.mutate({ id: recording.id, title });
              }
            }}
            className="flex-1 text-xl font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-colors"
          />
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button
            onClick={handleSave}
            disabled={saveEdits.isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors",
              saved
                ? "bg-green-500 text-white"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            {saveEdits.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
            {saved ? "Saved" : "Save"}
          </button>
        </div>

        {/* Annotation toolbar */}
        <div className="px-6 pb-3">
          <AnnotationToolbar
            activeTool={activeTool}
            activeColor={activeColor}
            onToolChange={setActiveTool}
            onColorChange={setActiveColor}
          />
        </div>

        {/* Video area */}
        <div className="flex-1 px-6 pb-4 min-h-0">
          <div
            ref={containerRef}
            className="relative w-full h-full bg-black rounded-xl overflow-hidden"
          >
            {recording.muxPlaybackId ? (
              <MuxPlayer
                ref={playerRef as React.RefObject<HTMLVideoElement>}
                playbackId={recording.muxPlaybackId}
                style={{ width: "100%", height: "100%" }}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                streamType="on-demand"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Processing video…
              </div>
            )}

            {/* Annotation overlay */}
            <AnnotationCanvas
              annotations={annotations}
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              activeTool={activeTool}
              activeColor={activeColor}
              containerWidth={containerSize.w}
              containerHeight={containerSize.h}
              onChange={setAnnotations}
            />
          </div>
        </div>

        {/* Playback controls */}
        <div className="px-6 pb-2 flex items-center gap-3">
          <button
            onClick={() => seek(trimStart)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatMs(currentTimeMs)} / {formatMs(durationMs)}
          </span>
        </div>

        {/* Timeline */}
        <div className="px-6 pb-6">
          <Timeline
            durationMs={durationMs}
            currentTimeMs={currentTimeMs}
            trimStart={trimStart}
            trimEnd={trimEnd || durationMs}
            chapters={chapters}
            annotations={annotations}
            onSeek={seek}
            onTrimStartChange={setTrimStart}
            onTrimEndChange={setTrimEnd}
          />
        </div>
      </div>

      {/* Right: Panel */}
      <div className="w-72 border-l border-border flex flex-col shrink-0">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["annotations", "chapters", "overlays", "ai"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-3 text-xs font-medium capitalize transition-colors",
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Annotations tab */}
          {activeTab === "annotations" && (
            <div className="space-y-2">
              {annotations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a draw tool and drag on the video to add annotations.
                </p>
              ) : (
                annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: ann.color ?? "#ef4444" }}
                      />
                      <span className="capitalize">{ann.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatMs(ann.startTime)}</span>
                      <button
                        onClick={() => setAnnotations((prev) => prev.filter((a) => a.id !== ann.id))}
                        className="hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chapters tab */}
          {activeTab === "chapters" && (
            <div className="space-y-2">
              <button
                onClick={handleAddChapter}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:text-primary text-sm text-muted-foreground transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Add chapter at {formatMs(currentTimeMs)}
              </button>
              {chapters.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between p-2 rounded-lg border border-border text-sm">
                  <div>
                    <p className="font-medium">{ch.title}</p>
                    <p className="text-xs text-muted-foreground">{formatMs(ch.startTime)}</p>
                  </div>
                  <button
                    onClick={() => setChapters((prev) => prev.filter((c) => c.id !== ch.id))}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Overlays tab */}
          {activeTab === "overlays" && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Overlay editor coming soon — lower thirds, logos, and CTAs.
            </p>
          )}

          {/* AI tab */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              <button
                onClick={handleAutoEdit}
                disabled={autoEditMut.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {autoEditMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Auto-Edit with AI
              </button>

              {recording.aiSummary && (
                <div className="p-3 rounded-lg bg-secondary text-sm space-y-1">
                  <p className="font-medium text-xs uppercase text-muted-foreground tracking-wider">Summary</p>
                  <p>{recording.aiSummary}</p>
                </div>
              )}

              {autoEditMut.data?.suggestions && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Suggestions ({autoEditMut.data.suggestions.length})
                  </p>
                  {(autoEditMut.data.suggestions as Array<{ type: string; startTime: number; endTime?: number; label: string; reason: string }>).map((s, i) => (
                    <div key={i} className="p-2.5 rounded-lg border border-border text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          s.type === "cut" ? "bg-red-100 text-red-700" :
                          s.type === "chapter" ? "bg-yellow-100 text-yellow-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {s.type}
                        </span>
                        <button
                          onClick={() => seek(s.startTime)}
                          className="text-primary hover:underline"
                        >
                          {formatMs(s.startTime)}
                        </button>
                      </div>
                      <p className="font-medium">{s.label}</p>
                      <p className="text-muted-foreground">{s.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
