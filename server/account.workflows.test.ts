import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => {
  const where = vi.fn();
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const insertValues = vi.fn(() => ({ onDuplicateKeyUpdate: vi.fn() }));
  return {
    db: { update, select: vi.fn(), insert: vi.fn(() => ({ values: insertValues })), delete: vi.fn(() => ({ where })) },
    where, set, update, insertValues,
    ensureProfileForUser: vi.fn(), getProfileForUser: vi.fn(), getProfileByUsername: vi.fn(), getDb: vi.fn(),
  };
});

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./db/social", () => ({
  ensureProfileForUser: mocks.ensureProfileForUser,
  getProfileForUser: mocks.getProfileForUser,
  getProfileByUsername: mocks.getProfileByUsername,
}));

import { accountRouter } from "./routers/account";

const profile = {
  id: 8, publicId: "usr_demo", userId: 1, username: "luma_member", displayName: "Luma Member", bio: null, website: null, avatarKey: null, avatarUrl: null,
  isPrivate: false, allowMessages: "everyone" as const, allowMentions: "everyone" as const, showActivityStatus: true, readReceipts: true, storyVisibility: "everyone" as const,
  followersCount: 0, followingCount: 0, postsCount: 0, createdAt: new Date(), updatedAt: new Date(),
};

function authenticatedContext(): TrpcContext {
  return {
    user: { id: 1, openId: "member-1", name: "Member", email: "member@example.com", loginMethod: "manus", role: "user", accountStatus: "active", emailVerifiedAt: null, suspendedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("account workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(mocks.db);
    mocks.ensureProfileForUser.mockResolvedValue(profile);
    mocks.getProfileForUser.mockResolvedValue(profile);
  });

  it("persists a validated privacy preference for the authenticated member", async () => {
    const caller = accountRouter.createCaller(authenticatedContext());
    await caller.updatePrivacy({ allowMessages: "followers", readReceipts: false });
    expect(mocks.set).toHaveBeenCalledWith({ allowMessages: "followers", readReceipts: false });
    expect(mocks.where).toHaveBeenCalledTimes(1);
  });

  it("persists a profile edit for the signed-in member", async () => {
    const caller = accountRouter.createCaller(authenticatedContext());
    await caller.updateProfile({ displayName: "Updated member", bio: "A concise member bio." });
    expect(mocks.set).toHaveBeenCalledWith({ displayName: "Updated member", bio: "A concise member bio." });
  });

  it("blocks another member through the authenticated account context", async () => {
    mocks.getProfileByUsername.mockResolvedValue({ ...profile, userId: 2, username: "another_member" });
    const caller = accountRouter.createCaller(authenticatedContext());
    await expect(caller.block({ username: "another_member" })).resolves.toEqual({ success: true });
    expect(mocks.insertValues).toHaveBeenCalledWith({ blockerId: 1, blockedId: 2 });
  });

  it("removes a block owned by the signed-in member", async () => {
    mocks.getProfileByUsername.mockResolvedValue({ ...profile, userId: 2, username: "another_member" });
    const caller = accountRouter.createCaller(authenticatedContext());
    await expect(caller.unblock({ username: "another_member" })).resolves.toEqual({ success: true });
    expect(mocks.db.delete).toHaveBeenCalledTimes(1);
  });

  it("marks an account deleted only after the exact confirmation token", async () => {
    const caller = accountRouter.createCaller(authenticatedContext());
    await expect(caller.requestDeletion({ confirmation: "DELETE" })).resolves.toMatchObject({ success: true });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    await expect(caller.requestDeletion({ confirmation: "delete" as "DELETE" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
