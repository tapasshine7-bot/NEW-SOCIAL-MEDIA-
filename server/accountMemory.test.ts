import { beforeEach, describe, expect, it } from "vitest";
import { rememberAccount, rememberedAccounts, setLoginPrefillEmail, takeLoginPrefillEmail } from "../client/src/lib/accountMemory";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

describe("private device account memory", () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.assign(globalThis, { window: { localStorage, sessionStorage } });
  });

  it("retains only account metadata and consumes a selected login prefill once", () => {
    rememberAccount({ displayName: "Ari", email: "ari@example.com" });
    setLoginPrefillEmail(" ARI@EXAMPLE.COM ");

    expect(rememberedAccounts()).toMatchObject([{ displayName: "Ari", email: "ari@example.com" }]);
    expect(takeLoginPrefillEmail()).toBe("ari@example.com");
    expect(takeLoginPrefillEmail()).toBe("");
    expect(JSON.stringify(rememberedAccounts())).not.toContain("password");
  });
});
