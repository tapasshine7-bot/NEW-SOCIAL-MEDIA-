/**
 * Development-only data seeding entry point.
 * It intentionally refuses to run unless NODE_ENV is development and ALLOW_DEV_SEED=true.
 * Use OAuth to create actual account identities first; this script must never run in production.
 */
if (process.env.NODE_ENV !== "development" || process.env.ALLOW_DEV_SEED !== "true") {
  throw new Error("Development seed is disabled. Set NODE_ENV=development and ALLOW_DEV_SEED=true locally.");
}
console.log("Seed gate passed. Add local-only development fixtures here; do not run this script against production data.");
