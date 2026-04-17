import { useParams } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { VideoPlayer } from "@/components/viewer/VideoPlayer";
import { TranscriptPanel } from "@/components/viewer/TranscriptPanel";
import {
  Loader2, Video, Eye, Download, Camera, Twitter, Linkedin,
  MessageSquare, Send,
} from "lucide-react";
import type { Annotation, Chapter, TranscriptSegment } from "~/types";
import { formatSec } from "@/lib/utils";
import { fetchAndParseVTT } from "@/lib/vtt";

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [seekFn, setSeekFn] = useState<((ms: number) => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Comment form state
  const [commentName, setCommentName] = useState("");
  const [commentEmail, setCommentEmail] = useState("");
  const [commentMsg, setCommentMsg] = useState("");
  const [commentSubmitted, setCommentSubmitted] = useState(false);

  const viewIdRef = useRef<number | null>(null);
  const watchSecondsRef = useRef(0);

  const trackView = trpc.views.trackView.useMutation({
    onSuccess: (data) => {
      if (data.viewId) viewIdRef.current = data.viewId;
    },
  });
  const updateView = trpc.views.updateView.useMutation();

  const { data: recording, isLoading } = trpc.recordings.getByToken.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  const { data: comments, refetch: refetchComments } = trpc.comments.list.useQuery(
    { shareToken: token! },
    { enabled: !!token }
  );

  const addComment = trpc.comments.add.useMutation({
    onSuccess: () => {
      setCommentMsg("");
      setCommentSubmitted(true);
      refetchComments();
      setTimeout(() => setCommentSubmitted(false), 3000);
    },
  });

  // Track view on load
  useEffect(() => {
    if (!token || !recording?.isPublic) return;
    trackView.mutate({ shareToken: token });
  }, [token, recording?.id]);

  // Heartbeat every 15s while video is playing
  useEffect(() => {
    if (!recording) return;
    const durationSec = recording.duration ?? 1;
    const interval = setInterval(() => {
      if (viewIdRef.current == null) return;
      const secs = Math.round(currentTimeMs / 1000);
      watchSecondsRef.current = Math.max(watchSecondsRef.current, secs);
      const pct = Math.min(100, Math.round((secs / durationSec) * 100));
      updateView.mutate({ viewId: viewIdRef.current, watchSeconds: watchSecondsRef.current, percentWatched: pct });
    }, 15_000);
    return () => clearInterval(interval);
  }, [recording?.id, currentTimeMs]);

  useEffect(() => {
    if (!recording?.muxPlaybackId || !recording.muxCaptionTrackId) return;
    const url = `https://stream.mux.com/${recording.muxPlaybackId}/text/${recording.muxCaptionTrackId}.vtt`;
    fetchAndParseVTT(url).then(setTranscript).catch(() => {});
  }, [recording?.muxPlaybackId, recording?.muxCaptionTrackId]);

  const handleSeek = useCallback((ms: number) => { seekFn?.(ms); }, [seekFn]);

  const handleDownload = () => {
    if (!recording?.muxPlaybackId) return;
    const a = document.createElement("a");
    a.href = `https://stream.mux.com/${recording.muxPlaybackId}/capped-1080p.mp4`;
    a.download = `${recording.title}.mp4`;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  const handleScreenshot = () => {
    const vid = document.querySelector<HTMLVideoElement>("video");
    if (!vid) return;
    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    canvas.getContext("2d")!.drawImage(vid, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${recording?.title ?? "screenshot"}.png`;
    a.click();
  };

  const pageUrl = encodeURIComponent(window.location.href);
  const pageTitle = encodeURIComponent(recording?.title ?? "");

  const handleShareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}`,
      "_blank", "noopener,noreferrer,width=600,height=400"
    );
  };

  const handleShareLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`,
      "_blank", "noopener,noreferrer,width=600,height=500"
    );
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !commentName.trim() || !commentMsg.trim()) return;
    addComment.mutate({
      shareToken: token,
      name: commentName.trim(),
      email: commentEmail.trim() || undefined,
      message: commentMsg.trim(),
      timestampMs: currentTimeMs > 0 ? currentTimeMs : undefined,
    });
  };

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
        <div className="flex items-center gap-3">
          {/* Social sharing */}
          <button
            onClick={handleShareTwitter}
            title="Share on X / Twitter"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Twitter className="w-4 h-4" />
          </button>
          <button
            onClick={handleShareLinkedIn}
            title="Share on LinkedIn"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Linkedin className="w-4 h-4" />
          </button>
          {/* Screenshot */}
          <button
            onClick={handleScreenshot}
            title="Screenshot current frame"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          {/* Download */}
          <button
            onClick={handleDownload}
            title="Download video"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-l border-border pl-3">
            <Eye className="w-3.5 h-3.5" />
            {recording.viewCount} views
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">{recording.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatSec(recording.duration ?? 0)} · {new Date(recording.createdAt).toLocaleDateString()}
          </p>
        </div>

        {recording.aiSummary && (
          <div className="p-4 rounded-xl bg-secondary text-sm">
            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Summary
            </p>
            <p>{recording.aiSummary}</p>
          </div>
        )}

        <VideoPlayer
          playbackId={recording.muxPlaybackId!}
          annotations={(recording.annotations as Annotation[]) ?? []}
          chapters={(recording.chapters as Chapter[]) ?? []}
          trimStart={recording.trimStart ?? 0}
          trimEnd={trimEnd}
          currentTimeMs={currentTimeMs}
          onTimeUpdate={setCurrentTimeMs}
          onSeekReady={(fn) => setSeekFn(() => fn)}
        />

        {/* Transcript panel */}
        {recording.transcriptStatus === "ready" && (
          <TranscriptPanel
            segments={transcript}
            currentTimeMs={currentTimeMs}
            onSeek={handleSeek}
          />
        )}

        {/* Comments section */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Comments
            </p>
            {comments && comments.length > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">{comments.length}</span>
            )}
          </div>

          {/* Existing comments */}
          {comments && comments.length > 0 && (
            <div className="divide-y divide-border">
              {comments.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {c.timestampMs != null && (
                        <button
                          onClick={() => handleSeek(c.timestampMs!)}
                          className="hover:text-primary transition-colors font-mono"
                        >
                          {formatSec(Math.floor(c.timestampMs / 1000))}
                        </button>
                      )}
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{c.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment form */}
          <div className="p-4 bg-secondary/30">
            {commentSubmitted ? (
              <p className="text-sm text-green-600 text-center py-2">Thanks for your comment!</p>
            ) : (
              <form onSubmit={handleSubmitComment} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    placeholder="Your name *"
                    value={commentName}
                    onChange={(e) => setCommentName(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={commentEmail}
                    onChange={(e) => setCommentEmail(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                  />
                </div>
                <textarea
                  required
                  placeholder="Leave a comment… (will be timestamped at current video position)"
                  value={commentMsg}
                  onChange={(e) => setCommentMsg(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addComment.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {addComment.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Post Comment
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
