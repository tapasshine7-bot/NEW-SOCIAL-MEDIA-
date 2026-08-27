import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function authenticatedContext(): TrpcContext { return { user: { id: 1, openId: "member-1", name: "Member", email: "member@example.com", loginMethod: "manus", role: "user", accountStatus: "active", emailVerifiedAt: null, suspendedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }
describe("onboarding validation", () => { it("requires a valid username and at least one selected interest", async () => { const caller = appRouter.createCaller(authenticatedContext()); await expect(caller.account.completeOnboarding({ displayName: "Member", username: "invalid username", interests: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" }); }); });
