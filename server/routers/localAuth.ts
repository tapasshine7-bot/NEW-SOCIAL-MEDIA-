import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { accountIdentities, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";

const scrypt = promisify(nodeScrypt);
const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(6, "Use at least 6 characters.").max(12, "Use no more than 12 characters.").refine(value => /[A-Za-z]/.test(value) && /\d/.test(value), "Use at least one letter and one number.");
const localProvider = "email_password";
const SHORT_SESSION_MS = 24 * 60 * 60 * 1000;

export async function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); const derived = await scrypt(password, salt, 64) as Buffer; return `scrypt$${salt}$${derived.toString("hex")}`; }
export async function verifyPassword(password: string, encoded: string) { const [scheme, salt, digest] = encoded.split("$"); if (scheme !== "scrypt" || !salt || !digest) return false; const expected = Buffer.from(digest, "hex"); const derived = await scrypt(password, salt, 64) as Buffer; return expected.length === derived.length && timingSafeEqual(expected, derived); }
async function requireDb() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is temporarily unavailable." }); return db; }
async function issueSession(ctx: { res: any; req: any }, user: { openId: string; name: string | null }, rememberMe = false) { const expiresInMs = rememberMe ? ONE_YEAR_MS : SHORT_SESSION_MS; const token = await sdk.createSessionToken(user.openId, { name: user.name || "Member", expiresInMs }); const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: expiresInMs }); }

export const localAuthRouter = router({
  register: publicProcedure.input(z.object({ displayName: z.string().trim().min(1).max(80), email: emailSchema, password: passwordSchema })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const existing = (await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1))[0];
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with that email already exists. Please sign in instead." });
    const openId = `local_${randomUUID().replaceAll("-", "")}`;
    const passwordHash = await hashPassword(input.password);
    try {
      const transaction = typeof (db as any).transaction === "function" ? (db as any).transaction.bind(db) : async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db);
      const user = await transaction(async (tx: typeof db) => {
        const inserted = await tx.insert(users).values({ openId, name: input.displayName, email: input.email, loginMethod: "email", lastSignedIn: new Date() });
        const userId = Number(inserted[0].insertId);
        await tx.insert(accountIdentities).values({ userId, provider: localProvider, providerAccountId: input.email, passwordHash });
        return { openId, name: input.displayName };
      });
      await issueSession(ctx, user);
      return { success: true, user } as const;
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "An account with that email already exists. Please sign in instead." });
      throw error;
    }
  }),
  signIn: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1).max(128), rememberMe: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const row = (await db.select({ user: users, identity: accountIdentities }).from(accountIdentities).innerJoin(users, eq(accountIdentities.userId, users.id)).where(and(eq(accountIdentities.provider, localProvider), eq(accountIdentities.providerAccountId, input.email))).limit(1))[0];
    if (!row?.identity.passwordHash || !(await verifyPassword(input.password, row.identity.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
    if (row.user.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "This account is unavailable." });
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, row.user.id));
    await issueSession(ctx, row.user, input.rememberMe);
    return { success: true, user: { openId: row.user.openId, name: row.user.name } } as const;
  }),
});
