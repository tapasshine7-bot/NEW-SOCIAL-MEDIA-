import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { profiles, type Profile, users } from "../../drizzle/schema";
import { getDb } from "../db";

export function createPublicId(prefix: string) {
  return `${prefix}_${nanoid(16)}`;
}

export function createProfileUsername(seed?: string | null) {
  const stem = (seed ?? "member")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18) || "member";
  return `${stem}_${nanoid(7).toLowerCase()}`;
}

export async function ensureProfileForUser(userId: number): Promise<Profile | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const current = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (current[0]) return current[0];

  const identity = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = identity[0];
  if (!user) return undefined;

  const username = createProfileUsername(user.name || user.email?.split("@")[0]);
  await db.insert(profiles).values({
    publicId: createPublicId("usr"),
    userId,
    username,
    displayName: user.name?.slice(0, 80) || "New member",
  });

  return (await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1))[0];
}

export async function getProfileByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(profiles).where(eq(profiles.username, username)).limit(1))[0];
}

export async function getProfileForUser(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1))[0];
}

export async function isBlockedEitherWay(firstUserId: number, secondUserId: number) {
  const db = await getDb();
  if (!db) return false;
  const { blocks } = await import("../../drizzle/schema");
  const records = await db.select().from(blocks).where(
    and(eq(blocks.blockerId, firstUserId), eq(blocks.blockedId, secondUserId)),
  ).limit(1);
  if (records.length) return true;
  const reverse = await db.select().from(blocks).where(
    and(eq(blocks.blockerId, secondUserId), eq(blocks.blockedId, firstUserId)),
  ).limit(1);
  return reverse.length > 0;
}
