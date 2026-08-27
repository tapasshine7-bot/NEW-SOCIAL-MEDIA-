import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function authenticatedContext(): TrpcContext {
  return {
    user: { id: 1, openId: "member-1", name: "Member", email: "member@example.com", loginMethod: "manus", role: "user", accountStatus: "active", emailVerifiedAt: null, suspendedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("social validation", () => {
  it("does not allow a post with no authenticated upload assets", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.social.createPost({ uploadIds: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects unsafe usernames before a follow request reaches the database", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.social.follow({ username: "not valid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects malformed encoded uploads before attempting storage access", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.uploads.create({ purpose: "avatar", originalName: "portrait.png", mimeType: "image/png", dataBase64: "!invalid!" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
