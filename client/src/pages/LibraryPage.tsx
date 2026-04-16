import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Loader2, Play, Edit2, Trash2, Share2, Clock, Copy, Check } from "lucide-react";
import { formatSec, cn } from "@/lib/utils";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { data: recordings, isLoading, refetch } = trpc.recordings.list.useQuery();
  const deleteRec = trpc.recordings.delete.useMutation({ onSuccess: () => refetch() });
  const updateSharing = trpc.recordings.updateSharing.useMutation({ onSuccess: () => refetch() });
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopyLink = (rec: { id: number; shareToken: string | null }) => {
    const url = `${window.location.origin}/v/${rec.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTogglePublic = (rec: { id: number; isPublic: boolean }) => {
    updateSharing.mutate({ id: rec.id, isPublic: !rec.isPublic });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recordings?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <Play className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No recordings yet</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Head to the Record tab to make your first recording.
          </p>
        </div>
        <button
          onClick={() => navigate("/record")}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Start Recording
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Library</h1>
        <span className="text-sm text-muted-foreground">{recordings.length} recording{recordings.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {recordings.map((rec) => (
          <div
            key={rec.id}
            className="group rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
          >
            {/* Thumbnail */}
            <div
              className="relative aspect-video bg-secondary cursor-pointer"
              onClick={() => rec.status === "ready" && rec.shareToken && navigate(`/v/${rec.shareToken}`)}
            >
              {rec.muxPlaybackId ? (
                <img
                  src={`https://image.mux.com/${rec.muxPlaybackId}/thumbnail.jpg?time=1`}
                  alt={rec.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : null}

              {/* Status overlay */}
              {rec.status !== "ready" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  {rec.status === "processing" || rec.status === "uploading" ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <span className="text-white text-xs bg-red-500 px-2 py-1 rounded">Error</span>
                  )}
                </div>
              )}

              {/* Play overlay on hover */}
              {rec.status === "ready" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-current" />
                </div>
              )}

              {/* Duration badge */}
              {rec.duration && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  <Clock className="w-3 h-3" />
                  {formatSec(rec.duration)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="font-medium text-sm truncate" title={rec.title}>{rec.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(rec.createdAt).toLocaleDateString()} · {rec.viewCount} view{rec.viewCount !== 1 ? "s" : ""}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-3">
                <button
                  onClick={() => navigate(`/editor/${rec.id}`)}
                  title="Edit"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>

                <button
                  onClick={() => handleCopyLink(rec)}
                  title="Copy share link"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs transition-colors",
                    copiedId === rec.id
                      ? "text-green-600 bg-green-50"
                      : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {copiedId === rec.id ? (
                    <><Check className="w-3.5 h-3.5" /> Copied</>
                  ) : (
                    <><Share2 className="w-3.5 h-3.5" /> Share</>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (confirm("Delete this recording?")) deleteRec.mutate({ id: rec.id });
                  }}
                  title="Delete"
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Public toggle */}
              <button
                onClick={() => handleTogglePublic(rec)}
                className={cn(
                  "w-full mt-2 py-1 rounded-md text-xs font-medium transition-colors",
                  rec.isPublic
                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                    : "bg-secondary text-muted-foreground hover:bg-border"
                )}
              >
                {rec.isPublic ? "Public — click to make private" : "Private — click to share publicly"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
