import { describe, expect, it } from "vitest";
import { isAllowedStorageKey } from "./_core/storageProxy";

describe("storage proxy key policy", () => {
  it("allows only server-generated member media and generated image keys", () => {
    expect(isAllowedStorageKey("members/42/avatar/media_abc.png")).toBe(true);
    expect(isAllowedStorageKey("members/42/message/media_abc.pdf")).toBe(true);
    expect(isAllowedStorageKey("generated/1760000000000.png")).toBe(true);
  });

  it("rejects traversal, absolute, and arbitrary storage paths", () => {
    expect(isAllowedStorageKey("../secrets.env")).toBe(false);
    expect(isAllowedStorageKey("members/42/../../secrets.env")).toBe(false);
    expect(isAllowedStorageKey("/members/42/avatar/media_abc.png")).toBe(false);
    expect(isAllowedStorageKey("private/secret.txt")).toBe(false);
    expect(isAllowedStorageKey("members/0/avatar/media_abc.png")).toBe(false);
  });
});
