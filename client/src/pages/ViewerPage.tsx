import { useParams } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { VideoPlayer } from "@/components/viewer/VideoPlayer";
import { Loader2, Video, Eye } from "lucide-react";
import type { Annotation, Chapter, TranscriptSegment } from "~/types";
import { formatSec } from "@/lib/utils";

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();
  const { data: recording, isLoading } = trpc.recordings.getByToken.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recording || !recording.isPublic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <Video className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Recording not available</h1>
          <p className="text-muted-foreground text-sm mt-1">
            This recording is private or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  if (recording.status !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">This recording is still processing…</p>
      </div>
    );
  }

  const durationMs = (recording.duration ?? 0) * 1000;
  const trimEnd = recording.trimEnd ?? durationMs;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm">Screen Recorder</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="w-3.5 h-3.5" />
          {recording.viewCount} views
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{recording.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatSec(recording.duration ?? 0)} · {new Date(recording.createdAt).toLocaleDateString()}
          </p>
        </div>

        {recording.aiSummary && (
          <div className="p-4 rounded-xl bg-secondary text-sm">
            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1">Summary</p>
            <p>{recording.aiSummary}</p>
          </div>
        )}

        <VideoPlayer
          playbackId={recording.muxPlaybackId!}
          annotations={(recording.annotations as Annotation[]) ?? []}
          chapters={(recording.chapters as Chapter[]) ?? []}
          trimStart={recording.trimStart ?? 0}
          trimEnd={trimEnd}
          transcript={(recording.transcript as TranscriptSegment[]) ?? []}
        />
      </main>
    </div>
  );
}
