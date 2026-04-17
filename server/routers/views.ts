import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { eq, desc, and, gte } from "drizzle-orm";
import type { Context } from "../context.js";
import { db } from "../db.js";
import { videoViews, recordings, users } from "../../drizzle/schema.js";
import { sendViewNotification } from "../email.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const viewsRouter = router({
  /** Called when viewer opens a shared video page */
  trackView: publicProcedure
    .input(z.object({ shareToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [rec] = await db
        .select({
          id: recordings.id,
          userId: recordings.userId,
          title: recordings.title,
          shareToken: recordings.shareToken,
          isPublic: recordings.isPublic,
        })
        .from(recordings)
        .where(eq(recordings.shareToken, input.shareToken))
        .limit(1);

      if (!rec || !rec.isPublic) return { viewId: null };

      const viewerIp =
        (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        ctx.req.socket.remoteAddress ??
        null;

      // Create view record
      const [result] = await db.insert(videoViews).values({
        recordingId: rec.id,
        viewerIp,
        watchSeconds: 0,
        percentWatched: 0,
        emailSent: false,
      });

      // Increment view count
      await db
        .update(recordings)
        .set({ viewCount: db.$count(videoViews, eq(videoViews.recordingId, rec.id)) as any })
        .where(eq(recordings.id, rec.id));

      // Send email notification (async, don't block response)
      // Only if no email sent in last hour for this recording
      if (process.env.RESEND_API_KEY) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        const [recentEmail] = await db
          .select({ id: videoViews.id })
          .from(videoViews)
          .where(
            and(
              eq(videoViews.recordingId, rec.id),
              eq(videoViews.emailSent, true),
              gte(videoViews.createdAt, oneHourAgo)
            )
          )
          .limit(1);

        if (!recentEmail) {
          const [owner] = await db
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, rec.userId))
            .limit(1);

          if (owner) {
            sendViewNotification({
              coachEmail: owner.email,
              coachName: owner.name,
              recordingTitle: rec.title,
              shareToken: rec.shareToken!,
              watchSeconds: 0,
              percentWatched: 0,
            }).catch(console.error);

            // Mark email sent
            await db
              .update(videoViews)
              .set({ emailSent: true })
              .where(eq(videoViews.id, result.insertId));
          }
        }
      }

      return { viewId: result.insertId };
    }),

  /** Heartbeat — update watch progress */
  updateView: publicProcedure
    .input(z.object({
      viewId: z.number(),
      watchSeconds: z.number().int().min(0),
      percentWatched: z.number().int().min(0).max(100),
    }))
    .mutation(async ({ input }) => {
      await db
        .update(videoViews)
        .set({ watchSeconds: input.watchSeconds, percentWatched: input.percentWatched })
        .where(eq(videoViews.id, input.viewId));
      return { ok: true };
    }),

  /** Get analytics for a recording (coach only) */
  getAnalytics: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [rec] = await db
        .select({ userId: recordings.userId, viewCount: recordings.viewCount })
        .from(recordings)
        .where(eq(recordings.id, input.recordingId))
        .limit(1);

      if (!rec || rec.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const views = await db
        .select()
        .from(videoViews)
        .where(eq(videoViews.recordingId, input.recordingId))
        .orderBy(desc(videoViews.createdAt))
        .limit(50);

      const avgPercent =
        views.length > 0
          ? Math.round(views.reduce((s, v) => s + v.percentWatched, 0) / views.length)
          : 0;

      const avgSeconds =
        views.length > 0
          ? Math.round(views.reduce((s, v) => s + v.watchSeconds, 0) / views.length)
          : 0;

      return {
        totalViews: rec.viewCount,
        avgPercentWatched: avgPercent,
        avgWatchSeconds: avgSeconds,
        recentViews: views,
      };
    }),
});
