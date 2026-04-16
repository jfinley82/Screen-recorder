import type { Request, Response } from "express";
import Mux from "@mux/mux-node";
import { db } from "./db.js";
import { recordings } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const webhookSecret = process.env.MUX_WEBHOOK_SECRET!;

export async function muxWebhookHandler(req: Request, res: Response) {
  try {
    // Verify the webhook signature
    Mux.Webhooks.verifySignature(
      req.body as Buffer,
      req.headers as Record<string, string>,
      webhookSecret
    );
  } catch {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = JSON.parse((req.body as Buffer).toString());
  const { type, data } = event;

  if (type === "video.asset.ready") {
    const assetId: string = data.id;
    const playbackId: string =
      data.playback_ids?.find((p: { policy: string }) => p.policy === "public")?.id ?? "";
    const duration: number = Math.round(data.duration ?? 0);

    await db
      .update(recordings)
      .set({
        status: "ready",
        muxPlaybackId: playbackId,
        duration,
        width: data.max_stored_resolution ? undefined : undefined,
      })
      .where(eq(recordings.muxAssetId, assetId));
  }

  if (type === "video.asset.errored") {
    await db
      .update(recordings)
      .set({ status: "error" })
      .where(eq(recordings.muxAssetId, data.id));
  }

  if (type === "video.asset.track.ready") {
    // Auto-generated subtitles/transcription ready
    if (data.type === "text" && data.text_type === "subtitles") {
      await db
        .update(recordings)
        .set({ transcriptStatus: "ready" })
        .where(eq(recordings.muxAssetId, data.asset_id));
    }
  }

  res.json({ received: true });
}
