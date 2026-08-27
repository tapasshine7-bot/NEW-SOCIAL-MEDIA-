CREATE TABLE `saved_short_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_short_videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_short_videos_pair_unique` UNIQUE(`videoId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `short_video_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `short_video_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `short_video_likes_pair_unique` UNIQUE(`videoId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `short_video_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`viewerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `short_video_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `short_video_views_pair_unique` UNIQUE(`videoId`,`viewerId`)
);
--> statement-breakpoint
ALTER TABLE `short_videos` ADD `savesCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `short_videos` ADD `sharesCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_short_videos` ADD CONSTRAINT `saved_short_videos_videoId_short_videos_id_fk` FOREIGN KEY (`videoId`) REFERENCES `short_videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_short_videos` ADD CONSTRAINT `saved_short_videos_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `short_video_likes` ADD CONSTRAINT `short_video_likes_videoId_short_videos_id_fk` FOREIGN KEY (`videoId`) REFERENCES `short_videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `short_video_likes` ADD CONSTRAINT `short_video_likes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `short_video_views` ADD CONSTRAINT `short_video_views_videoId_short_videos_id_fk` FOREIGN KEY (`videoId`) REFERENCES `short_videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `short_video_views` ADD CONSTRAINT `short_video_views_viewerId_users_id_fk` FOREIGN KEY (`viewerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `saved_short_videos_user_idx` ON `saved_short_videos` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `short_video_likes_video_idx` ON `short_video_likes` (`videoId`);--> statement-breakpoint
CREATE INDEX `short_video_views_video_idx` ON `short_video_views` (`videoId`);