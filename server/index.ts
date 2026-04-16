import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";
import { muxWebhookHandler } from "./mux-webhook.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = process.env.BASE_URL ?? "http://localhost:5173";
      if (!origin || origin === allowed || origin.startsWith("chrome-extension://")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
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

// Serve static client in production
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
