import { initTRPC } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db } from "../db.js";
import { comments, recordings } from "../../drizzle/schema.js";
import { eq, desc } from "drizzle-orm";
import type { Context } from "../context.js";

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
        .select({ id: recordings.id, isPublic: recordings.isPublic })
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

      return { ok: true };
    }),
});
