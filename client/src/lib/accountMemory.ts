export type RememberedAccount = { email: string; displayName: string; lastUsedAt: number };
const key = "nuvora.remembered-accounts";
const loginPrefillKey = "nuvora.login-email-prefill";
export function rememberedAccounts(): RememberedAccount[] { try { const parsed = JSON.parse(window.localStorage.getItem(key) || "[]"); return Array.isArray(parsed) ? parsed.filter(item => typeof item?.email === "string" && typeof item?.displayName === "string").slice(0, 5) : []; } catch { return []; } }
export function rememberAccount(account: Omit<RememberedAccount, "lastUsedAt">) { const updated = [{ ...account, lastUsedAt: Date.now() }, ...rememberedAccounts().filter(item => item.email !== account.email)].slice(0, 5); window.localStorage.setItem(key, JSON.stringify(updated)); return updated; }
export function setLoginPrefillEmail(email: string) { try { window.sessionStorage.setItem(loginPrefillKey, email.trim().toLowerCase()); } catch { /* Private-mode storage failure should not block account switching. */ } }
export function takeLoginPrefillEmail() { try { const email = window.sessionStorage.getItem(loginPrefillKey) || ""; window.sessionStorage.removeItem(loginPrefillKey); return email; } catch { return ""; } }
