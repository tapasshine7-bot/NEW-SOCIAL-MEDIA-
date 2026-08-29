import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import path from "node:path";
import { z } from "zod";
import { mediaUploads, profiles } from "../../drizzle/schema";
import { AUDIO_MIME_TYPES, FILE_MIME_TYPES, IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, VIDEO_MIME_TYPES } from "../../shared/social";
import { createPublicId } from "../db/social";
import { getDb } from "../db";
import { storagePresignPut, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const uploadPurpose = z.enum(["avatar", "post", "story", "message", "voice", "video"]);
const base64Schema = z.string().min(4).max(70_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/, "Invalid upload encoding.");

function mediaKind(mimeType: string): "image" | "video" | "audio" | "file" {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "image";
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return "video";
  if ((AUDIO_MIME_TYPES as readonly string[]).includes(mimeType)) return "audio";
  return "file";
}

function assertUploadAllowed(purpose: z.infer<typeof uploadPurpose>, mimeType: string, bytes: number) {
  const kind = mediaKind(mimeType);
  const allowed = {
    avatar: kind === "image",
    post: kind === "image" || kind === "video",
    story: kind === "image" || kind === "video",
    message: kind === "image" || kind === "video" || kind === "audio" || (FILE_MIME_TYPES as readonly string[]).includes(mimeType),
    voice: kind === "audio",
    video: kind === "video",
  }[purpose];
  if (!allowed) throw new TRPCError({ code: "BAD_REQUEST", message: "That file type is not allowed for this upload." });
  const maxBytes = kind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (bytes > maxBytes) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `This ${kind} exceeds the permitted upload size.` });
}

function assertFileSignature(mimeType: string, bytes: Buffer) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const valid = mimeType === "image/jpeg" ? starts(0xff, 0xd8, 0xff)
    : mimeType === "image/png" ? starts(0x89, 0x50, 0x4e, 0x47)
    : mimeType === "image/gif" ? bytes.subarray(0, 3).toString("ascii") === "GIF"
    : mimeType === "image/webp" ? bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
    : mimeType === "video/webm" || mimeType === "audio/webm" ? starts(0x1a, 0x45, 0xdf, 0xa3)
    : mimeType === "audio/ogg" ? bytes.subarray(0, 4).toString("ascii") === "OggS"
    : true;
  if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "The file contents do not match its declared media type." });
}

export const uploadsRouter = router({
  presign: protectedProcedure.input(z.object({
    purpose: uploadPurpose,
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().max(120),
    fileSize: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES),
  })).mutation(async ({ ctx, input }) => {
    assertUploadAllowed(input.purpose, input.mimeType, input.fileSize);
    const extension = path.extname(input.originalName).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
    const publicId = createPublicId("media");
    const storage = await storagePresignPut(`members/${ctx.user.id}/${input.purpose}/${publicId}${extension}`);
    return { uploadId: publicId, ...storage, kind: mediaKind(input.mimeType) };
  }),

  finalize: protectedProcedure.input(z.object({
    uploadId: z.string().min(8).max(32),
    purpose: uploadPurpose,
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().max(120),
    fileSize: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES),
    width: z.number().int().positive().max(10_000).optional(),
    height: z.number().int().positive().max(10_000).optional(),
    durationMs: z.number().int().positive().max(7_200_000).optional(),
    storageKey: z.string().min(1).max(500),
    url: z.string().min(1).max(2000),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Uploads are temporarily unavailable." });
    assertUploadAllowed(input.purpose, input.mimeType, input.fileSize);
    const expectedPrefix = `members/${ctx.user.id}/${input.purpose}/${input.uploadId}`;
    if (!input.storageKey.startsWith(expectedPrefix) || input.url !== `/manus-storage/${input.storageKey}`) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded media reference is invalid." });
    if ((input.width === undefined) !== (input.height === undefined)) throw new TRPCError({ code: "BAD_REQUEST", message: "Media width and height must be supplied together." });
    const existing = (await db.select({ id: mediaUploads.id }).from(mediaUploads).where(eq(mediaUploads.publicId, input.uploadId)).limit(1))[0];
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "This upload has already been finalized." });
    await db.insert(mediaUploads).values({ publicId: input.uploadId, ownerId: ctx.user.id, purpose: input.purpose, storageKey: input.storageKey, url: input.url, originalName: input.originalName, mimeType: input.mimeType, fileSize: input.fileSize, width: input.width, height: input.height, durationMs: input.durationMs });
    return { publicId: input.uploadId, url: input.url, kind: mediaKind(input.mimeType), originalName: input.originalName, mimeType: input.mimeType, fileSize: input.fileSize };
  }),

  create: protectedProcedure.input(z.object({
    purpose: uploadPurpose,
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().max(120),
    dataBase64: base64Schema,
    width: z.number().int().positive().max(10_000).optional(),
    height: z.number().int().positive().max(10_000).optional(),
    durationMs: z.number().int().positive().max(7_200_000).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Uploads are temporarily unavailable." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (bytes.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file was empty." });
    assertUploadAllowed(input.purpose, input.mimeType, bytes.length);
    assertFileSignature(input.mimeType, bytes);
    if ((input.width === undefined) !== (input.height === undefined)) throw new TRPCError({ code: "BAD_REQUEST", message: "Media width and height must be supplied together." });
    if (input.durationMs !== undefined && input.durationMs > 7_200_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Media duration exceeds the permitted limit." });

    const extension = path.extname(input.originalName).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
    const storage = await storagePut(`members/${ctx.user.id}/${input.purpose}/${createPublicId("media")}${extension}`, bytes, input.mimeType);
    const publicId = createPublicId("media");
    await db.insert(mediaUploads).values({
      publicId,
      ownerId: ctx.user.id,
      purpose: input.purpose,
      storageKey: storage.key,
      url: storage.url,
      originalName: input.originalName,
      mimeType: input.mimeType,
      fileSize: bytes.length,
      width: input.width,
      height: input.height,
      durationMs: input.durationMs,
    });
    return { publicId, url: storage.url, kind: mediaKind(input.mimeType), originalName: input.originalName, mimeType: input.mimeType, fileSize: bytes.length };
  }),

  setAvatar: protectedProcedure.input(z.object({ uploadId: z.string().min(8).max(32) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Uploads are temporarily unavailable." });
    const upload = (await db.select().from(mediaUploads).where(eq(mediaUploads.publicId, input.uploadId)).limit(1))[0];
    if (!upload || upload.ownerId !== ctx.user.id || upload.purpose !== "avatar" || upload.attachedAt) throw new TRPCError({ code: "FORBIDDEN", message: "That avatar upload is not available." });
    await db.update(profiles).set({ avatarKey: upload.storageKey, avatarUrl: upload.url }).where(eq(profiles.userId, ctx.user.id));
    await db.update(mediaUploads).set({ attachedAt: new Date() }).where(eq(mediaUploads.id, upload.id));
    return { avatarUrl: upload.url };
  }),
});
