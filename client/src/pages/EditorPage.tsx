import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { VideoEditor } from "@/components/editor/VideoEditor";
import { Loader2, ArrowLeft } from "lucide-react";
import type { Recording } from "~/types";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recordingId = parseInt(id ?? "0", 10);

  const { data: recording, isLoading, refetch } = trpc.recordings.get.useQuery(
    { id: recordingId },
    { enabled: !!recordingId, refetchInterval: (data) => data?.status === "processing" ? 3000 : false }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Recording not found.</p>
        <button onClick={() => navigate("/library")} className="text-sm text-primary hover:underline">
          Back to library
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <button
          onClick={() => navigate("/library")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Library
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{recording.title}</span>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <VideoEditor
          recording={recording as unknown as Recording}
          onSaved={refetch}
        />
      </div>
    </div>
  );
}
