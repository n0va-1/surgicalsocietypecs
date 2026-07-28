CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`title_en` text NOT NULL,
	`title_hu` text NOT NULL,
	`body_en` text NOT NULL,
	`body_hu` text NOT NULL,
	`target_level` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text NOT NULL,
	`recorded_by` integer NOT NULL,
	`recorded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`correction_note` text,
	FOREIGN KEY (`session_id`) REFERENCES `course_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_session_student_unique` ON `attendance_records` (`session_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `attendance_student_idx` ON `attendance_records` (`student_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `course_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`level` text NOT NULL,
	`starts_at` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code_hash` text NOT NULL,
	`role` text NOT NULL,
	`course_level` text,
	`created_by` integer NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_codes_hash_unique` ON `invite_codes` (`code_hash`);--> statement-breakpoint
CREATE TABLE `modules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`week` integer NOT NULL,
	`title_en` text NOT NULL,
	`title_hu` text NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `modules_level_week_unique` ON `modules` (`level`,`week`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`module_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`reflection` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`score` integer,
	`outcome` text,
	`feedback` text,
	`reviewed_by` integer,
	`reviewed_at` text,
	`delete_after` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submissions_student_idx` ON `submissions` (`student_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_provider_user_id` text NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	`rank` text,
	`eligible` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_provider_id_unique` ON `users` (`auth_provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);