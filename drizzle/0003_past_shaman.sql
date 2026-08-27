CREATE TABLE `post_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int,
	`method` varchar(24) NOT NULL DEFAULT 'native',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `post_shares` ADD CONSTRAINT `post_shares_postId_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_shares` ADD CONSTRAINT `post_shares_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `post_shares_post_idx` ON `post_shares` (`postId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `post_shares_user_idx` ON `post_shares` (`userId`,`createdAt`);