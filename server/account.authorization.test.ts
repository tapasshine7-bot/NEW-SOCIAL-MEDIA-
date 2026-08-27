import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonymousContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("account authorization", () => {
  it("rejects profile access without an authenticated session", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.account.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
