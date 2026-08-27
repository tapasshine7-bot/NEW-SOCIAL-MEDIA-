import { sql } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

export const platformRouter = router({
  health: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { status: "degraded" as const, timestamp: new Date().toISOString() };
    await db.execute(sql`SELECT 1`);
    return { status: "ready" as const, timestamp: new Date().toISOString() };
  }),
});
