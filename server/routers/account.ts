import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { blocks, profiles, users } from "../../drizzle/schema";
import { ensureProfileForUser, getProfileByUsername, getProfileForUser } from "../db/social";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 lowercase letters, numbers, or underscores.");
const privacySchema = z.enum(["everyone", "followers", "none"]);
const reservedUsernames = new Set(["admin", "administrator", "api", "explore", "home", "login", "messages", "notifications", "profile", "reels", "settings", "stories", "support"]);

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The service is temporarily unavailable. Please try again." });
  return db;
}

export const accountRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ensureProfileForUser(ctx.user.id);
    if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Your profile could not be prepared. Please try again." });
    return { user: ctx.user, profile };
  }),

  byUsername: publicProcedure.input(z.object({ username: usernameSchema })).query(async ({ input }) => {
    const profile = await getProfileByUsername(input.username);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "This profile is unavailable." });
    return profile;
  }),

  usernameAvailability: publicProcedure.input(z.object({ username: z.string().trim().toLowerCase().max(30) })).query(async ({ input }) => {
    if (!/^[a-z0-9_]{3,30}$/.test(input.username)) return { available: false, reason: "Use 3–30 lowercase letters, numbers, or underscores." };
    if (reservedUsernames.has(input.username)) return { available: false, reason: "That username is reserved." };
    const db = await requireDatabase();
    const existing = (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, input.username)).limit(1))[0];
    return existing ? { available: false, reason: "That username is already taken." } : { available: true, reason: "Username available." };
  }),

  completeOnboarding: protectedProcedure.input(z.object({ displayName: z.string().trim().min(1).max(80), username: usernameSchema, interests: z.array(z.string().trim().min(1).max(40)).min(1).max(12) })).mutation(async ({ ctx, input }) => {
    if (reservedUsernames.has(input.username)) throw new TRPCError({ code: "BAD_REQUEST", message: "That username is reserved." });
    const db = await requireDatabase();
    const existing = (await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.username, input.username)).limit(1))[0];
    if (existing && existing.userId !== ctx.user.id) throw new TRPCError({ code: "CONFLICT", message: "That username is already taken." });
    await ensureProfileForUser(ctx.user.id);
    await db.update(profiles).set({ displayName: input.displayName, username: input.username, interests: JSON.stringify(input.interests), onboardingCompletedAt: new Date() }).where(eq(profiles.userId, ctx.user.id));
    return getProfileForUser(ctx.user.id);
  }),

  updateProfile: protectedProcedure.input(z.object({
    username: usernameSchema.optional(),
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: z.string().trim().max(220).nullable().optional(),
    website: z.string().trim().url("Enter a complete website URL.").max(500).nullable().optional(),
  }).refine(values => Object.keys(values).length > 0, "Provide at least one profile field.")).mutation(async ({ ctx, input }) => {
    const db = await requireDatabase();
    const profile = await ensureProfileForUser(ctx.user.id);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Profile unavailable." });

    if (input.username && input.username !== profile.username) {
      const clash = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.username, input.username), ne(profiles.userId, ctx.user.id))).limit(1);
      if (clash[0]) throw new TRPCError({ code: "CONFLICT", message: "That username is already in use." });
    }

    await db.update(profiles).set(input).where(eq(profiles.userId, ctx.user.id));
    return getProfileForUser(ctx.user.id);
  }),

  updatePrivacy: protectedProcedure.input(z.object({
    isPrivate: z.boolean().optional(),
    allowMessages: privacySchema.optional(),
    allowMentions: privacySchema.optional(),
    showActivityStatus: z.boolean().optional(),
    readReceipts: z.boolean().optional(),
    storyVisibility: privacySchema.optional(),
  }).refine(values => Object.keys(values).length > 0, "Provide at least one privacy setting.")).mutation(async ({ ctx, input }) => {
    const db = await requireDatabase();
    await ensureProfileForUser(ctx.user.id);
    await db.update(profiles).set(input).where(eq(profiles.userId, ctx.user.id));
    return getProfileForUser(ctx.user.id);
  }),

  block: protectedProcedure.input(z.object({ username: usernameSchema })).mutation(async ({ ctx, input }) => {
    const db = await requireDatabase();
    const target = await getProfileByUsername(input.username);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "That member could not be found." });
    if (target.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot block your own account." });
    await db.insert(blocks).values({ blockerId: ctx.user.id, blockedId: target.userId }).onDuplicateKeyUpdate({ set: { blockerId: ctx.user.id } });
    return { success: true } as const;
  }),

  unblock: protectedProcedure.input(z.object({ username: usernameSchema })).mutation(async ({ ctx, input }) => {
    const db = await requireDatabase();
    const target = await getProfileByUsername(input.username);
    if (!target) return { success: true } as const;
    await db.delete(blocks).where(and(eq(blocks.blockerId, ctx.user.id), eq(blocks.blockedId, target.userId)));
    return { success: true } as const;
  }),

  blocked: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDatabase();
    return db.select({ username: profiles.username, displayName: profiles.displayName, publicId: profiles.publicId })
      .from(blocks)
      .innerJoin(profiles, eq(blocks.blockedId, profiles.userId))
      .where(eq(blocks.blockerId, ctx.user.id));
  }),

  requestDeletion: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE") })).mutation(async ({ ctx }) => {
    const db = await requireDatabase();
    await db.update(users).set({ accountStatus: "deleted", deletedAt: new Date() }).where(eq(users.id, ctx.user.id));
    await db.update(profiles).set({ displayName: "Deleted member", isPrivate: true, showActivityStatus: false }).where(eq(profiles.userId, ctx.user.id));
    return { success: true, message: "Your account has been scheduled for deletion." } as const;
  }),
});
