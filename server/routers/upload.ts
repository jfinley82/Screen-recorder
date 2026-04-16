import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { createMuxDirectUpload } from "../mux.js";
import type { Context } from "../context.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const uploadRouter = router({
  /**
   * Returns a Mux Direct Upload URL.
   * The browser PUT-uploads the video blob straight to this URL — no AWS needed.
   */
  createMuxUpload: protectedProcedure.mutation(async () => {
    return createMuxDirectUpload();
  }),
});
