CREATE TABLE `story_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`storyId` int NOT NULL,
	`senderId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `story_replies_id` PRIMARY KEY(`id`),
	CONSTRAINT `story_replies_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
ALTER TABLE `story_replies` ADD CONSTRAINT `story_replies_storyId_stories_id_fk` FOREIGN KEY (`storyId`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_replies` ADD CONSTRAINT `story_replies_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `story_replies_story_idx` ON `story_replies` (`storyId`,`createdAt`);