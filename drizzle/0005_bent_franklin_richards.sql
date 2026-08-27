CREATE TABLE `direct_conversations` (
	`conversationId` int NOT NULL,
	`memberOneId` int NOT NULL,
	`memberTwoId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `direct_conversations_pair_unique` UNIQUE(`memberOneId`,`memberTwoId`),
	CONSTRAINT `direct_conversations_conversation_unique` UNIQUE(`conversationId`)
);
--> statement-breakpoint
ALTER TABLE `direct_conversations` ADD CONSTRAINT `direct_conversations_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `direct_conversations` ADD CONSTRAINT `direct_conversations_memberOneId_users_id_fk` FOREIGN KEY (`memberOneId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `direct_conversations` ADD CONSTRAINT `direct_conversations_memberTwoId_users_id_fk` FOREIGN KEY (`memberTwoId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;