# Luma

**Luma** is a mobile-first social and messaging PWA built with React, TypeScript, Express, tRPC, Drizzle ORM, MySQL-compatible storage, Manus OAuth, and S3-compatible object storage.

## Product scope

The implementation includes protected identity profiles, privacy and blocking controls, follows and follow requests, storage-backed post publishing, engagement, persistent stories with an automatic 24-hour expiry boundary, Explore search, short-video interactions, persistent direct and group conversations, voice-note capture where the browser supports it, delivery and read state, polling-based typing and presence states, notification persistence, PWA install/offline support, and protected moderation workflows.

## Architecture

| Layer | Responsibility |
|---|---|
| React + Tailwind | Responsive public pages, member workspace, bottom navigation, themes, accessibility states, and PWA client experience. |
| tRPC + Express | Typed public/protected/admin procedures, validated inputs, authorization boundaries, and scheduled cleanup endpoints. |
| Drizzle + MySQL | Normalized relational records for identity, profiles, social graph, content, stories, messages, receipts, notifications, reports, and moderation state. |
| Object storage | Original media bytes only; the database stores URLs, object keys, ownership, types, size, and attachment metadata. |

## Local development

Install dependencies with `pnpm install`, then start the application with `pnpm dev`. Run `pnpm test` for the Vitest suite and `pnpm check` for TypeScript checking.

Database changes follow the sequence: update `drizzle/schema.ts`; run `pnpm drizzle-kit generate`; review the generated SQL migration; then apply it through the managed database workflow. Never edit production schemas manually.

## Environment

The managed environment provides `DATABASE_URL`, `JWT_SECRET`, OAuth variables, and S3-compatible storage helpers. Do not commit `.env` files. Future passwordless-email or external identity support should use the `account_identities` table and server-managed secrets. Browser push subscriptions are stored as integration points in `user_devices`; a production push provider still requires its own server-side credentials and delivery service.

## Media constraints

Only supported image, video, audio, and document types are accepted. Upload ownership and purpose are validated before attachments are created. Raw media is held in object storage, never database BLOB columns. The current upload path is appropriate for MVP-sized files; use direct signed object-storage uploads and background transcoding for larger production media.

## Scheduled story cleanup

Story reads enforce `expiresAt` in every user-facing query. The protected `/api/scheduled/expire-stories` endpoint soft-deletes expired stories for cleanup and audit consistency. After publishing the app, register a managed scheduled HTTP POST using the platform scheduler; the endpoint accepts only authenticated scheduled requests.

## Deployment

Create a checkpoint, then use the managed Publish control. The current build is compatible with autoscaling HTTP hosting. Conversation updates use resilient polling and database-persisted typing/presence state; if sub-second bidirectional socket delivery becomes a product requirement, use a managed realtime service or select persistent reserved hosting after evaluating its cost and operational tradeoffs.

## Development seed gate

`server/seed-dev.mjs` refuses to run unless both `NODE_ENV=development` and `ALLOW_DEV_SEED=true` are explicitly set. It is a safe place for local fixtures only. Never use it in production or to invent reviews, ratings, or testimonials.
