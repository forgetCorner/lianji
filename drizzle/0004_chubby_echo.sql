CREATE TABLE `training_plan_schedule_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`plan_version` integer NOT NULL,
	`effective_at` integer NOT NULL,
	`enabled_weekdays` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_plan_schedule_revisions_plan_version_unique` ON `training_plan_schedule_revisions` (`plan_id`,`plan_version`);--> statement-breakpoint
CREATE INDEX `training_plan_schedule_revisions_user_effective_idx` ON `training_plan_schedule_revisions` (`user_id`,`effective_at`);