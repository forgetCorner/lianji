CREATE TABLE `custom_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`equipment` text DEFAULT '' NOT NULL,
	`muscle_group` text DEFAULT '' NOT NULL,
	`tracking_type` text DEFAULT 'weight_reps' NOT NULL,
	`weight_mode` text DEFAULT 'total' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_exercises_user_name_unique` ON `custom_exercises` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `training_plan_days` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`name` text NOT NULL,
	`focus` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_plan_days_plan_weekday_unique` ON `training_plan_days` (`plan_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `training_plan_days_user_idx` ON `training_plan_days` (`user_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `training_plan_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_day_id` text NOT NULL,
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`name` text NOT NULL,
	`equipment` text DEFAULT '' NOT NULL,
	`muscle_group` text DEFAULT '' NOT NULL,
	`tracking_type` text DEFAULT 'weight_reps' NOT NULL,
	`weight_mode` text DEFAULT 'total' NOT NULL,
	`min_sets` integer DEFAULT 3 NOT NULL,
	`max_sets` integer DEFAULT 3 NOT NULL,
	`min_reps` integer DEFAULT 10 NOT NULL,
	`max_reps` integer DEFAULT 12 NOT NULL,
	`min_duration_seconds` integer DEFAULT 0 NOT NULL,
	`max_duration_seconds` integer DEFAULT 0 NOT NULL,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`speed_min` real,
	`speed_max` real,
	`notes` text DEFAULT '' NOT NULL,
	`alternative_exercise_id` text,
	`alternative_name` text,
	`alternative_equipment` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`plan_day_id`) REFERENCES `training_plan_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_plan_exercises_day_position_idx` ON `training_plan_exercises` (`plan_day_id`,`position`);--> statement-breakpoint
CREATE TABLE `training_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_plans_user_active_idx` ON `training_plans` (`user_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`plan_exercise_id` text,
	`exercise_id` text NOT NULL,
	`name` text NOT NULL,
	`equipment` text DEFAULT '' NOT NULL,
	`muscle_group` text DEFAULT '' NOT NULL,
	`tracking_type` text DEFAULT 'weight_reps' NOT NULL,
	`weight_mode` text DEFAULT 'total' NOT NULL,
	`min_sets` integer NOT NULL,
	`max_sets` integer NOT NULL,
	`min_reps` integer DEFAULT 0 NOT NULL,
	`max_reps` integer DEFAULT 0 NOT NULL,
	`min_duration_seconds` integer DEFAULT 0 NOT NULL,
	`max_duration_seconds` integer DEFAULT 0 NOT NULL,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`speed_min` real,
	`speed_max` real,
	`notes` text DEFAULT '' NOT NULL,
	`alternative_exercise_id` text,
	`alternative_name` text,
	`alternative_equipment` text,
	`position` integer NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`workout_session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_exercises_session_position_unique` ON `workout_exercises` (`workout_session_id`,`position`);--> statement-breakpoint
CREATE INDEX `workout_exercises_user_session_idx` ON `workout_exercises` (`user_id`,`workout_session_id`);--> statement-breakpoint
DROP INDEX `workout_sets_session_exercise_set_unique`;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `workout_exercise_id` text;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `tracking_type` text DEFAULT 'weight_reps' NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `duration_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `left_weight_kg` real;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `right_weight_kg` real;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `effort` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sets_workout_exercise_set_unique` ON `workout_sets` (`workout_exercise_id`,`set_index`);--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `plan_id` text;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `plan_day_id` text;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `plan_version` integer;