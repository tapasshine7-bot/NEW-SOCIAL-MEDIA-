import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const userRoles = ["user", "admin"] as const;
const accountStates = ["active", "suspended", "banned", "deleted"] as const;
const privacyChoices = ["everyone", "followers", "none"] as const;
const followRequestStates = ["pending", "approved", "rejected", "cancelled"] as const;
const mediaKinds = ["image", "video", "audio", "file"] as const;
const postStates = ["published", "archived", "removed"] as const;
const conversationKinds = ["direct", "group"] as const;
const membershipRoles = ["member", "admin", "owner"] as const;
const messageKinds = ["text", "image", "video", "audio", "file", "system"] as const;
const reportTargets = ["user", "post", "comment", "message", "story"] as const;
const reportStates = ["open", "reviewing", "resolved", "dismissed"] as const;
const reportReasons = ["spam", "harassment", "impersonation", "inappropriate", "violence", "other"] as const;
const notificationKinds = [
  "like",
  "comment",
  "follow",
  "follow_request",
  "follow_approved",
  "story_reply",
  "message",
  "mention",
  "group_invite",
  "system",
] as const;
const uploadPurposes = ["avatar", "post", "story", "message", "voice", "video"] as const;

/** Core identity table synchronized by the Manus OAuth session flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", userRoles).default("user").notNull(),
  accountStatus: mysqlEnum("accountStatus", accountStates).default("active").notNull(),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  suspendedAt: timestamp("suspendedAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Profile and privacy controls are separated from the identity row. */
export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  username: varchar("username", { length: 30 }).notNull(),
  displayName: varchar("displayName", { length: 80 }).notNull(),
  bio: varchar("bio", { length: 220 }),
  website: varchar("website", { length: 500 }),
  avatarKey: varchar("avatarKey", { length: 512 }),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  isPrivate: boolean("isPrivate").default(false).notNull(),
  allowMessages: mysqlEnum("allowMessages", privacyChoices).default("everyone").notNull(),
  allowMentions: mysqlEnum("allowMentions", privacyChoices).default("everyone").notNull(),
  showActivityStatus: boolean("showActivityStatus").default(true).notNull(),
  readReceipts: boolean("readReceipts").default(true).notNull(),
  storyVisibility: mysqlEnum("storyVisibility", privacyChoices).default("everyone").notNull(),
  followersCount: int("followersCount").default(0).notNull(),
  followingCount: int("followingCount").default(0).notNull(),
  postsCount: int("postsCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("profiles_public_id_unique").on(table.publicId),
  uniqueIndex("profiles_user_id_unique").on(table.userId),
  uniqueIndex("profiles_username_unique").on(table.username),
]);

/** Reserved for future password, magic-link, or third-party identity providers. */
export const accountIdentities = mysqlTable("account_identities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 48 }).notNull(),
  providerAccountId: varchar("providerAccountId", { length: 320 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("account_identities_provider_account_unique").on(table.provider, table.providerAccountId),
  index("account_identities_user_idx").on(table.userId),
]);

export const follows = mysqlTable("follows", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("followerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: int("followingId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("follows_pair_unique").on(table.followerId, table.followingId),
  index("follows_following_idx").on(table.followingId, table.createdAt),
]);

export const followRequests = mysqlTable("follow_requests", {
  id: int("id").autoincrement().primaryKey(),
  requesterId: int("requesterId").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: int("recipientId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", followRequestStates).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("follow_requests_pair_unique").on(table.requesterId, table.recipientId),
  index("follow_requests_recipient_status_idx").on(table.recipientId, table.status),
]);

export const blocks = mysqlTable("blocks", {
  id: int("id").autoincrement().primaryKey(),
  blockerId: int("blockerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: int("blockedId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("blocks_pair_unique").on(table.blockerId, table.blockedId),
  index("blocks_blocked_idx").on(table.blockedId),
]);

export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  authorId: int("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  caption: text("caption"),
  locationName: varchar("locationName", { length: 160 }),
  state: mysqlEnum("state", postStates).default("published").notNull(),
  likesCount: int("likesCount").default(0).notNull(),
  commentsCount: int("commentsCount").default(0).notNull(),
  savesCount: int("savesCount").default(0).notNull(),
  sharesCount: int("sharesCount").default(0).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("posts_public_id_unique").on(table.publicId),
  index("posts_author_created_idx").on(table.authorId, table.createdAt),
  index("posts_state_created_idx").on(table.state, table.createdAt),
]);

export const postMedia = mysqlTable("post_media", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", mediaKinds).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  altText: varchar("altText", { length: 250 }),
  width: int("width"),
  height: int("height"),
  durationMs: int("durationMs"),
  fileSize: int("fileSize").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("post_media_post_order_idx").on(table.postId, table.sortOrder)]);

