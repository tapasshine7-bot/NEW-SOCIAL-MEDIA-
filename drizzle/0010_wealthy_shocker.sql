CREATE TABLE `mobile_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`provider` varchar(48) NOT NULL,
	`status` enum('pending','verified','expired','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`lastRequestedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mobile_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `mobile_verifications_public_id_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
ALTER TABLE `mobile_verifications` ADD CONSTRAINT `mobile_verifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mobile_verifications_user_status_idx` ON `mobile_verifications` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mobile_verifications_phone_status_idx` ON `mobile_verifications` (`phoneNumber`,`status`);