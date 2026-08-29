import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { lifeItems, studyItems } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { createPublicId } from "../db/social";

async function requireDb() { const db = await getDb(); if (!db) throw new Error("Workspace database is temporarily unavailable."); return db; }
const title = z.string().trim().min(1).max(180);
const publicId = z.string().min(8).max(32);

export const workspaceRouter = router({
  life: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select().from(lifeItems).where(eq(lifeItems.userId, ctx.user.id)).orderBy(desc(lifeItems.dueAt), desc(lifeItems.createdAt)); }),
    create: protectedProcedure.input(z.object({ title, category: z.string().trim().max(40).default("other"), notes: z.string().trim().max(4000).nullable().optional(), dueAt: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const id = createPublicId("life"); await db.insert(lifeItems).values({ publicId: id, userId: ctx.user.id, title: input.title, category: input.category, notes: input.notes ?? null, dueAt: input.dueAt ?? null }); return { publicId: id }; }),
    toggle: protectedProcedure.input(z.object({ publicId, completed: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); await db.update(lifeItems).set({ completed: input.completed }).where(and(eq(lifeItems.publicId, input.publicId), eq(lifeItems.userId, ctx.user.id))); return { success: true as const }; }),
    remove: protectedProcedure.input(z.object({ publicId })).mutation(async ({ ctx, input }) => { const db = await requireDb(); await db.delete(lifeItems).where(and(eq(lifeItems.publicId, input.publicId), eq(lifeItems.userId, ctx.user.id))); return { success: true as const }; }),
  }),
  study: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select().from(studyItems).where(eq(studyItems.userId, ctx.user.id)).orderBy(desc(studyItems.dueAt), desc(studyItems.createdAt)); }),
    create: protectedProcedure.input(z.object({ title, kind: z.string().trim().max(40).default("task"), notes: z.string().trim().max(4000).nullable().optional(), dueAt: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const id = createPublicId("study"); await db.insert(studyItems).values({ publicId: id, userId: ctx.user.id, title: input.title, kind: input.kind, notes: input.notes ?? null, dueAt: input.dueAt ?? null }); return { publicId: id }; }),
    toggle: protectedProcedure.input(z.object({ publicId, completed: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); await db.update(studyItems).set({ completed: input.completed, progress: input.completed ? 100 : 0 }).where(and(eq(studyItems.publicId, input.publicId), eq(studyItems.userId, ctx.user.id))); return { success: true as const }; }),
    remove: protectedProcedure.input(z.object({ publicId })).mutation(async ({ ctx, input }) => { const db = await requireDb(); await db.delete(studyItems).where(and(eq(studyItems.publicId, input.publicId), eq(studyItems.userId, ctx.user.id))); return { success: true as const }; }),
  }),
});