/** Tracks authenticated uploads before an asset is attached to a social entity. */
export const mediaUploads = mysqlTable("media_uploads", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: mysqlEnum("purpose", uploadPurposes).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  fileSize: int("fileSize").notNull(),
  width: int("width"),
  height: int("height"),
  durationMs: int("durationMs"),
  attachedAt: timestamp("attachedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("media_uploads_public_id_unique").on(table.publicId),
  index("media_uploads_owner_purpose_idx").on(table.ownerId, table.purpose, table.createdAt),
]);

export const hashtags = mysqlTable("hashtags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  usesCount: int("usesCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("hashtags_name_unique").on(table.name)]);

export const postHashtags = mysqlTable("post_hashtags", {
  postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  hashtagId: int("hashtagId").notNull().references(() => hashtags.id, { onDelete: "cascade" }),
}, table => [uniqueIndex("post_hashtags_pair_unique").on(table.postId, table.hashtagId), index("post_hashtags_hashtag_idx").on(table.hashtagId)]);

export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: int("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentCommentId: int("parentCommentId"),
  body: varchar("body", { length: 2000 }).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("comments_post_created_idx").on(table.postId, table.createdAt), index("comments_author_idx").on(table.authorId)]);

export const postLikes = mysqlTable("post_likes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("post_likes_pair_unique").on(table.postId, table.userId), index("post_likes_post_idx").on(table.postId)]);

export const savedPosts = mysqlTable("saved_posts", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("saved_posts_pair_unique").on(table.postId, table.userId), index("saved_posts_user_idx").on(table.userId, table.createdAt)]);

export const postShares = mysqlTable("post_shares", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  method: varchar("method", { length: 24 }).default("native").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("post_shares_post_idx").on(table.postId, table.createdAt), index("post_shares_user_idx").on(table.userId, table.createdAt)]);

export const stories = mysqlTable("stories", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  authorId: int("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", mediaKinds).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  textOverlay: varchar("textOverlay", { length: 500 }),
  stickers: json("stickers"),
  visibility: mysqlEnum("visibility", privacyChoices).default("everyone").notNull(),
  viewsCount: int("viewsCount").default(0).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("stories_public_id_unique").on(table.publicId),
  index("stories_author_expiry_idx").on(table.authorId, table.expiresAt),
  index("stories_expiry_idx").on(table.expiresAt),
]);

