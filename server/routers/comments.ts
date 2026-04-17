import { initTRPC } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db } from "../db.js";
import { comments, recordings, users } from "../../drizzle/schema.js";
import { eq, desc } from "drizzle-orm";
import type { Context } from "../context.js";
import { sendCommentNotification } from "../email.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;

export const commentsRouter = router({
  /** List comments for a recording by share token (public) */
  list: t.procedure
    .input(z.object({ shareToken: z.string() }))
    .query(async ({ input }) => {
      const [rec] = await db
        .select({ id: recordings.id })
        .from(recordings)
        .where(eq(recordings.shareToken, input.shareToken))
        .limit(1);
      if (!rec) return [];

      return db
        .select()
        .from(comments)
        .where(eq(comments.recordingId, rec.id))
        .orderBy(desc(comments.createdAt))
        .limit(100);
    }),

  /** Add a comment to a public recording */
  add: t.procedure
    .input(
      z.object({
        shareToken: z.string(),
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        message: z.string().min(1).max(2000),
        timestampMs: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [rec] = await db
        .select({ id: recordings.id, isPublic: recordings.isPublic, userId: recordings.userId, title: recordings.title, shareToken: recordings.shareToken })
        .from(recordings)
        .where(eq(recordings.shareToken, input.shareToken))
        .limit(1);

      if (!rec?.isPublic) throw new Error("Recording not found or not public");

      await db.insert(comments).values({
        recordingId: rec.id,
        name: input.name,
        email: input.email,
        message: input.message,
        timestampMs: input.timestampMs,
      });

      // Email coach about new comment
      if (process.env.RESEND_API_KEY) {
        const [owner] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, rec.userId))
          .limit(1);

        if (owner) {
          sendCommentNotification({
            coachEmail: owner.email,
            coachName: owner.name,
            recordingTitle: rec.title,
            shareToken: rec.shareToken!,
            commenterName: input.name,
            message: input.message,
          }).catch(console.error);
        }
      }

      return { ok: true };
    }),
});
