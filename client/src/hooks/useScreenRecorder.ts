import { useRef, useState, useCallback } from "react";
import type { SizePreset, WebcamPosition, WebcamSize, WebcamShape } from "~/types";

export type RecordState = "idle" | "recording" | "paused" | "processing" | "done";

export interface RecorderOptions {
  preset: SizePreset;
  webcamEnabled: boolean;
  micEnabled: boolean;
  webcamPosition: WebcamPosition;
  webcamSize: WebcamSize;
  webcamShape: WebcamShape;
}

export interface UseScreenRecorderReturn {
  state: RecordState;
  duration: number; // seconds elapsed
  blob: Blob | null;
  error: string | null;
  start: (opts: RecorderOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  previewRef: React.RefObject<HTMLCanvasElement | null>;
  webcamRef: React.RefObject<HTMLVideoElement | null>;
}

const WEBCAM_SIZE_PX: Record<WebcamSize, number> = {
  sm: 120,
  md: 180,
  lg: 240,
};

const PADDING = 16;

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [state, setState] = useState<RecordState>("idle");
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const webcamRef = useRef<HTMLVideoElement | null>(null);

  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const optsRef = useRef<RecorderOptions | null>(null);

  const drawFrame = useCallback(() => {
    const canvas = previewRef.current;
    const screenVideo = screenVideoRef.current;
    if (!canvas || !screenVideo) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const opts = optsRef.current;
    const w = canvas.width;
    const h = canvas.height;

    // Draw screen
    ctx.drawImage(screenVideo, 0, 0, w, h);

    // Draw webcam bubble if enabled
    if (opts?.webcamEnabled) {
      const webcamVideo = webcamRef.current;
      if (webcamVideo && webcamVideo.readyState >= 2) {
        const bubbleSize = WEBCAM_SIZE_PX[opts.webcamSize];
        const radius = bubbleSize / 2;

        let bx = 0;
        let by = 0;
        const pos = opts.webcamPosition;
        if (pos === "bottom-right") {
          bx = w - bubbleSize - PADDING;
          by = h - bubbleSize - PADDING;
        } else if (pos === "bottom-left") {
          bx = PADDING;
          by = h - bubbleSize - PADDING;
        } else if (pos === "top-right") {
          bx = w - bubbleSize - PADDING;
          by = PADDING;
        } else {
          bx = PADDING;
          by = PADDING;
        }

        ctx.save();
        if (opts.webcamShape === "circle") {
          ctx.beginPath();
          ctx.arc(bx + radius, by + radius, radius, 0, Math.PI * 2);
          ctx.clip();
        } else {
          const rr = 12;
          ctx.beginPath();
          ctx.roundRect(bx, by, bubbleSize, bubbleSize, rr);
          ctx.clip();
        }
        ctx.drawImage(webcamVideo, bx, by, bubbleSize, bubbleSize);
        ctx.restore();

        // Border ring
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 3;
        if (opts.webcamShape === "circle") {
          ctx.beginPath();
          ctx.arc(bx + radius, by + radius, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.roundRect(bx, by, bubbleSize, bubbleSize, 12);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const start = useCallback(async (opts: RecorderOptions) => {
    setError(null);
    optsRef.current = opts;

    try {
      // Capture screen
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: opts.preset.width },
          height: { ideal: opts.preset.height },
          frameRate: { ideal: 30 },
        },
        audio: opts.micEnabled,
      });
      screenStreamRef.current = screenStream;

      // Hidden video element to read screen pixels
      const screenVideo = document.createElement("video");
      screenVideo.srcObject = screenStream;
      screenVideo.muted = true;
      await screenVideo.play();
      screenVideoRef.current = screenVideo;

      // Webcam stream
      let webcamStream: MediaStream | null = null;
      if (opts.webcamEnabled) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          webcamStreamRef.current = webcamStream;
          if (webcamRef.current) {
            webcamRef.current.srcObject = webcamStream;
            webcamRef.current.muted = true;
            await webcamRef.current.play();
          }
        } catch (webcamErr) {
          console.warn("Webcam unavailable, recording without it:", webcamErr);
          // Continue without webcam rather than aborting the recording
          optsRef.current = { ...opts, webcamEnabled: false };
        }
      }

      // Set up canvas
      const canvas = previewRef.current!;
      canvas.width = opts.preset.width;
      canvas.height = opts.preset.height;

      // Start drawing loop
      drawFrame();

      // Capture canvas stream at 30fps
      const canvasStream = canvas.captureStream(30);
      canvasStreamRef.current = canvasStream;

      // Add audio track from screen capture if available
      const audioTracks = screenStream.getAudioTracks();
      audioTracks.forEach((track) => canvasStream.addTrack(track));

      // Set up MediaRecorder
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 4_000_000 });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: mimeType });
        setBlob(recorded);
        setState("done");
        cleanup();
      };

      recorder.start(500); // collect chunks every 500ms
      setState("recording");

      // Timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Handle user stopping screen share via browser UI
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === "recording") {
          stop();
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start recording";
      setError(msg);
      cleanup();
    }
  }, [drawFrame]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      drawFrame();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      setState("recording");
    }
  }, [drawFrame]);

  const stop = useCallback(() => {
    setState("processing");
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      setState("idle");
    }
  }, []);

  const cleanup = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    webcamStreamRef.current = null;
    canvasStreamRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setBlob(null);
    setDuration(0);
    setError(null);
    setState("idle");
    chunksRef.current = [];
  }, [cleanup]);

  return { state, duration, blob, error, start, pause, resume, stop, reset, previewRef, webcamRef };
}

function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}
