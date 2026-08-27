import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { mediaUploads, profiles, savedShortVideos, shortVideoLikes, shortVideos, shortVideoViews, users } from "../../drizzle/schema";
import { createPublicId, isBlockedEitherWay } from "../db/social";
import { getDb } from "../db";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

const videoId = z.string().min(8).max(32);
async function requireDb() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Videos are temporarily unavailable." }); return db; }

export const videosRouter = router({
  list: publicProcedure.input(z.object({ page: z.number().int().min(0).default(0), pageSize: z.number().int().min(1).max(10).default(5) }).optional()).query(async ({ ctx, input }) => {
    const db = await requireDb(); const page = input?.page ?? 0; const pageSize = input?.pageSize ?? 5;
    const rows = await db.select({ video: shortVideos, author: profiles }).from(shortVideos).innerJoin(profiles, eq(shortVideos.authorId, profiles.userId)).innerJoin(users, eq(shortVideos.authorId, users.id)).where(and(eq(shortVideos.state, "published"), eq(users.accountStatus, "active"), eq(profiles.isPrivate, false))).orderBy(desc(shortVideos.createdAt)).limit(pageSize).offset(page * pageSize);
    const ids = rows.map(row => row.video.id);
    const likes = ctx.user && ids.length ? await db.select({ videoId: shortVideoLikes.videoId }).from(shortVideoLikes).where(and(eq(shortVideoLikes.userId, ctx.user.id), inArray(shortVideoLikes.videoId, ids))) : [];
    const saved = ctx.user && ids.length ? await db.select({ videoId: savedShortVideos.videoId }).from(savedShortVideos).where(and(eq(savedShortVideos.userId, ctx.user.id), inArray(savedShortVideos.videoId, ids))) : [];
    return rows.map(row => ({ ...row.video, author: row.author, likedByMe: likes.some(item => item.videoId === row.video.id), savedByMe: saved.some(item => item.videoId === row.video.id) }));
  }),

  create: protectedProcedure.input(z.object({ uploadId: z.string().min(8).max(32), caption: z.string().trim().max(2200).nullable().optional(), audioTitle: z.string().trim().max(160).nullable().optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const upload = (await db.select().from(mediaUploads).where(eq(mediaUploads.publicId, input.uploadId)).limit(1))[0];
    if (!upload || upload.ownerId !== ctx.user.id || upload.purpose !== "video" || upload.attachedAt || !upload.mimeType.startsWith("video/")) throw new TRPCError({ code: "BAD_REQUEST", message: "This upload is unavailable for a short video." });
    const publicId = createPublicId("video");
    await db.insert(shortVideos).values({ publicId, authorId: ctx.user.id, storageKey: upload.storageKey, url: upload.url, caption: input.caption ?? null, audioTitle: input.audioTitle ?? null, durationMs: upload.durationMs ?? null });
    await db.update(mediaUploads).set({ attachedAt: new Date() }).where(eq(mediaUploads.id, upload.id));
    return { publicId };
  }),

  recordView: protectedProcedure.input(z.object({ videoId })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const video = (await db.select().from(shortVideos).where(eq(shortVideos.publicId, input.videoId)).limit(1))[0];
    if (!video) throw new TRPCError({ code: "NOT_FOUND", message: "This video is unavailable." });
    const previous = (await db.select({ id: shortVideoViews.id }).from(shortVideoViews).where(and(eq(shortVideoViews.videoId, video.id), eq(shortVideoViews.viewerId, ctx.user.id))).limit(1))[0];
    if (!previous) { await db.insert(shortVideoViews).values({ videoId: video.id, viewerId: ctx.user.id }); await db.update(shortVideos).set({ viewsCount: sql`${shortVideos.viewsCount} + 1` }).where(eq(shortVideos.id, video.id)); }
    return { success: true } as const;
  }),

  toggleLike: protectedProcedure.input(z.object({ videoId })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const video = (await db.select().from(shortVideos).where(eq(shortVideos.publicId, input.videoId)).limit(1))[0];
    if (!video || await isBlockedEitherWay(ctx.user.id, video.authorId)) throw new TRPCError({ code: "NOT_FOUND", message: "This video is unavailable." });
    const previous = (await db.select().from(shortVideoLikes).where(and(eq(shortVideoLikes.videoId, video.id), eq(shortVideoLikes.userId, ctx.user.id))).limit(1))[0];
    if (previous) { await db.delete(shortVideoLikes).where(eq(shortVideoLikes.id, previous.id)); await db.update(shortVideos).set({ likesCount: sql`GREATEST(${shortVideos.likesCount} - 1, 0)` }).where(eq(shortVideos.id, video.id)); return { liked: false }; }
    await db.insert(shortVideoLikes).values({ videoId: video.id, userId: ctx.user.id }); await db.update(shortVideos).set({ likesCount: sql`${shortVideos.likesCount} + 1` }).where(eq(shortVideos.id, video.id)); return { liked: true };
  }),

  toggleSave: protectedProcedure.input(z.object({ videoId })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const video = (await db.select().from(shortVideos).where(eq(shortVideos.publicId, input.videoId)).limit(1))[0];
    if (!video) throw new TRPCError({ code: "NOT_FOUND", message: "This video is unavailable." });
    const previous = (await db.select().from(savedShortVideos).where(and(eq(savedShortVideos.videoId, video.id), eq(savedShortVideos.userId, ctx.user.id))).limit(1))[0];
    if (previous) { await db.delete(savedShortVideos).where(eq(savedShortVideos.id, previous.id)); await db.update(shortVideos).set({ savesCount: sql`GREATEST(${shortVideos.savesCount} - 1, 0)` }).where(eq(shortVideos.id, video.id)); return { saved: false }; }
    await db.insert(savedShortVideos).values({ videoId: video.id, userId: ctx.user.id }); await db.update(shortVideos).set({ savesCount: sql`${shortVideos.savesCount} + 1` }).where(eq(shortVideos.id, video.id)); return { saved: true };
  }),

  recordShare: protectedProcedure.input(z.object({ videoId, method: z.enum(["native", "copy_link", "direct"]).default("native") })).mutation(async ({ input }) => {
    const db = await requireDb(); const video = (await db.select().from(shortVideos).where(and(eq(shortVideos.publicId, input.videoId), eq(shortVideos.state, "published"))).limit(1))[0];
    if (!video) throw new TRPCError({ code: "NOT_FOUND", message: "This video is unavailable." });
    await db.update(shortVideos).set({ sharesCount: sql`${shortVideos.sharesCount} + 1` }).where(eq(shortVideos.id, video.id));
    return { success: true } as const;
  }),
});
