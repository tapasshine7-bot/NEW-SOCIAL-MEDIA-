import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { blocks, comments, follows, followRequests, hashtags, mediaUploads, notifications, postHashtags, postLikes, postMedia, postShares, posts, profiles, reports, savedPosts, users } from "../../drizzle/schema";
import { createPublicId, getProfileByUsername, isBlockedEitherWay } from "../db/social";
import { getDb } from "../db";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/);
const postId = z.string().min(8).max(32);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The social service is temporarily unavailable." });
  return db;
}

function hashtagsFromCaption(caption?: string | null) {
  return Array.from(new Set((caption?.match(/#[A-Za-z0-9_]{2,80}/g) ?? []).map(tag => tag.slice(1).toLowerCase()))).slice(0, 12);
}

async function notify(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, recipientId: number, actorId: number, kind: "like" | "comment" | "follow" | "follow_request", entityType: string, entityPublicId: string) {
  if (recipientId === actorId) return;
  await db.insert(notifications).values({ publicId: createPublicId("notice"), recipientId, actorId, kind, entityType, entityPublicId });
}

export const socialRouter = router({
  feed: publicProcedure.input(z.object({ page: z.number().int().min(0).default(0), pageSize: z.number().int().min(1).max(20).default(10) }).optional()).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const page = input?.page ?? 0;
    const pageSize = input?.pageSize ?? 10;
    const following = ctx.user ? await db.select({ userId: follows.followingId }).from(follows).where(eq(follows.followerId, ctx.user.id)) : [];
    const blockedByViewer = ctx.user ? await db.select({ userId: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, ctx.user.id)) : [];
    const viewersBlockedBy = ctx.user ? await db.select({ userId: blocks.blockerId }).from(blocks).where(eq(blocks.blockedId, ctx.user.id)) : [];
    const visibleAuthors = ctx.user ? [ctx.user.id, ...following.map(row => row.userId)] : [];
    const excludedAuthors = [...blockedByViewer.map(row => row.userId), ...viewersBlockedBy.map(row => row.userId)];
    const conditions = [eq(posts.state, "published"), eq(users.accountStatus, "active")];
    if (visibleAuthors.length) conditions.push(or(eq(profiles.isPrivate, false), inArray(posts.authorId, visibleAuthors))!);
    else conditions.push(eq(profiles.isPrivate, false));
    if (excludedAuthors.length) conditions.push(sql`${posts.authorId} NOT IN ${excludedAuthors}`);
    const rows = await db.select({ post: posts, profile: profiles }).from(posts).innerJoin(profiles, eq(posts.authorId, profiles.userId)).innerJoin(users, eq(posts.authorId, users.id)).where(and(...conditions)).orderBy(desc(posts.createdAt)).limit(pageSize).offset(page * pageSize);
    const ids = rows.map(row => row.post.id);
    const assets = ids.length ? await db.select().from(postMedia).where(inArray(postMedia.postId, ids)).orderBy(postMedia.sortOrder) : [];
    const likes = ctx.user && ids.length ? await db.select({ postId: postLikes.postId }).from(postLikes).where(and(eq(postLikes.userId, ctx.user.id), inArray(postLikes.postId, ids))) : [];
    const saved = ctx.user && ids.length ? await db.select({ postId: savedPosts.postId }).from(savedPosts).where(and(eq(savedPosts.userId, ctx.user.id), inArray(savedPosts.postId, ids))) : [];
    return rows.map(row => ({ ...row.post, author: row.profile, media: assets.filter(asset => asset.postId === row.post.id), likedByMe: likes.some(item => item.postId === row.post.id), savedByMe: saved.some(item => item.postId === row.post.id) }));
  }),

  postById: publicProcedure.input(z.object({ postId })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const row = (await db.select({ post: posts, profile: profiles }).from(posts).innerJoin(profiles, eq(posts.authorId, profiles.userId)).innerJoin(users, eq(posts.authorId, users.id)).where(and(eq(posts.publicId, input.postId), eq(posts.state, "published"), eq(users.accountStatus, "active"))).limit(1))[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    if (row.profile.isPrivate && (!ctx.user || ctx.user.id !== row.post.authorId)) {
      const following = ctx.user ? (await db.select({ id: follows.id }).from(follows).where(and(eq(follows.followerId, ctx.user.id), eq(follows.followingId, row.post.authorId))).limit(1))[0] : undefined;
      if (!following) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    }
    const media = await db.select().from(postMedia).where(eq(postMedia.postId, row.post.id)).orderBy(postMedia.sortOrder);
    const liked = ctx.user ? (await db.select({ id: postLikes.id }).from(postLikes).where(and(eq(postLikes.userId, ctx.user.id), eq(postLikes.postId, row.post.id))).limit(1)).length > 0 : false;
    const saved = ctx.user ? (await db.select({ id: savedPosts.id }).from(savedPosts).where(and(eq(savedPosts.userId, ctx.user.id), eq(savedPosts.postId, row.post.id))).limit(1)).length > 0 : false;
    return { ...row.post, author: row.profile, media, likedByMe: liked, savedByMe: saved };
  }),

  createPost: protectedProcedure.input(z.object({ caption: z.string().trim().max(2200).nullable().optional(), locationName: z.string().trim().max(160).nullable().optional(), uploadIds: z.array(z.string().min(8).max(32)).min(1).max(10) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const uploads = await db.select().from(mediaUploads).where(and(eq(mediaUploads.ownerId, ctx.user.id), inArray(mediaUploads.publicId, input.uploadIds)));
    if (uploads.length !== input.uploadIds.length || uploads.some(upload => upload.attachedAt || !["post", "video"].includes(upload.purpose))) throw new TRPCError({ code: "BAD_REQUEST", message: "One or more selected uploads are unavailable for a post." });
    const publicId = createPublicId("post");
    await db.insert(posts).values({ publicId, authorId: ctx.user.id, caption: input.caption ?? null, locationName: input.locationName ?? null });
    const post = (await db.select().from(posts).where(eq(posts.publicId, publicId)).limit(1))[0];
    if (!post) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not publish the post." });
    await db.insert(postMedia).values(uploads.map((upload, sortOrder) => ({ postId: post.id, kind: upload.mimeType.startsWith("video/") ? "video" as const : "image" as const, storageKey: upload.storageKey, url: upload.url, width: upload.width, height: upload.height, durationMs: upload.durationMs, fileSize: upload.fileSize, sortOrder })));
    await db.update(mediaUploads).set({ attachedAt: new Date() }).where(inArray(mediaUploads.id, uploads.map(upload => upload.id)));
    await db.update(profiles).set({ postsCount: sql`${profiles.postsCount} + 1` }).where(eq(profiles.userId, ctx.user.id));
    const tags = hashtagsFromCaption(input.caption);
    for (const name of tags) {
      await db.insert(hashtags).values({ name, usesCount: 1 }).onDuplicateKeyUpdate({ set: { usesCount: sql`${hashtags.usesCount} + 1` } });
      const tag = (await db.select().from(hashtags).where(eq(hashtags.name, name)).limit(1))[0];
      if (tag) await db.insert(postHashtags).values({ postId: post.id, hashtagId: tag.id }).onDuplicateKeyUpdate({ set: { postId: post.id } });
    }
    return { publicId, hashtags: tags };
  }),

  toggleLike: protectedProcedure.input(z.object({ postId })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const post = (await db.select().from(posts).where(and(eq(posts.publicId, input.postId), eq(posts.state, "published"))).limit(1))[0];
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    if (await isBlockedEitherWay(ctx.user.id, post.authorId)) throw new TRPCError({ code: "FORBIDDEN", message: "This interaction is unavailable." });
    const existing = (await db.select().from(postLikes).where(and(eq(postLikes.postId, post.id), eq(postLikes.userId, ctx.user.id))).limit(1))[0];
    if (existing) { await db.delete(postLikes).where(eq(postLikes.id, existing.id)); await db.update(posts).set({ likesCount: sql`GREATEST(${posts.likesCount} - 1, 0)` }).where(eq(posts.id, post.id)); return { liked: false }; }
    await db.insert(postLikes).values({ postId: post.id, userId: ctx.user.id });
    await db.update(posts).set({ likesCount: sql`${posts.likesCount} + 1` }).where(eq(posts.id, post.id));
    await notify(db, post.authorId, ctx.user.id, "like", "post", post.publicId);
    return { liked: true };
  }),

  toggleSave: protectedProcedure.input(z.object({ postId })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const post = (await db.select().from(posts).where(eq(posts.publicId, input.postId)).limit(1))[0];
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    const existing = (await db.select().from(savedPosts).where(and(eq(savedPosts.postId, post.id), eq(savedPosts.userId, ctx.user.id))).limit(1))[0];
    if (existing) { await db.delete(savedPosts).where(eq(savedPosts.id, existing.id)); await db.update(posts).set({ savesCount: sql`GREATEST(${posts.savesCount} - 1, 0)` }).where(eq(posts.id, post.id)); return { saved: false }; }
    await db.insert(savedPosts).values({ postId: post.id, userId: ctx.user.id });
    await db.update(posts).set({ savesCount: sql`${posts.savesCount} + 1` }).where(eq(posts.id, post.id));
    return { saved: true };
  }),

  addComment: protectedProcedure.input(z.object({ postId, body: z.string().trim().min(1).max(2000), parentCommentId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const post = (await db.select().from(posts).where(and(eq(posts.publicId, input.postId), eq(posts.state, "published"))).limit(1))[0];
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    if (await isBlockedEitherWay(ctx.user.id, post.authorId)) throw new TRPCError({ code: "FORBIDDEN", message: "This interaction is unavailable." });
    await db.insert(comments).values({ postId: post.id, authorId: ctx.user.id, body: input.body, parentCommentId: input.parentCommentId });
    await db.update(posts).set({ commentsCount: sql`${posts.commentsCount} + 1` }).where(eq(posts.id, post.id));
    await notify(db, post.authorId, ctx.user.id, "comment", "post", post.publicId);
    return { success: true } as const;
  }),

  comments: publicProcedure.input(z.object({ postId, page: z.number().int().min(0).default(0), pageSize: z.number().int().min(1).max(50).default(20) })).query(async ({ input }) => {
    const db = await requireDb();
    const post = (await db.select({ id: posts.id }).from(posts).where(eq(posts.publicId, input.postId)).limit(1))[0];
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    return db.select({ comment: comments, author: profiles }).from(comments).innerJoin(profiles, eq(comments.authorId, profiles.userId)).where(and(eq(comments.postId, post.id), sql`${comments.deletedAt} IS NULL`)).orderBy(desc(comments.createdAt)).limit(input.pageSize).offset(input.page * input.pageSize);
  }),

  deleteComment: protectedProcedure.input(z.object({ commentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const comment = (await db.select().from(comments).where(eq(comments.id, input.commentId)).limit(1))[0];
    if (!comment || comment.authorId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot remove this comment." });
    await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, comment.id));
    return { success: true } as const;
  }),

  recordShare: protectedProcedure.input(z.object({ postId, method: z.enum(["native", "copy_link", "direct"]).default("native") })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const post = (await db.select().from(posts).where(and(eq(posts.publicId, input.postId), eq(posts.state, "published"))).limit(1))[0];
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    await db.insert(postShares).values({ postId: post.id, userId: ctx.user.id, method: input.method });
    await db.update(posts).set({ sharesCount: sql`${posts.sharesCount} + 1` }).where(eq(posts.id, post.id));
    return { success: true } as const;
  }),

  reportPost: protectedProcedure.input(z.object({ postId, reason: z.enum(["spam", "harassment", "impersonation", "inappropriate", "violence", "other"]), details: z.string().trim().max(1000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const post = (await db.select().from(posts).where(eq(posts.publicId, input.postId)).limit(1))[0];
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "This post is unavailable." });
    const existing = (await db.select({ id: reports.id }).from(reports).where(and(eq(reports.reporterId, ctx.user.id), eq(reports.targetType, "post"), eq(reports.targetId, post.id), eq(reports.state, "open"))).limit(1))[0];
    if (!existing) await db.insert(reports).values({ publicId: createPublicId("report"), reporterId: ctx.user.id, targetType: "post", targetId: post.id, reason: input.reason, details: input.details ?? null });
    return { success: true } as const;
  }),

  follow: protectedProcedure.input(z.object({ username })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const target = await getProfileByUsername(input.username);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "That member is unavailable." });
    if (target.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot follow your own profile." });
    if (await isBlockedEitherWay(ctx.user.id, target.userId)) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot follow this member." });
    const existing = (await db.select().from(follows).where(and(eq(follows.followerId, ctx.user.id), eq(follows.followingId, target.userId))).limit(1))[0];
    if (existing) return { state: "following" as const };
    if (target.isPrivate) {
      await db.insert(followRequests).values({ requesterId: ctx.user.id, recipientId: target.userId }).onDuplicateKeyUpdate({ set: { status: "pending" } });
      await notify(db, target.userId, ctx.user.id, "follow_request", "profile", target.publicId);
      return { state: "requested" as const };
    }
    await db.insert(follows).values({ followerId: ctx.user.id, followingId: target.userId });
    await db.update(profiles).set({ followingCount: sql`${profiles.followingCount} + 1` }).where(eq(profiles.userId, ctx.user.id));
    await db.update(profiles).set({ followersCount: sql`${profiles.followersCount} + 1` }).where(eq(profiles.userId, target.userId));
    await notify(db, target.userId, ctx.user.id, "follow", "profile", target.publicId);
    return { state: "following" as const };
  }),

  relationship: protectedProcedure.input(z.object({ username })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const target = await getProfileByUsername(input.username);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "That member is unavailable." });
    const following = (await db.select({ id: follows.id }).from(follows).where(and(eq(follows.followerId, ctx.user.id), eq(follows.followingId, target.userId))).limit(1)).length > 0;
    const request = (await db.select({ id: followRequests.id }).from(followRequests).where(and(eq(followRequests.requesterId, ctx.user.id), eq(followRequests.recipientId, target.userId), eq(followRequests.status, "pending"))).limit(1)).length > 0;
    return { following, requestPending: request };
  }),

  incomingFollowRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db.select({ requestId: followRequests.id, createdAt: followRequests.createdAt, profile: profiles }).from(followRequests).innerJoin(profiles, eq(followRequests.requesterId, profiles.userId)).where(and(eq(followRequests.recipientId, ctx.user.id), eq(followRequests.status, "pending"))).orderBy(desc(followRequests.createdAt));
  }),

  unfollow: protectedProcedure.input(z.object({ username })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const target = await getProfileByUsername(input.username);
    if (!target || target.userId === ctx.user.id) return { success: true } as const;
    const record = (await db.select().from(follows).where(and(eq(follows.followerId, ctx.user.id), eq(follows.followingId, target.userId))).limit(1))[0];
    if (record) {
      await db.delete(follows).where(eq(follows.id, record.id));
      await db.update(profiles).set({ followingCount: sql`GREATEST(${profiles.followingCount} - 1, 0)` }).where(eq(profiles.userId, ctx.user.id));
      await db.update(profiles).set({ followersCount: sql`GREATEST(${profiles.followersCount} - 1, 0)` }).where(eq(profiles.userId, target.userId));
    }
    await db.update(followRequests).set({ status: "cancelled" }).where(and(eq(followRequests.requesterId, ctx.user.id), eq(followRequests.recipientId, target.userId), eq(followRequests.status, "pending")));
    return { success: true } as const;
  }),

  respondToFollowRequest: protectedProcedure.input(z.object({ username, approve: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const requester = await getProfileByUsername(input.username);
    if (!requester) throw new TRPCError({ code: "NOT_FOUND", message: "That follow request is unavailable." });
    const request = (await db.select().from(followRequests).where(and(eq(followRequests.requesterId, requester.userId), eq(followRequests.recipientId, ctx.user.id), eq(followRequests.status, "pending"))).limit(1))[0];
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "That follow request is unavailable." });
    if (!input.approve) { await db.update(followRequests).set({ status: "rejected" }).where(eq(followRequests.id, request.id)); return { state: "rejected" as const }; }
    await db.insert(follows).values({ followerId: requester.userId, followingId: ctx.user.id }).onDuplicateKeyUpdate({ set: { followerId: requester.userId } });
    await db.update(followRequests).set({ status: "approved" }).where(eq(followRequests.id, request.id));
    await db.update(profiles).set({ followersCount: sql`${profiles.followersCount} + 1` }).where(eq(profiles.userId, ctx.user.id));
    await db.update(profiles).set({ followingCount: sql`${profiles.followingCount} + 1` }).where(eq(profiles.userId, requester.userId));
    return { state: "approved" as const };
  }),
});
