import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ ensureProfileForUser: vi.fn() }));
vi.mock("./db/social", async importOriginal => ({ ...(await importOriginal<typeof import("./db/social")>()), ensureProfileForUser: mocks.ensureProfileForUser }));
import { appRouter } from "./routers";

describe("local account data linkage", () => {
  it("returns the same local member identity and profile through protected account access", async () => {
    const profile = { id: 16, publicId: "usr_local", userId: 42, username: "local_member", displayName: "Local Member" };
    mocks.ensureProfileForUser.mockResolvedValue(profile);
    const user = { id: 42, openId: "local_abc123", name: "Local Member", email: "member@example.com", loginMethod: "email", role: "user" as const, accountStatus: "active" as const, emailVerifiedAt: null, suspendedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const ctx: TrpcContext = { user, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.me()).resolves.toMatchObject({ id: 42, openId: "local_abc123", loginMethod: "email" });
    await expect(caller.account.me()).resolves.toMatchObject({ user: { id: 42 }, profile: { userId: 42, username: "local_member" } });
    expect(mocks.ensureProfileForUser).toHaveBeenCalledWith(42);
  });
});
