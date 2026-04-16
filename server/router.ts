import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { recordingsRouter } from "./routers/recordings.js";
import { uploadRouter } from "./routers/upload.js";
import { aiRouter } from "./routers/ai.js";

const t = initTRPC.context<Record<string, never>>().create({
  transformer: superjson,
});

export const appRouter = t.router({
  recordings: recordingsRouter,
  upload: uploadRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
