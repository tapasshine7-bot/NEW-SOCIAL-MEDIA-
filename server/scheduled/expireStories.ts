import type { Request, Response } from "express";
import { and, isNull, lt } from "drizzle-orm";
import { stories } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";

export async function expireStoriesHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database-unavailable" });
    const now = new Date();
    await db.update(stories).set({ deletedAt: now }).where(and(lt(stories.expiresAt, now), isNull(stories.deletedAt)));
    return res.json({ ok: true, expiredBefore: now.toISOString() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected scheduled cleanup failure";
    return res.status(500).json({ error: detail, timestamp: new Date().toISOString(), context: { url: req.originalUrl } });
  }
}
