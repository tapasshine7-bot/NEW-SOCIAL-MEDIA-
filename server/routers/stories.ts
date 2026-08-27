import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { follows, mediaUploads, notifications, profiles, stories, storyReplies, storyViews, users } from "../../drizzle/schema";
import { createPublicId, isBlockedEitherWay } from "../db/social";
import { getDb } from "../db";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

const storyId = z.string().min(8).max(32);
const visibility = z.enum(["everyone", "followers", "none"]);

async function requireDb() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stories are temporarily unavailable." }); return db; }

export const storiesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const following = ctx.user ? await db.select({ userId: follows.followingId }).from(follows).where(eq(follows.followerId, ctx.user.id)) : [];
    const allowedAuthors = ctx.user ? [ctx.user.id, ...following.map(item => item.userId)] : [];
    const visibilityCondition = allowedAuthors.length ? or(and(eq(stories.visibility, "everyone"), eq(profiles.isPrivate, false)), inArray(stories.authorId, allowedAuthors))! : and(eq(stories.visibility, "everyone"), eq(profiles.isPrivate, false));
    const rows = await db.select({ story: stories, author: profiles }).from(stories).innerJoin(profiles, eq(stories.authorId, profiles.userId)).innerJoin(users, eq(stories.authorId, users.id)).where(and(gt(stories.expiresAt, new Date()), sql`${stories.deletedAt} IS NULL`, eq(users.accountStatus, "active"), visibilityCondition)).orderBy(desc(stories.createdAt)).limit(50);
    return rows;
  }),

  create: protectedProcedure.input(z.object({ uploadId: z.string().min(8).max(32), textOverlay: z.string().trim().max(500).nullable().optional(), visibility: visibility.optional(), stickers: z.array(z.object({ type: z.string().max(32), value: z.string().max(200), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(20).optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const upload = (await db.select().from(mediaUploads).where(eq(mediaUploads.publicId, input.uploadId)).limit(1))[0];
    if (!upload || upload.ownerId !== ctx.user.id || upload.purpose !== "story" || upload.attachedAt || !upload.mimeType.match(/^(image|video)\//)) throw new TRPCError({ code: "BAD_REQUEST", message: "This media upload is unavailable for a story." });
    const publicId = createPublicId("story");
    await db.insert(stories).values({ publicId, authorId: ctx.user.id, kind: upload.mimeType.startsWith("video/") ? "video" : "image", storageKey: upload.storageKey, url: upload.url, textOverlay: input.textOverlay ?? null, stickers: input.stickers, visibility: input.visibility ?? "everyone", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await db.update(mediaUploads).set({ attachedAt: new Date() }).where(eq(mediaUploads.id, upload.id));
    return { publicId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
  }),

  recordView: protectedProcedure.input(z.object({ storyId })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const story = (await db.select().from(stories).where(and(eq(stories.publicId, input.storyId), gt(stories.expiresAt, new Date()), sql`${stories.deletedAt} IS NULL`)).limit(1))[0];
    if (!story) throw new TRPCError({ code: "NOT_FOUND", message: "This story has expired." });
    if (await isBlockedEitherWay(ctx.user.id, story.authorId)) throw new TRPCError({ code: "FORBIDDEN", message: "This story is unavailable." });
    if (story.authorId !== ctx.user.id) {
      const existing = (await db.select({ id: storyViews.id }).from(storyViews).where(and(eq(storyViews.storyId, story.id), eq(storyViews.viewerId, ctx.user.id))).limit(1))[0];
      if (!existing) { await db.insert(storyViews).values({ storyId: story.id, viewerId: ctx.user.id }); await db.update(stories).set({ viewsCount: sql`${stories.viewsCount} + 1` }).where(eq(stories.id, story.id)); }
    }
    return { success: true } as const;
  }),

  reply: protectedProcedure.input(z.object({ storyId, body: z.string().trim().min(1).max(2000) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const story = (await db.select().from(stories).where(and(eq(stories.publicId, input.storyId), gt(stories.expiresAt, new Date()), sql`${stories.deletedAt} IS NULL`)).limit(1))[0];
    if (!story || story.authorId === ctx.user.id || await isBlockedEitherWay(ctx.user.id, story.authorId)) throw new TRPCError({ code: "FORBIDDEN", message: "This story is unavailable for replies." });
    await db.insert(storyReplies).values({ publicId: createPublicId("storyreply"), storyId: story.id, senderId: ctx.user.id, body: input.body });
    await db.insert(notifications).values({ publicId: createPublicId("notice"), recipientId: story.authorId, actorId: ctx.user.id, kind: "story_reply", entityType: "story", entityPublicId: input.storyId });
    return { success: true } as const;
  }),

  viewers: protectedProcedure.input(z.object({ storyId })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const story = (await db.select().from(stories).where(eq(stories.publicId, input.storyId)).limit(1))[0];
    if (!story || story.authorId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot view this audience." });
    return db.select({ viewedAt: storyViews.createdAt, profile: profiles }).from(storyViews).innerJoin(profiles, eq(storyViews.viewerId, profiles.userId)).where(eq(storyViews.storyId, story.id)).orderBy(desc(storyViews.createdAt));
  }),

  delete: protectedProcedure.input(z.object({ storyId })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const story = (await db.select().from(stories).where(eq(stories.publicId, input.storyId)).limit(1))[0];
    if (!story || story.authorId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot delete this story." });
    await db.update(stories).set({ deletedAt: new Date() }).where(eq(stories.id, story.id));
    return { success: true } as const;
  }),
});
