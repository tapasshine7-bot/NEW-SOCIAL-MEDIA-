import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { expireStoriesHandler } from "./scheduled/expireStories";

const requestWindows = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.path.startsWith("/api/")) return next();
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const strict = req.path.includes("uploads") || req.path.includes("oauth");
  const max = strict ? 20 : 180;
  const key = `${strict ? "strict" : "standard"}:${ip}`;
  const record = requestWindows.get(key);
  if (!record || record.resetAt <= now) { requestWindows.set(key, { count: 1, resetAt: now + 60_000 }); return next(); }
  if (record.count >= max) { res.setHeader("Retry-After", Math.ceil((record.resetAt - now) / 1000)); return res.status(429).json({ error: "Too many requests. Please retry shortly." }); }
  record.count += 1;
  return next();
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(rateLimit);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
    if (process.env.NODE_ENV !== "development") {
      res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; style-src 'self' 'unsafe-inline'; script-src 'self';");
    }
    next();
  });
  app.use(express.json({ limit: "75mb" }));
  app.use(express.urlencoded({ limit: "75mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/expire-stories", expireStoriesHandler);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
