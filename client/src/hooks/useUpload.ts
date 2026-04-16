import { useState, useCallback } from "react";
import { trpc } from "../lib/trpc";

export type UploadState = "idle" | "uploading" | "ingesting" | "polling" | "done" | "error";

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

  const presign = trpc.upload.presign.useMutation();
  const ingestToMux = trpc.upload.ingestToMux.useMutation();
  const createRecording = trpc.recordings.create.useMutation();

  const upload = useCallback(
    async (blob: Blob, title = "Untitled Recording"): Promise<number | null> => {
      setUploadState("uploading");
      setProgress(0);
      setUploadError(null);

      try {
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        const filename = `recording.${ext}`;

        // Step 1: Get presigned URL
        const { key, uploadUrl, s3Url: _s3Url } = await presign.mutateAsync({
          filename,
          contentType: blob.type || "video/webm",
        });

        // Step 2: Upload directly to S3 with XHR so we can track progress
        await uploadToS3(uploadUrl, blob, (pct) => setProgress(Math.round(pct * 80)));

        setProgress(80);
        setUploadState("ingesting");

        // Step 3: Ingest into Mux
        const { assetId, playbackId, s3Bucket } = await ingestToMux.mutateAsync({
          s3Key: key,
          title,
        });

        setProgress(90);

        // Step 4: Create the recording record in our DB
        const rec = await createRecording.mutateAsync({
          title,
          s3Key: key,
          s3Bucket,
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
        });

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
    [presign, ingestToMux, createRecording]
  );

  return { uploadState, progress, recordingId, uploadError, upload };
}

function uploadToS3(
  url: string,
  blob: Blob,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type || "video/webm");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });
}
