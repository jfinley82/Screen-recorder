import { video } from "./mux.js";
import { db } from "./db.js";
import { recordings } from "../drizzle/schema.js";
import { ne, and, isNotNull, eq } from "drizzle-orm";

export async function repairStuckRecordings() {
  try {
    const stuck = await db.select().from(recordings)
      .where(and(ne(recordings.status, "ready"), isNotNull(recordings.muxUploadId)));

    if (!stuck.length) { console.log("[repair-mux] Nothing to fix"); return; }
    console.log(`[repair-mux] Syncing ${stuck.length} stuck recordings...`);

    for (const rec of stuck) {
      try {
        const upload = await video.uploads.retrieve(rec.muxUploadId!);
        if (!upload.asset_id) continue;
        const asset = await video.assets.retrieve(upload.asset_id);
        const playbackId = asset.playback_ids?.find((p: { policy: string }) => p.policy === "public")?.id;
        if (asset.status === "ready" && playbackId) {
          await db.update(recordings).set({
            status: "ready", muxAssetId: <asset.id>, muxPlaybackId: playbackId,
            duration: Math.round(asset.duration ?? 0),
          }).where(eq(<recordings.id>, <rec.id>));
          console.log(`[repair-mux] Fixed: "${rec.title}"`);
        } else if (asset.status === "errored") {
          await db.update(recordings).set({ status: "error", muxAssetId: <asset.id> })
            .where(eq(<recordings.id>, <rec.id>));
        }
      } catch (e) { console.error(`[repair-mux] Error for recording ${<rec.id>}:`, e); }
    }
    console.log("[repair-mux] Done");
  } catch (e) { console.error("[repair-mux] Failed:", e); }
}
