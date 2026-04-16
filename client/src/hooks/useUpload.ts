import { useState, useCallback } from "react";
import { trpc } from "../lib/trpc";

export type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export interface UseUploadReturn {
  uploadState: UploadState;
  progress: number; // 0–100
  recordingId: number | null;
  uploadError: string | null;
  upload: (blob: Blob, title?: string) => Promise<number | null>;
}

export function useUpload(): UseUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const createMuxUpload = trpc.upload.createMuxUpload.useMutation();
  const createRecording = trpc.recordings.create.useMutation();
  const syncUpload = trpc.recordings.syncUpload.useMutation();

  const upload = useCallback(
    async (blob: Blob, title = "Untitled Recording"): Promise<number | null> => {
      setUploadState("uploading");
      setProgress(0);
      setUploadError(null);

      try {
        // Step 1 — get a Mux Direct Upload URL
        const { uploadId, uploadUrl } = await createMuxUpload.mutateAsync();

        // Step 2 — upload the blob directly to Mux (with progress)
        await uploadToMux(uploadUrl, blob, (pct) =>
          setProgress(Math.round(pct * 85))
        );

        setProgress(85);
        setUploadState("processing");

        // Step 3 — create the recording row immediately (status: uploading)
        const rec = await createRecording.mutateAsync({ title, muxUploadId: uploadId });

        setProgress(90);

        // Step 4 — poll until Mux links the upload to an asset ID (usually <5s)
        await pollSyncUpload(rec.id, syncUpload.mutateAsync);

        setProgress(100);
        setUploadState("done");
        setRecordingId(rec.id);
        return rec.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploadError(msg);
        setUploadState("error");
        return null;
      }
    },
    [createMuxUpload, createRecording, syncUpload]
  );

  return { uploadState, progress, recordingId, uploadError, upload };
}

/** PUT the blob directly to the Mux upload URL */
function uploadToMux(
  url: string,
  blob: Blob,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Mux expects no Content-Type header for direct uploads
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Mux upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });
}

/** Poll syncUpload until Mux has assigned an asset ID (max ~30s) */
async function pollSyncUpload(
  id: number,
  syncFn: (input: { id: number }) => Promise<{ muxAssetId: string | null } | null | undefined>
): Promise<void> {
  const MAX_ATTEMPTS = 15;
  const DELAY_MS = 2000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const rec = await syncFn({ id });
    if (rec?.muxAssetId) return;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  // Don't throw — the webhook will update the DB asynchronously as a fallback
}
