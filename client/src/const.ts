export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Shared entry point for protected-screen calls to action. It deliberately
// routes to the normal email-and-password sign-in screen used throughout Nuvora.
export const startLogin = () => {
  window.location.assign("/login");
};
