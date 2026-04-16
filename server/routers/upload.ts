import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { createPresignedUploadUrl, createPresignedReadUrl, BUCKET } from "../s3.js";
import { createMuxAssetFromS3 } from "../mux.js";
import type { Context } from "../context.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const uploadRouter = router({
  /**
   * Step 1 — get a presigned URL so the browser can upload directly to S3.
   * Returns the S3 key and presigned PUT URL.
   */
  presign: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return createPresignedUploadUrl({
        filename: input.filename,
        contentType: input.contentType,
      });
    }),

  /**
   * Step 2 — after the browser has uploaded the file to S3,
   * call this to ingest it into Mux.
   * Returns the Mux asset ID and (eventual) playback ID.
   */
  ingestToMux: protectedProcedure
    .input(
      z.object({
        s3Key: z.string(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Create a short-lived presigned read URL for Mux to fetch the file
      const readUrl = await createPresignedReadUrl(input.s3Key, 900);

      const { assetId, playbackId } = await createMuxAssetFromS3(readUrl, {
        title: input.title,
      });

      return { assetId, playbackId, s3Bucket: BUCKET };
    }),
});
