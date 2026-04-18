import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";
import { muxWebhookHandler } from "./mux-webhook.js";
import { db } from "./db.js";
import { apiKeys, recordings } from "../drizzle/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { createHash } from "crypto";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(cookieParser());

// Mux webhook needs raw body — register before express.json()
app.post(
  "/api/webhooks/mux",
  express.raw({ type: "application/json" }),
  muxWebhookHandler
);

app.use(express.json({ limit: "50mb" }));

// tRPC — pass req & res so createContext can read/write cookies
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// ── Embed API (public, key-authenticated) ────────────────────────────────────

app.use("/api/embed", cors({ origin: "*", methods: ["GET"] }));
app.use("/embed.js", cors({ origin: "*", methods: ["GET"] }));

app.get("/api/embed/recordings", async (req, res) => {
  const apiKey = (req.headers.authorization?.replace("Bearer ", "") || req.query.key) as string;
  const clientEmail = req.query.client as string | undefined;

  if (!apiKey) { res.status(401).json({ error: "API key required" }); return; }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
  if (!keyRecord) { res.status(401).json({ error: "Invalid API key" }); return; }

  await db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.id, keyRecord.id));

  const where = clientEmail
    ? and(eq(recordings.userId, keyRecord.userId), eq(recordings.status, "ready"), eq(recordings.clientEmail, clientEmail))
    : and(eq(recordings.userId, keyRecord.userId), eq(recordings.status, "ready"), eq(recordings.isPublic, true));

  const recs = await db
    .select({
      id: recordings.id,
      title: recordings.title,
      muxPlaybackId: recordings.muxPlaybackId,
      duration: recordings.duration,
      shareToken: recordings.shareToken,
      createdAt: recordings.createdAt,
    })
    .from(recordings)
    .where(where)
    .orderBy(desc(recordings.createdAt))
    .limit(50);

  res.json({ recordings: recs });
});

// Serve the self-contained embed widget script
app.get("/embed.js", (_req, res) => {
  const BASE = process.env.BASE_URL ?? "https://screenclips.co";
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(`(function(){
  var s=document.currentScript;
  var key=s.getAttribute('data-key')||'';
  var client=s.getAttribute('data-client')||'';
  var base='${BASE}';
  var wrap=document.createElement('div');
  wrap.style.cssText='font-family:system-ui,sans-serif;max-width:100%';
  s.parentNode.insertBefore(wrap,s.nextSibling);
  fetch(base+'/api/embed/recordings?key='+encodeURIComponent(key)+'&client='+encodeURIComponent(client))
    .then(function(r){return r.json();})
    .then(function(data){
      if(!data.recordings||!data.recordings.length){
        wrap.innerHTML='<p style="color:#666;text-align:center;padding:20px 0">No recordings shared yet.</p>';
        return;
      }
      wrap.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;padding:8px 0">'+
        data.recordings.map(function(r){
          var dur=r.duration?Math.floor(r.duration/60)+'m '+Math.floor(r.duration%60)+'s':'';
          return '<a href="'+base+'/v/'+r.shareToken+'" target="_blank" '+
            'style="display:block;border-radius:10px;overflow:hidden;background:#f5f5f5;text-decoration:none;color:inherit;box-shadow:0 1px 3px rgba(0,0,0,.1)">'+
            '<img src="https://image.mux.com/'+r.muxPlaybackId+'/thumbnail.jpg?time=1&width=480" '+
            'style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" alt="'+r.title+'">'+
            '<div style="padding:10px 12px">'+
            '<div style="font-weight:600;font-size:14px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+r.title+'</div>'+
            '<div style="font-size:12px;color:#888">'+new Date(r.createdAt).toLocaleDateString()+(dur?' · '+dur:'')+'</div>'+
            '</div></a>';
        }).join('')+'</div>';
    })
    .catch(function(){wrap.innerHTML='<p style="color:#e53e3e;padding:16px 0">Failed to load recordings.</p>';});
})();`);
});

// ── Serve static client in production ────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const { default: path } = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(__dirname, "../client")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../client/index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
