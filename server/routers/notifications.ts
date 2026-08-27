import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { notifications, profiles, userDevices } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDb() { const db = await getDb(); if (!db) throw new Error("Notifications are temporarily unavailable."); return db; }
export const notificationsRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().int().min(0).default(0), pageSize: z.number().int().min(1).max(50).default(30) }).optional()).query(async ({ ctx, input }) => { const db = await requireDb(); const page = input?.page ?? 0; const pageSize = input?.pageSize ?? 30; return db.select({ notification: notifications, actor: profiles }).from(notifications).leftJoin(profiles, eq(notifications.actorId, profiles.userId)).where(eq(notifications.recipientId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(pageSize).offset(page * pageSize); }),
  markRead: protectedProcedure.input(z.object({ ids: z.array(z.string().min(8).max(32)).min(1).max(100) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.recipientId, ctx.user.id), inArray(notifications.publicId, input.ids))); return { success: true } as const; }),
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => { const db = await requireDb(); await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.recipientId, ctx.user.id), isNull(notifications.readAt))); return { success: true } as const; }),
  registerDevice: protectedProcedure.input(z.object({ deviceId: z.string().min(12).max(128), platform: z.string().max(50), pushEndpoint: z.string().url().max(2048).nullable().optional(), pushSubscription: z.record(z.string(), z.unknown()).nullable().optional() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); await db.insert(userDevices).values({ userId: ctx.user.id, deviceId: input.deviceId, platform: input.platform, pushEndpoint: input.pushEndpoint ?? null, pushSubscription: input.pushSubscription ?? null, lastSeenAt: new Date() }).onDuplicateKeyUpdate({ set: { userId: ctx.user.id, platform: input.platform, pushEndpoint: input.pushEndpoint ?? null, pushSubscription: input.pushSubscription ?? null, lastSeenAt: new Date() } }); return { success: true } as const; }),
});
