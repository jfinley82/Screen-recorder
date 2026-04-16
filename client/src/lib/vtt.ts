import type { TranscriptSegment } from "~/types";
import { randomUUID } from "./uuid";

/**
 * Parse a WebVTT string into TranscriptSegment[].
 *
 * VTT format:
 *   WEBVTT
 *
 *   00:00:01.000 --> 00:00:04.000
 *   Hello and welcome.
 *
 *   00:00:04.500 --> 00:00:07.000
 *   Today we will cover...
 */
export function parseVTT(vttText: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  // Split into cue blocks (separated by blank lines)
  const blocks = vttText.split(/\n\s*\n/).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (!lines.length) continue;

    // Skip the WEBVTT header block and NOTE/STYLE/REGION blocks
    if (
      lines[0].startsWith("WEBVTT") ||
      lines[0].startsWith("NOTE") ||
      lines[0].startsWith("STYLE") ||
      lines[0].startsWith("REGION")
    ) {
      continue;
    }

    // Find the timestamp line (may be preceded by a cue ID)
    let timeLine = "";
    let textStartIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLine = lines[i];
        textStartIdx = i + 1;
        break;
      }
    }
    if (!timeLine) continue;

    const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim().split(" ")[0]);
    const startTime = vttTimeToMs(startStr);
    const endTime = vttTimeToMs(endStr);
    if (startTime === null || endTime === null) continue;

    const text = lines
      .slice(textStartIdx)
      .join(" ")
      .replace(/<[^>]+>/g, "") // strip inline tags like <c>, <b>, timestamps
      .trim();

    if (!text) continue;

    segments.push({ id: randomUUID(), text, startTime, endTime });
  }

  return segments;
}

/** Convert VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to milliseconds */
function vttTimeToMs(ts: string): number | null {
  if (!ts) return null;
  const parts = ts.split(":");
  let hours = 0, minutes = 0, seconds = 0;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    seconds = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    seconds = parseFloat(parts[1]);
  } else {
    return null;
  }

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

/**
 * Fetch a VTT file from a URL and return parsed segments.
 * Handles CORS — Mux serves VTT with proper CORS headers for public playback IDs.
 */
export async function fetchAndParseVTT(url: string): Promise<TranscriptSegment[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch transcript: ${res.status}`);
  const text = await res.text();
  return parseVTT(text);
}
