import { initTRPC } from "@trpc/server";
2	import superjson from "superjson";
3	import type { Context } from "./context.js";
4	import { authRouter } from "./routers/auth.js";
5	import { recordingsRouter } from "./routers/recordings.js";
6	import { uploadRouter } from "./routers/upload.js";
7	import { aiRouter } from "./routers/ai.js";
8	import { commentsRouter } from "./routers/comments.js";
9	import { viewsRouter } from "./routers/views.js";
10 import { apiKeysRouter } from "./routers/apiKeys.js";
11	
12	const t = initTRPC.context<Context>().create({
13	  transformer: superjson,
14	});
15	
16	export const appRouter = t.router({
17	  auth: authRouter,
18	  recordings: recordingsRouter,
19	  upload: uploadRouter,
20	  ai: aiRouter,
21	  comments: commentsRouter,
22	  views: viewsRouter,
23	  apiKeys: apiKeysRouter,
24	});
25	
26	export type AppRouter = typeof appRouter;
27
