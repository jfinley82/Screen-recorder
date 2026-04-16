import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db } from "../db.js";
import { recordings } from "../../drizzle/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getMuxAsset, video } from "../mux.js";
import type { Context } from "../context.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;

/** Requires a valid session cookie — ctx.userId is narrowed to number */
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Throws NOT_FOUND / FORBIDDEN if the recording isn't owned by userId */
async function assertOwner(id: number, userId: number) {
  const [rec] = await db
    .select({ id: recordings.id, userId: recordings.userId })
    .from(recordings)
    .where(eq(recordings.id, id))
    .limit(1);
  if (!rec) throw new TRPCError({ code: "NOT_FOUND" });
  if (rec.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  return rec;
}

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
  /** List recordings belonging to the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(recordings)
      .where(eq(recordings.userId, ctx.userId))
      .orderBy(desc(recordings.createdAt))
      .limit(100);
  }),

  /** Get a single recording (must belong to current user) */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const [rec] = await db
        .select()
        .from(recordings)
        .where(and(eq(recordings.id, input.id), eq(recordings.userId, ctx.userId)))
        .limit(1);
      return rec ?? null;
    }),

  /** Get by share token — public, no auth required */
  getByToken: t.procedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const [rec] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.shareToken, input.token))
        .limit(1);
      if (!rec) return null;

      await db
        .update(recordings)
        .set({ viewCount: (rec.viewCount ?? 0) + 1 })
        .where(eq(recordings.id, rec.id));

      return rec;
    }),

  /** Create a recording record after the browser has finished uploading */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        s3Key: z.string(),
        s3Bucket: z.string(),
        muxAssetId: z.string(),
        muxPlaybackId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [result] = await db.insert(recordings).values({
        userId: ctx.userId,
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
  updateTitle: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      await assertOwner(input.id, ctx.userId);
      await db
        .update(recordings)
        .set({ title: input.title })
        .where(eq(recordings.id, input.id));
    }),

  /** Save editor state */
  saveEdits: protectedProcedure
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
    .mutation(async ({ input, ctx }) => {
      await assertOwner(input.id, ctx.userId);
      const { id, ...updates } = input;
      await db
        .update(recordings)
        .set(updates as Record<string, unknown>)
        .where(eq(recordings.id, id));
    }),

  /** Toggle public sharing */
  updateSharing: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isPublic: z.boolean(),
        password: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertOwner(input.id, ctx.userId);
      await db
        .update(recordings)
        .set({ isPublic: input.isPublic, password: input.password ?? null })
        .where(eq(recordings.id, input.id));
    }),

  /** Poll Mux until asset is ready */
  syncStatus: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertOwner(input.id, ctx.userId);

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

        // Also pick up the caption track ID if available
        const captionTrack = asset.tracks?.find(
          (tr) => tr.type === "text" && (tr as { text_type?: string }).text_type === "subtitles"
        );

        await db
          .update(recordings)
          .set({
            status: "ready",
            muxPlaybackId: playbackId ?? undefined,
            duration: Math.round(asset.duration ?? 0),
            muxCaptionTrackId: captionTrack?.id ?? undefined,
            transcriptStatus: captionTrack ? "ready" : "none",
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

  /**
   * Return the public Mux VTT URL for auto-generated captions.
   * The client fetches this URL directly and parses the VTT.
   */
  getTranscriptUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const [rec] = await db
        .select()
        .from(recordings)
        .where(and(eq(recordings.id, input.id), eq(recordings.userId, ctx.userId)))
        .limit(1);

      if (!rec?.muxPlaybackId || !rec.muxCaptionTrackId) return null;

      return `https://stream.mux.com/${rec.muxPlaybackId}/text/${rec.muxCaptionTrackId}.vtt`;
    }),

  /** Delete a recording */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertOwner(input.id, ctx.userId);
      await db.delete(recordings).where(eq(recordings.id, input.id));
    }),
});
