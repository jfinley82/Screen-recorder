// ── Shared types used by both client and server ──────────────────────────────

export type RecordingStatus = "uploading" | "processing" | "ready" | "error";
export type TranscriptStatus = "none" | "processing" | "ready";

export type AnnotationType = "arrow" | "text" | "highlight" | "blur" | "circle" | "rectangle";

export interface Annotation {
  id: string;
  type: AnnotationType;
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds */
  endTime: number;
  /** Position as percentage of video dimensions (0–100) */
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Rotation angle in degrees */
  angle?: number;
  color?: string;
  text?: string;
  fontSize?: number;
}

export interface Chapter {
  id: string;
  title: string;
  /** Start time in milliseconds */
  startTime: number;
}

export type OverlayType = "lower-third" | "logo" | "cta" | "zoom";

export interface Overlay {
  id: string;
  type: OverlayType;
  startTime: number;
  endTime: number;
  /** Text content for lower-third / cta */
  content?: string;
  subtitle?: string;
  imageUrl?: string;
  /** Position as % of video dimensions */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Zoom effect: region to zoom into as % of video */
  zoomX?: number;
  zoomY?: number;
  zoomScale?: number;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface AiSuggestion {
  type: "cut" | "chapter" | "filler";
  startTime: number;
  endTime?: number;
  label: string;
  reason: string;
}

export interface Recording {
  id: number;
  title: string;
  status: RecordingStatus;
  s3Key: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  trimStart: number;
  trimEnd: number | null;
  annotations: Annotation[];
  chapters: Chapter[];
  overlays: Overlay[];
  shareToken: string | null;
  isPublic: boolean;
  viewCount: number;
  transcriptStatus: TranscriptStatus;
  transcript: TranscriptSegment[] | null;
  aiSummary: string | null;
  aiSuggestions: AiSuggestion[] | null;
  createdAt: string;
  updatedAt: string;
}

// ── Size presets ──────────────────────────────────────────────────────────────

export interface SizePreset {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
  aspectRatio: string;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: "full", label: "Full Screen", description: "Your entire display", width: 1920, height: 1080, aspectRatio: "16/9" },
  { id: "fhd", label: "1080p", description: "1920 × 1080 — FHD 16:9", width: 1920, height: 1080, aspectRatio: "16/9" },
  { id: "hd", label: "720p", description: "1280 × 720 — HD 16:9", width: 1280, height: 720, aspectRatio: "16/9" },
  { id: "square", label: "Square", description: "1080 × 1080 — 1:1", width: 1080, height: 1080, aspectRatio: "1/1" },
  { id: "vertical", label: "Vertical", description: "1080 × 1920 — 9:16 (Stories/Reels)", width: 1080, height: 1920, aspectRatio: "9/16" },
  { id: "macbook", label: "MacBook", description: "1440 × 900 — 16:10", width: 1440, height: 900, aspectRatio: "16/10" },
];

export type WebcamPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type WebcamSize = "sm" | "md" | "lg";
export type WebcamShape = "circle" | "rounded";
