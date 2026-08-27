import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("admin authorization", () => {
  it("rejects a standard member before an administration query accesses data", async () => {
    const ctx: TrpcContext = { user: { id: 9, openId: "member", name: "Member", email: "member@example.com", loginMethod: "manus", role: "user", accountStatus: "active", emailVerifiedAt: null, suspendedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
