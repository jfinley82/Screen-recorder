import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context.js";
import { authRouter } from "./routers/auth.js";
import { recordingsRouter } from "./routers/recordings.js";
import { uploadRouter } from "./routers/upload.js";
import { aiRouter } from "./routers/ai.js";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const appRouter = t.router({
  auth: authRouter,
  recordings: recordingsRouter,
  upload: uploadRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
