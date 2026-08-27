import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function authenticatedContext(): TrpcContext {
  return { user: { id: 1, openId: "member-1", name: "Member", email: "member@example.com", loginMethod: "manus", role: "user", accountStatus: "active", emailVerifiedAt: null, suspendedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("messaging validation", () => {
  it("does not accept a direct-message username outside the safe member format", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.messages.startDirect({ username: "not a valid username" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("requires at least one valid named member to create a group", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.messages.createGroup({ title: "Project room", usernames: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects empty messages before touching conversation state", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.messages.send({ conversationId: "chat_12345", body: null, uploadIds: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
