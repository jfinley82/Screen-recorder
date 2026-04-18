import { initTRPC, TRPCError } from "@trpc/server";
2	import { z } from "zod";
3	import superjson from "superjson";
4	import { db } from "../db.js";
5	import { apiKeys } from "../../drizzle/schema.js";
6	import { eq, and } from "drizzle-orm";
7	import { randomBytes, createHash } from "crypto";
8	import type { Context } from "../context.js";
9	
10	const t = initTRPC.context<Context>().create({ transformer: superjson });
11	const router = t.router;
12	const protectedProcedure = t.procedure.use(({ ctx, next }) => {
13	  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
14	  return next({ ctx: { ...ctx, userId: ctx.userId } });
15	});
16	
17	export const apiKeysRouter = router({
18	  list: protectedProcedure.query(async ({ ctx }) => {
19	    return db
20	      .select({
21	        id: apiKeys.id,
22	        name: apiKeys.name,
23	        keyPrefix: apiKeys.keyPrefix,
24	        lastUsedAt: apiKeys.lastUsedAt,
25	        createdAt: apiKeys.createdAt,
26	      })
27	      .from(apiKeys)
28	      .where(eq(apiKeys.userId, ctx.userId));
29	  }),
30	
31	  create: protectedProcedure
32	    .input(z.object({ name: z.string().min(1).max(100) }))
33	    .mutation(async ({ input, ctx }) => {
34	      const raw = `sc_${randomBytes(24).toString("hex")}`;
35	      const keyHash = createHash("sha256").update(raw).digest("hex");
36	      const keyPrefix = raw.slice(0, 10);
37	
38	      await db.insert(apiKeys).values({
39	        userId: ctx.userId,
40	        name: input.name,
41	        keyHash,
42	        keyPrefix,
43	      });
44	
45	      return { key: raw };
46	    }),
47	
48	  revoke: protectedProcedure
49	    .input(z.object({ id: z.number() }))
50	    .mutation(async ({ input, ctx }) => {
51	      await db
52	        .delete(apiKeys)
53	        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.userId)));
54	    }),
55	});
