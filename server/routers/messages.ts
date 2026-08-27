import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, conversationTyping, directConversations, follows, mediaUploads, messageAttachments, messageDeliveries, messageReactions, messageReadReceipts, messages, notifications, profiles, userDevices } from "../../drizzle/schema";
import { createPublicId, getProfileByUsername, isBlockedEitherWay } from "../db/social";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const conversationId = z.string().min(8).max(32);
const messageId = z.string().min(8).max(32);
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/);
async function requireDb() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Messages are temporarily unavailable." }); return db; }
async function membership(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, publicId: string, userId: number) { const row = (await db.select({ conversation: conversations, member: conversationMembers }).from(conversations).innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, conversations.id), eq(conversationMembers.userId, userId))).where(and(eq(conversations.publicId, publicId), isNull(conversationMembers.leftAt))).limit(1))[0]; if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this conversation." }); return row; }
async function requireGroupManager(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, publicId: string, userId: number) { const current = await membership(db, publicId, userId); if (current.conversation.kind !== "group" || !["owner", "admin"].includes(current.member.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Only group managers can make this change." }); return current; }
async function touchPresence(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number) { await db.insert(userDevices).values({ userId, deviceId: `web-presence-${userId}`, platform: "web", lastSeenAt: new Date() }).onDuplicateKeyUpdate({ set: { lastSeenAt: new Date(), platform: "web" } }); }

export const messagesRouter = router({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb(); await touchPresence(db, ctx.user.id);
    const rows = await db.select({ conversation: conversations, member: conversationMembers }).from(conversationMembers).innerJoin(conversations, eq(conversationMembers.conversationId, conversations.id)).where(and(eq(conversationMembers.userId, ctx.user.id), isNull(conversationMembers.leftAt))).orderBy(desc(conversations.lastMessageAt));
    const result = [];
    for (const row of rows) {
      const members = await db.select({ userId: conversationMembers.userId, role: conversationMembers.role, profile: profiles }).from(conversationMembers).innerJoin(profiles, eq(conversationMembers.userId, profiles.userId)).where(and(eq(conversationMembers.conversationId, row.conversation.id), isNull(conversationMembers.leftAt)));
      const activity = members.length ? await db.select({ userId: userDevices.userId, lastSeenAt: userDevices.lastSeenAt }).from(userDevices).where(inArray(userDevices.userId, members.map(member => member.userId))).orderBy(desc(userDevices.lastSeenAt)) : [];
      const last = (await db.select().from(messages).where(and(eq(messages.conversationId, row.conversation.id), isNull(messages.deletedAt))).orderBy(desc(messages.createdAt)).limit(1))[0] ?? null;
      result.push({ ...row.conversation, role: row.member.role, members: members.map(member => ({ ...member, lastSeenAt: activity.find(item => item.userId === member.userId)?.lastSeenAt ?? null })), lastMessage: last });
    }
    return result;
  }),

  startDirect: protectedProcedure.input(z.object({ username })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const target = await getProfileByUsername(input.username);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "This member is unavailable." });
    if (target.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot start a conversation with yourself." });
    if (await isBlockedEitherWay(ctx.user.id, target.userId)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is unavailable." });
    const followsTarget = (await db.select({ id: follows.id }).from(follows).where(and(eq(follows.followerId, ctx.user.id), eq(follows.followingId, target.userId))).limit(1))[0];
    if (target.allowMessages === "none" || (target.allowMessages === "followers" && !followsTarget)) throw new TRPCError({ code: "FORBIDDEN", message: "This member does not accept new messages from you." });
    const [memberOneId, memberTwoId] = [ctx.user.id, target.userId].sort((a, b) => a - b);
    const existing = (await db.select({ publicId: conversations.publicId }).from(directConversations).innerJoin(conversations, eq(directConversations.conversationId, conversations.id)).where(and(eq(directConversations.memberOneId, memberOneId), eq(directConversations.memberTwoId, memberTwoId))).limit(1))[0];
    if (existing) return { publicId: existing.publicId };
    const publicId = createPublicId("chat"); await db.insert(conversations).values({ publicId, kind: "direct", createdById: ctx.user.id });
    const conversation = (await db.select().from(conversations).where(eq(conversations.publicId, publicId)).limit(1))[0];
    if (!conversation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Conversation could not be created." });
    await db.insert(directConversations).values({ conversationId: conversation.id, memberOneId, memberTwoId });
    await db.insert(conversationMembers).values([{ conversationId: conversation.id, userId: ctx.user.id, role: "owner" }, { conversationId: conversation.id, userId: target.userId, role: "member" }]);
    return { publicId };
  }),

  createGroup: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(100), description: z.string().trim().max(500).nullable().optional(), usernames: z.array(username).min(1).max(99) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const targets = await Promise.all(input.usernames.filter(name => name !== "").map(getProfileByUsername)); const valid = targets.filter((item): item is Exclude<typeof item, undefined> => { if (!item) return false; return item.userId !== ctx.user.id; });
    if (valid.length !== new Set(input.usernames).size - (input.usernames.includes("") ? 1 : 0)) throw new TRPCError({ code: "NOT_FOUND", message: "One or more members are unavailable." });
    if (valid.some(target => target.allowMessages === "none")) throw new TRPCError({ code: "FORBIDDEN", message: "One or more members do not accept group invitations." });
    const publicId = createPublicId("group"); await db.insert(conversations).values({ publicId, kind: "group", title: input.title, description: input.description ?? null, createdById: ctx.user.id });
    const conversation = (await db.select().from(conversations).where(eq(conversations.publicId, publicId)).limit(1))[0];
    if (!conversation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Group could not be created." });
    await db.insert(conversationMembers).values([{ conversationId: conversation.id, userId: ctx.user.id, role: "owner" }, ...valid.map(target => ({ conversationId: conversation.id, userId: target.userId, role: "member" as const }))]);
    await db.insert(notifications).values(valid.map(target => ({ publicId: createPublicId("notice"), recipientId: target.userId, actorId: ctx.user.id, kind: "group_invite" as const, entityType: "conversation", entityPublicId: publicId })));
    return { publicId };
  }),

  listMessages: protectedProcedure.input(z.object({ conversationId, page: z.number().int().min(0).default(0), pageSize: z.number().int().min(1).max(50).default(30) })).query(async ({ ctx, input }) => {
    const db = await requireDb(); const current = await membership(db, input.conversationId, ctx.user.id); await touchPresence(db, ctx.user.id);
    const rows = await db.select({ message: messages, sender: profiles }).from(messages).innerJoin(profiles, eq(messages.senderId, profiles.userId)).where(eq(messages.conversationId, current.conversation.id)).orderBy(desc(messages.createdAt)).limit(input.pageSize).offset(input.page * input.pageSize);
    const ids = rows.map(row => row.message.id); const attachments = ids.length ? await db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, ids)) : []; const reactions = ids.length ? await db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids)) : []; const receipts = ids.length ? await db.select().from(messageReadReceipts).where(inArray(messageReadReceipts.messageId, ids)) : []; const deliveries = ids.length ? await db.select().from(messageDeliveries).where(inArray(messageDeliveries.messageId, ids)) : [];
    return rows.reverse().map(row => ({ ...row.message, sender: row.sender, attachments: attachments.filter(item => item.messageId === row.message.id), reactions: reactions.filter(item => item.messageId === row.message.id), readBy: receipts.filter(item => item.messageId === row.message.id).map(item => item.userId), deliveredTo: deliveries.filter(item => item.messageId === row.message.id).map(item => item.userId) }));
  }),

  send: protectedProcedure.input(z.object({ conversationId, body: z.string().trim().max(8000).nullable().optional(), uploadIds: z.array(z.string().min(8).max(32)).max(10).default([]), replyToId: messageId.nullable().optional(), forwardedFromId: messageId.nullable().optional() }).refine(input => Boolean(input.body?.trim() || input.uploadIds.length), { message: "A message requires text or an attachment." })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const current = await membership(db, input.conversationId, ctx.user.id); const uploads = input.uploadIds.length ? await db.select().from(mediaUploads).where(and(eq(mediaUploads.ownerId, ctx.user.id), inArray(mediaUploads.publicId, input.uploadIds))) : [];
    if (uploads.length !== input.uploadIds.length || uploads.some(upload => upload.attachedAt || !["message", "voice"].includes(upload.purpose))) throw new TRPCError({ code: "BAD_REQUEST", message: "One or more selected attachments are unavailable." });
    const replyTo = input.replyToId ? (await db.select().from(messages).where(and(eq(messages.publicId, input.replyToId), eq(messages.conversationId, current.conversation.id))).limit(1))[0] : undefined;
    const kind = uploads[0]?.mimeType.startsWith("image/") ? "image" : uploads[0]?.mimeType.startsWith("video/") ? "video" : uploads[0]?.mimeType.startsWith("audio/") ? "audio" : uploads.length ? "file" : "text";
    const publicId = createPublicId("msg"); await db.insert(messages).values({ publicId, conversationId: current.conversation.id, senderId: ctx.user.id, kind, body: input.body ?? null, replyToId: replyTo?.id, forwardedFromId: input.forwardedFromId ? (await db.select({ id: messages.id }).from(messages).where(eq(messages.publicId, input.forwardedFromId)).limit(1))[0]?.id : null });
    const sent = (await db.select().from(messages).where(eq(messages.publicId, publicId)).limit(1))[0]; if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Message could not be sent." });
    if (uploads.length) { await db.insert(messageAttachments).values(uploads.map(upload => ({ messageId: sent.id, kind: upload.mimeType.startsWith("image/") ? "image" as const : upload.mimeType.startsWith("video/") ? "video" as const : upload.mimeType.startsWith("audio/") ? "audio" as const : "file" as const, storageKey: upload.storageKey, url: upload.url, originalName: upload.originalName, mimeType: upload.mimeType, fileSize: upload.fileSize, durationMs: upload.durationMs }))); await db.update(mediaUploads).set({ attachedAt: new Date() }).where(inArray(mediaUploads.id, uploads.map(upload => upload.id))); }
    await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, current.conversation.id)); await db.update(conversationTyping).set({ expiresAt: new Date(0) }).where(and(eq(conversationTyping.conversationId, current.conversation.id), eq(conversationTyping.userId, ctx.user.id)));
    const recipients = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(and(eq(conversationMembers.conversationId, current.conversation.id), isNull(conversationMembers.leftAt)));
    const others = recipients.filter(member => member.userId !== ctx.user.id); if (others.length) { await db.insert(messageDeliveries).values(others.map(member => ({ messageId: sent.id, userId: member.userId }))); await db.insert(notifications).values(others.map(member => ({ publicId: createPublicId("notice"), recipientId: member.userId, actorId: ctx.user.id, kind: "message" as const, entityType: "conversation", entityPublicId: input.conversationId }))); }
    return { publicId };
  }),

  toggleReaction: protectedProcedure.input(z.object({ messageId, emoji: z.string().trim().min(1).max(32) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb(); const message = (await db.select().from(messages).where(eq(messages.publicId, input.messageId)).limit(1))[0]; if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "This message is unavailable." }); await membership(db, (await db.select({ publicId: conversations.publicId }).from(conversations).where(eq(conversations.id, message.conversationId)).limit(1))[0]!.publicId, ctx.user.id);
    const found = (await db.select().from(messageReactions).where(and(eq(messageReactions.messageId, message.id), eq(messageReactions.userId, ctx.user.id), eq(messageReactions.emoji, input.emoji))).limit(1))[0]; if (found) { await db.delete(messageReactions).where(eq(messageReactions.id, found.id)); return { added: false }; } await db.insert(messageReactions).values({ messageId: message.id, userId: ctx.user.id, emoji: input.emoji }); return { added: true };
  }),

  markRead: protectedProcedure.input(z.object({ conversationId, messageId })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = await membership(db, input.conversationId, ctx.user.id); const message = (await db.select().from(messages).where(and(eq(messages.publicId, input.messageId), eq(messages.conversationId, current.conversation.id))).limit(1))[0]; if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "This message is unavailable." }); await db.insert(messageReadReceipts).values({ messageId: message.id, userId: ctx.user.id }).onDuplicateKeyUpdate({ set: { readAt: new Date() } }); await db.update(conversationMembers).set({ lastReadMessageId: message.id }).where(eq(conversationMembers.id, current.member.id)); return { success: true } as const; }),

  typing: protectedProcedure.input(z.object({ conversationId, active: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = await membership(db, input.conversationId, ctx.user.id); await db.insert(conversationTyping).values({ conversationId: current.conversation.id, userId: ctx.user.id, expiresAt: input.active ? new Date(Date.now() + 8_000) : new Date(0) }).onDuplicateKeyUpdate({ set: { expiresAt: input.active ? new Date(Date.now() + 8_000) : new Date(0) } }); return { success: true } as const; }),
  typingMembers: protectedProcedure.input(z.object({ conversationId })).query(async ({ ctx, input }) => { const db = await requireDb(); const current = await membership(db, input.conversationId, ctx.user.id); return db.select({ profile: profiles }).from(conversationTyping).innerJoin(profiles, eq(conversationTyping.userId, profiles.userId)).where(and(eq(conversationTyping.conversationId, current.conversation.id), gt(conversationTyping.expiresAt, new Date()), sql`${conversationTyping.userId} != ${ctx.user.id}`)); }),

  deleteMessage: protectedProcedure.input(z.object({ messageId })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const message = (await db.select().from(messages).where(eq(messages.publicId, input.messageId)).limit(1))[0]; if (!message || message.senderId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete messages you sent." }); await db.update(messages).set({ deletedAt: new Date(), body: null }).where(eq(messages.id, message.id)); return { success: true } as const; }),
  search: protectedProcedure.input(z.object({ conversationId, query: z.string().trim().min(1).max(100) })).query(async ({ ctx, input }) => { const db = await requireDb(); const current = await membership(db, input.conversationId, ctx.user.id); return db.select({ message: messages, sender: profiles }).from(messages).innerJoin(profiles, eq(messages.senderId, profiles.userId)).where(and(eq(messages.conversationId, current.conversation.id), isNull(messages.deletedAt), like(messages.body, `%${input.query.replace(/[\\%_]/g, "\\$&")}%`))).orderBy(desc(messages.createdAt)).limit(50); }),

  addMember: protectedProcedure.input(z.object({ conversationId, username })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = await requireGroupManager(db, input.conversationId, ctx.user.id); const target = await getProfileByUsername(input.username); if (!target || await isBlockedEitherWay(ctx.user.id, target.userId)) throw new TRPCError({ code: "NOT_FOUND", message: "This member is unavailable." }); await db.insert(conversationMembers).values({ conversationId: current.conversation.id, userId: target.userId, role: "member" }).onDuplicateKeyUpdate({ set: { leftAt: null } }); await db.insert(notifications).values({ publicId: createPublicId("notice"), recipientId: target.userId, actorId: ctx.user.id, kind: "group_invite", entityType: "conversation", entityPublicId: input.conversationId }); return { success: true } as const; }),
  removeMember: protectedProcedure.input(z.object({ conversationId, username })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = await requireGroupManager(db, input.conversationId, ctx.user.id); const target = await getProfileByUsername(input.username); if (!target || target.userId === current.conversation.createdById) throw new TRPCError({ code: "FORBIDDEN", message: "The group owner cannot be removed." }); await db.update(conversationMembers).set({ leftAt: new Date() }).where(and(eq(conversationMembers.conversationId, current.conversation.id), eq(conversationMembers.userId, target.userId))); return { success: true } as const; }),
  leave: protectedProcedure.input(z.object({ conversationId })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = await membership(db, input.conversationId, ctx.user.id); if (current.conversation.kind === "direct") throw new TRPCError({ code: "BAD_REQUEST", message: "Direct conversations cannot be left." }); if (current.member.role === "owner") throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer ownership before leaving this group." }); await db.update(conversationMembers).set({ leftAt: new Date() }).where(eq(conversationMembers.id, current.member.id)); return { success: true } as const; }),
});
