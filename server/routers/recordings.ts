import { initTRPC } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db } from "../db.js";
import { recordings } from "../../drizzle/schema.js";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getMuxAsset } from "../mux.js";

const t = initTRPC.context<Record<string, never>>().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;

const AnnotationSchema = z.object({
  id: z.string(),
  type: z.enum(["arrow", "text", "highlight", "blur", "circle", "rectangle"]),
  startTime: z.number(),
  endTime: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  angle: z.number().optional(),
  color: z.string().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
});

const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.number(),
});

const OverlaySchema = z.object({
  id: z.string(),
  type: z.enum(["lower-third", "logo", "cta", "zoom"]),
  startTime: z.number(),
  endTime: z.number(),
  content: z.string().optional(),
  subtitle: z.string().optional(),
  imageUrl: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  zoomX: z.number().optional(),
  zoomY: z.number().optional(),
  zoomScale: z.number().optional(),
});

export const recordingsRouter = router({
  /** List all recordings (most recent first) */
  list: publicProcedure.query(async () => {
    return db
      .select()
      .from(recordings)
      .orderBy(desc(recordings.createdAt))
      .limit(100);
  }),

  /** Get a single recording by ID */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [rec] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, input.id))
        .limit(1);
      return rec ?? null;
    }),

  /** Get a recording by share token (public) */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const [rec] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.shareToken, input.token))
        .limit(1);
      if (!rec) return null;

      // Increment view count
      await db
        .update(recordings)
        .set({ viewCount: (rec.viewCount ?? 0) + 1 })
        .where(eq(recordings.id, rec.id));

      return rec;
    }),

  /** Create a new recording record (called after upload starts) */
  create: publicProcedure
    .input(
      z.object({
        title: z.string().optional(),
        s3Key: z.string(),
        s3Bucket: z.string(),
        muxAssetId: z.string(),
        muxPlaybackId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [result] = await db.insert(recordings).values({
        title: input.title ?? "Untitled Recording",
        status: "processing",
        s3Key: input.s3Key,
        s3Bucket: input.s3Bucket,
        muxAssetId: input.muxAssetId,
        muxPlaybackId: input.muxPlaybackId,
        shareToken: randomUUID().replace(/-/g, ""),
      });

      const [rec] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, result.insertId))
        .limit(1);
      return rec;
    }),

  /** Update title */
  updateTitle: publicProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      await db
        .update(recordings)
        .set({ title: input.title })
        .where(eq(recordings.id, input.id));
    }),

  /** Save editor state (trim, annotations, chapters, overlays) */
  saveEdits: publicProcedure
    .input(
      z.object({
        id: z.number(),
        trimStart: z.number().optional(),
        trimEnd: z.number().nullable().optional(),
        annotations: z.array(AnnotationSchema).optional(),
        chapters: z.array(ChapterSchema).optional(),
        overlays: z.array(OverlaySchema).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db
        .update(recordings)
        .set(updates as Record<string, unknown>)
        .where(eq(recordings.id, id));
    }),

  /** Toggle public sharing */
  updateSharing: publicProcedure
    .input(
      z.object({
        id: z.number(),
        isPublic: z.boolean(),
        password: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(recordings)
        .set({ isPublic: input.isPublic, password: input.password ?? null })
        .where(eq(recordings.id, input.id));
    }),

  /** Poll Mux until asset is ready, then sync status */
  syncStatus: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [rec] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, input.id))
        .limit(1);
      if (!rec?.muxAssetId) return rec;

      const asset = await getMuxAsset(rec.muxAssetId);

      if (asset.status === "ready") {
        const playbackId =
          asset.playback_ids?.find((p) => p.policy === "public")?.id ?? rec.muxPlaybackId;
        await db
          .update(recordings)
          .set({
            status: "ready",
            muxPlaybackId: playbackId ?? undefined,
            duration: Math.round(asset.duration ?? 0),
          })
          .where(eq(recordings.id, input.id));
      } else if (asset.status === "errored") {
        await db
          .update(recordings)
          .set({ status: "error" })
          .where(eq(recordings.id, input.id));
      }

      const [updated] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, input.id))
        .limit(1);
      return updated;
    }),

  /** Delete a recording */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(recordings).where(eq(recordings.id, input.id));
    }),
});
