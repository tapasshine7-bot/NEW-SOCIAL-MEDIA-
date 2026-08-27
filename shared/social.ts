export const APP_NAME = "Nuvora";
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const AUDIO_MIME_TYPES = ["audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"] as const;
export const FILE_MIME_TYPES = ["application/pdf", "text/plain", "application/zip"] as const;

export type UploadPurpose = "avatar" | "post" | "story" | "message" | "voice";
