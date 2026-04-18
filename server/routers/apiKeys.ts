import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db } from "../db.js";
import { apiKeys } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import type { Context } from "../context.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.userId));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const raw = `sc_${randomBytes(24).toString("hex")}`;
      const keyHash = createHash("sha256").update(raw).digest("hex");
      const keyPrefix = raw.slice(0, 10);

      await db.insert(apiKeys).values({
        userId: ctx.userId,
        name: input.name,
        keyHash,
        keyPrefix,
      });

      return { key: raw };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.userId)));
    }),
});