export const storyViews = mysqlTable("story_views", {
  id: int("id").autoincrement().primaryKey(),
  storyId: int("storyId").notNull().references(() => stories.id, { onDelete: "cascade" }),
  viewerId: int("viewerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("story_views_pair_unique").on(table.storyId, table.viewerId), index("story_views_story_idx").on(table.storyId)]);

export const shortVideos = mysqlTable("short_videos", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  authorId: int("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  posterUrl: varchar("posterUrl", { length: 1024 }),
  caption: varchar("caption", { length: 2200 }),
  audioTitle: varchar("audioTitle", { length: 160 }),
  durationMs: int("durationMs"),
  viewsCount: int("viewsCount").default(0).notNull(),
  likesCount: int("likesCount").default(0).notNull(),
  savesCount: int("savesCount").default(0).notNull(),
  sharesCount: int("sharesCount").default(0).notNull(),
  state: mysqlEnum("state", postStates).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("short_videos_public_id_unique").on(table.publicId), index("short_videos_state_created_idx").on(table.state, table.createdAt)]);

export const shortVideoLikes = mysqlTable("short_video_likes", {
  id: int("id").autoincrement().primaryKey(),
  videoId: int("videoId").notNull().references(() => shortVideos.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("short_video_likes_pair_unique").on(table.videoId, table.userId), index("short_video_likes_video_idx").on(table.videoId)]);

export const savedShortVideos = mysqlTable("saved_short_videos", {
  id: int("id").autoincrement().primaryKey(),
  videoId: int("videoId").notNull().references(() => shortVideos.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("saved_short_videos_pair_unique").on(table.videoId, table.userId), index("saved_short_videos_user_idx").on(table.userId, table.createdAt)]);

export const shortVideoViews = mysqlTable("short_video_views", {
  id: int("id").autoincrement().primaryKey(),
  videoId: int("videoId").notNull().references(() => shortVideos.id, { onDelete: "cascade" }),
  viewerId: int("viewerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("short_video_views_pair_unique").on(table.videoId, table.viewerId), index("short_video_views_video_idx").on(table.videoId)]);

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  kind: mysqlEnum("kind", conversationKinds).notNull(),
  title: varchar("title", { length: 100 }),
  description: varchar("description", { length: 500 }),
  avatarKey: varchar("avatarKey", { length: 512 }),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  createdById: int("createdById").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("conversations_public_id_unique").on(table.publicId), index("conversations_last_message_idx").on(table.lastMessageAt)]);

export const directConversations = mysqlTable("direct_conversations", {
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  memberOneId: int("memberOneId").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberTwoId: int("memberTwoId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("direct_conversations_pair_unique").on(table.memberOneId, table.memberTwoId), uniqueIndex("direct_conversations_conversation_unique").on(table.conversationId)]);

export const conversationMembers = mysqlTable("conversation_members", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", membershipRoles).default("member").notNull(),
  mutedUntil: timestamp("mutedUntil"),
  lastReadMessageId: int("lastReadMessageId"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
}, table => [uniqueIndex("conversation_members_pair_unique").on(table.conversationId, table.userId), index("conversation_members_user_idx").on(table.userId, table.leftAt)]);

export const conversationTyping = mysqlTable("conversation_typing", {
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("conversation_typing_pair_unique").on(table.conversationId, table.userId), index("conversation_typing_expiry_idx").on(table.conversationId, table.expiresAt)]);

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: int("senderId").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", messageKinds).default("text").notNull(),
  body: text("body"),
  replyToId: int("replyToId"),
  forwardedFromId: int("forwardedFromId"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("messages_public_id_unique").on(table.publicId),
  index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  index("messages_sender_idx").on(table.senderId),
]);

export const messageAttachments = mysqlTable("message_attachments", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", mediaKinds).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  fileSize: int("fileSize").notNull(),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("message_attachments_message_idx").on(table.messageId)]);

export const messageReactions = mysqlTable("message_reactions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("message_reactions_unique").on(table.messageId, table.userId, table.emoji), index("message_reactions_message_idx").on(table.messageId)]);

export const messageReadReceipts = mysqlTable("message_read_receipts", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("readAt").defaultNow().notNull(),
}, table => [uniqueIndex("message_read_receipts_unique").on(table.messageId, table.userId), index("message_read_receipts_user_idx").on(table.userId)]);

export const messageDeliveries = mysqlTable("message_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
}, table => [uniqueIndex("message_deliveries_unique").on(table.messageId, table.userId), index("message_deliveries_user_idx").on(table.userId)]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  recipientId: int("recipientId").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
  kind: mysqlEnum("kind", notificationKinds).notNull(),
  entityType: varchar("entityType", { length: 32 }),
  entityPublicId: varchar("entityPublicId", { length: 32 }),
  payload: json("payload"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("notifications_public_id_unique").on(table.publicId), index("notifications_recipient_read_idx").on(table.recipientId, table.readAt, table.createdAt)]);

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  reporterId: int("reporterId").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: mysqlEnum("targetType", reportTargets).notNull(),
  targetId: int("targetId").notNull(),
  reason: mysqlEnum("reason", reportReasons).notNull(),
  details: varchar("details", { length: 1000 }),
  state: mysqlEnum("state", reportStates).default("open").notNull(),
  reviewedById: int("reviewedById").references(() => users.id, { onDelete: "set null" }),
  resolutionNote: varchar("resolutionNote", { length: 1000 }),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("reports_public_id_unique").on(table.publicId), index("reports_state_created_idx").on(table.state, table.createdAt), index("reports_target_idx").on(table.targetType, table.targetId)]);

export const userDevices = mysqlTable("user_devices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("deviceId", { length: 128 }).notNull(),
  platform: varchar("platform", { length: 50 }),
  pushEndpoint: varchar("pushEndpoint", { length: 2048 }),
  pushSubscription: json("pushSubscription"),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("user_devices_device_unique").on(table.deviceId), index("user_devices_user_idx").on(table.userId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
