import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./routers/localAuth";
describe("local credential hashing", () => { it("stores salted hashes and only verifies the matching password", async () => { const first = await hashPassword("strongpass123"); const second = await hashPassword("strongpass123"); expect(first).not.toBe(second); await expect(verifyPassword("strongpass123", first)).resolves.toBe(true); await expect(verifyPassword("wrongpass123", first)).resolves.toBe(false); }); });
