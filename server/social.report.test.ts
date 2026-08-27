import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const values = vi.fn();
  const insert = vi.fn(() => ({ values }));
  return { db: { select, insert }, getDb: vi.fn(), select, insert, values, limit };
});

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./db/social", () => ({
  createPublicId: vi.fn(() => "report_secureid"),
  getProfileByUsername: vi.fn(),
  isBlockedEitherWay: vi.fn(),
}));

import { socialRouter } from "./routers/social";

function authenticatedContext(): TrpcContext {
  return { user: { id: 1, openId: "member-1", name: "Member", email: "member@example.com", loginMethod: "manus", role: "user", accountStatus: "active", emailVerifiedAt: null, suspendedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("social report workflow", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getDb.mockResolvedValue(mocks.db); mocks.limit.mockResolvedValueOnce([{ id: 42, publicId: "post_focused" }]).mockResolvedValueOnce([]); });

  it("persists a unique open report against an existing post", async () => {
    const caller = socialRouter.createCaller(authenticatedContext());
    await expect(caller.reportPost({ postId: "post_focused", reason: "harassment", details: "Context for review." })).resolves.toEqual({ success: true });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ reporterId: 1, targetType: "post", targetId: 42, reason: "harassment" }));
  });
});
