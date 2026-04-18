1	import express from "express";
2	import cors from "cors";
3	import cookieParser from "cookie-parser";
4	import { createExpressMiddleware } from "@trpc/server/adapters/express";
5	import { appRouter } from "./router.js";
6	import { createContext } from "./context.js";
7	import { muxWebhookHandler } from "./mux-webhook.js";
8	import { db } from "./db.js";
9	import { apiKeys, recordings } from "../drizzle/schema.js";
10	import { eq, and, desc } from "drizzle-orm";
11	import { createHash } from "crypto";
12	
13	const app = express();
14	const PORT = parseInt(process.env.PORT ?? "3000", 10);
15	
16	app.use(
17	  cors({
18	    origin: true,
19	    credentials: true,
20	    allowedHeaders: ["Content-Type", "Authorization"],
21	  })
22	);
23	
24	app.use(cookieParser());
25	
26	// Mux webhook needs raw body — register before express.json()
27	app.post(
28	  "/api/webhooks/mux",
29	  express.raw({ type: "application/json" }),
30	  muxWebhookHandler
31	);
32	
33	app.use(express.json({ limit: "50mb" }));
34	
35	// tRPC — pass req & res so createContext can read/write cookies
36	app.use(
37	  "/trpc",
38	  createExpressMiddleware({
39	    router: appRouter,
40	    createContext,
41	  })
42	);
43	
44	// ── Embed API (public, key-authenticated) ────────────────────────────────────
45	
46	app.use("/api/embed", cors({ origin: "*", methods: ["GET"] }));
47	app.use("/embed.js", cors({ origin: "*", methods: ["GET"] }));
48	
49	app.get("/api/embed/recordings", async (req, res) => {
50	  const apiKey = (req.headers.authorization?.replace("Bearer ", "") || req.query.key) as string;
51	  const clientEmail = req.query.client as string | undefined;
52	
53	  if (!apiKey) { res.status(401).json({ error: "API key required" }); return; }
54	
55	  const keyHash = createHash("sha256").update(apiKey).digest("hex");
56	  const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
57	  if (!keyRecord) { res.status(401).json({ error: "Invalid API key" }); return; }
58	
59	  await db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.id, keyRecord.id));
60	
61	  const where = clientEmail
62	    ? and(eq(recordings.userId, keyRecord.userId), eq(recordings.status, "ready"), eq(recordings.clientEmail, clientEmail))
63	    : and(eq(recordings.userId, keyRecord.userId), eq(recordings.status, "ready"), eq(recordings.isPublic, true));
64	
65	  const recs = await db
66	    .select({
67	      id: recordings.id,
68	      title: recordings.title,
69	      muxPlaybackId: recordings.muxPlaybackId,
70	      duration: recordings.duration,
71	      shareToken: recordings.shareToken,
72	      createdAt: recordings.createdAt,
73	    })
74	    .from(recordings)
75	    .where(where)
76	    .orderBy(desc(recordings.createdAt))
77	    .limit(50);
78	
79	  res.json({ recordings: recs });
80	});
81	
82	// Serve the self-contained embed widget script
83	app.get("/embed.js", (_req, res) => {
84	  const BASE = process.env.BASE_URL ?? "https://screenclips.co";
85	  res.setHeader("Content-Type", "application/javascript");
86	  res.setHeader("Cache-Control", "public, max-age=300");
87	  res.send(`(function(){
88	  var s=document.currentScript;
89	  var key=s.getAttribute('data-key')||'';
90	  var client=s.getAttribute('data-client')||'';
91	  var base='${BASE}';
92	  var wrap=document.createElement('div');
93	  wrap.style.cssText='font-family:system-ui,sans-serif;max-width:100%';
94	  s.parentNode.insertBefore(wrap,s.nextSibling);
95	  fetch(base+'/api/embed/recordings?key='+encodeURIComponent(key)+'&client='+encodeURIComponent(client))
96	    .then(function(r){return r.json();})
97	    .then(function(data){
98	      if(!data.recordings||!data.recordings.length){
99	        wrap.innerHTML='<p style="color:#666;text-align:center;padding:20px 0">No recordings shared yet.</p>';
100	        return;
101	      }
102	      wrap.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;padding:8px 0">'+
103	        data.recordings.map(function(r){
104	          var dur=r.duration?Math.floor(r.duration/60)+'m '+Math.floor(r.duration%60)+'s':'';
105	          return '<a href="'+base+'/v/'+r.shareToken+'" target="_blank" '+
106	            'style="display:block;border-radius:10px;overflow:hidden;background:#f5f5f5;text-decoration:none;color:inherit;box-shadow:0 1px 3px rgba(0,0,0,.1)">'+
107	            '<img src="https://image.mux.com/'+r.muxPlaybackId+'/thumbnail.jpg?time=1&width=480" '+
108	            'style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" alt="'+r.title+'">'+
109	            '<div style="padding:10px 12px">'+
110	            '<div style="font-weight:600;font-size:14px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+r.title+'</div>'+
111	            '<div style="font-size:12px;color:#888">'+new Date(r.createdAt).toLocaleDateString()+(dur?' · '+dur:'')+'</div>'+
112	            '</div></a>';
113	        }).join('')+'</div>';
114	    })
115	    .catch(function(){wrap.innerHTML='<p style="color:#e53e3e;padding:16px 0">Failed to load recordings.</p>';});
116	})();`);
117	});
118	
119	// ── Serve static client in production ────────────────────────────────────────
120	if (process.env.NODE_ENV === "production") {
121	  const { default: path } = await import("path");
122	  const { fileURLToPath } = await import("url");
123	  const __dirname = path.dirname(fileURLToPath(import.meta.url));
124	  app.use(express.static(path.join(__dirname, "../client")));
125	  app.get("*", (_req, res) => {
126	    res.sendFile(path.join(__dirname, "../client/index.html"));
127	  });
128	}
129	
130	app.listen(PORT, () => {
131	  console.log(`[server] running on http://localhost:${PORT}`);
132	});
133
