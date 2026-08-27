CREATE TABLE `media_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`purpose` enum('avatar','post','story','message','voice','video') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`width` int,
	`height` int,
	`durationMs` int,
	`attachedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_uploads_public_id_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
ALTER TABLE `media_uploads` ADD CONSTRAINT `media_uploads_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_uploads_owner_purpose_idx` ON `media_uploads` (`ownerId`,`purpose`,`createdAt`);