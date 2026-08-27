import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { hashtags, posts, profiles, shortVideos, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

async function requireDb() { const db = await getDb(); if (!db) throw new Error("Discovery is temporarily unavailable."); return db; }
const query = z.string().trim().min(1).max(80);

export const exploreRouter = router({
  overview: publicProcedure.query(async () => {
    const db = await requireDb();
    const [people, topics, videos] = await Promise.all([
      db.select().from(profiles).innerJoin(users, eq(profiles.userId, users.id)).where(and(eq(profiles.isPrivate, false), eq(users.accountStatus, "active"))).orderBy(desc(profiles.followersCount)).limit(6),
      db.select().from(hashtags).orderBy(desc(hashtags.usesCount)).limit(8),
      db.select({ video: shortVideos, author: profiles }).from(shortVideos).innerJoin(profiles, eq(shortVideos.authorId, profiles.userId)).where(and(eq(shortVideos.state, "published"), eq(profiles.isPrivate, false))).orderBy(desc(shortVideos.viewsCount)).limit(4),
    ]);
    return { people: people.map(row => row.profiles), topics, videos };
  }),
  search: publicProcedure.input(z.object({ query })).query(async ({ input }) => {
    const db = await requireDb(); const pattern = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
    const [people, topics, postRows] = await Promise.all([
      db.select().from(profiles).innerJoin(users, eq(profiles.userId, users.id)).where(and(eq(profiles.isPrivate, false), eq(users.accountStatus, "active"), or(like(profiles.username, pattern), like(profiles.displayName, pattern)))).limit(12),
      db.select().from(hashtags).where(like(hashtags.name, pattern)).orderBy(desc(hashtags.usesCount)).limit(12),
      db.select({ post: posts, author: profiles }).from(posts).innerJoin(profiles, eq(posts.authorId, profiles.userId)).innerJoin(users, eq(posts.authorId, users.id)).where(and(eq(posts.state, "published"), eq(profiles.isPrivate, false), eq(users.accountStatus, "active"), like(posts.caption, pattern))).orderBy(desc(posts.createdAt)).limit(12),
    ]);
    return { people: people.map(row => row.profiles), topics, posts: postRows };
  }),
});
