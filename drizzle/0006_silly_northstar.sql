CREATE TABLE `conversation_typing` (
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversation_typing_pair_unique` UNIQUE(`conversationId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `conversation_typing` ADD CONSTRAINT `conversation_typing_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversation_typing` ADD CONSTRAINT `conversation_typing_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `conversation_typing_expiry_idx` ON `conversation_typing` (`conversationId`,`expiresAt`);