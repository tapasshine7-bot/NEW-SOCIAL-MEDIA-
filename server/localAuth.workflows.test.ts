import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), createSessionToken: vi.fn(), insert: vi.fn(), select: vi.fn(), update: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: mocks.createSessionToken } }));
import { localAuthRouter, hashPassword } from "./routers/localAuth";

function context() { const cookies: Array<{ name: string; value: string }> = []; return { cookies, ctx: { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { cookie: (name: string, value: string) => cookies.push({ name, value }) } as TrpcContext["res"] } }; }
describe("local account workflows", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.createSessionToken.mockResolvedValue("signed-local-session"); });
  it("registers a member identity and issues their protected session cookie", async () => {
    const userValues = vi.fn().mockResolvedValue([{ insertId: 42 }]); const identityValues = vi.fn().mockResolvedValue(undefined);
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })), insert: mocks.insert.mockReturnValueOnce({ values: userValues }).mockReturnValueOnce({ values: identityValues }) });
    const run = context(); const result = await localAuthRouter.createCaller(run.ctx).register({ displayName: "New Member", email: "member@example.com", password: "secure1pass" });
    expect(result.success).toBe(true); expect(userValues).toHaveBeenCalledWith(expect.objectContaining({ email: "member@example.com", loginMethod: "email" })); expect(identityValues).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, provider: "email_password", providerAccountId: "member@example.com" })); expect(run.cookies).toEqual([{ name: COOKIE_NAME, value: "signed-local-session" }]);
  });
  it("rejects a duplicate email before storing a password", async () => {
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ id: 1 }]) })) })) })) });
    await expect(localAuthRouter.createCaller(context().ctx).register({ displayName: "Member", email: "member@example.com", password: "secure1pass" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("does not issue a session for an invalid password", async () => {
    const hash = await hashPassword("secure1pass"); const user = { id: 7, openId: "local_member", name: "Member", accountStatus: "active" };
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ user, identity: { passwordHash: hash } }]) })) })) })) })) });
    await expect(localAuthRouter.createCaller(context().ctx).signIn({ email: "member@example.com", password: "not-the-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(mocks.createSessionToken).not.toHaveBeenCalled();
  });
  it("signs in a valid local member and issues the same protected session cookie", async () => {
    const hash = await hashPassword("secure1pass"); const user = { id: 7, openId: "local_member", name: "Member", accountStatus: "active" }; const lastSignedInSet = vi.fn(() => ({ where: vi.fn() }));
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ user, identity: { passwordHash: hash } }]) })) })) })) })), update: vi.fn(() => ({ set: lastSignedInSet })) });
    const run = context(); await expect(localAuthRouter.createCaller(run.ctx).signIn({ email: "member@example.com", password: "secure1pass" })).resolves.toMatchObject({ success: true, user: { openId: "local_member" } }); expect(lastSignedInSet).toHaveBeenCalled(); expect(run.cookies).toEqual([{ name: COOKIE_NAME, value: "signed-local-session" }]);
  });
});
