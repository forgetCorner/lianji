DROP INDEX `workout_exercises_session_position_unique`;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `removed_from_plan_at` integer;--> statement-breakpoint
CREATE INDEX `workout_exercises_session_position_idx` ON `workout_exercises` (`workout_session_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `workout_exercises_session_plan_unique` ON `workout_exercises` (`workout_session_id`,`plan_exercise_id`) WHERE "workout_exercises"."plan_exercise_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `workout_type` text DEFAULT 'plan' NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `training_date` text;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `finalized_at` integer;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `synced_plan_version` integer;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `resumed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sessions_user_plan_date_unique` ON `workout_sessions` (`user_id`,`training_date`,`workout_type`) WHERE "workout_sessions"."training_date" IS NOT NULL AND "workout_sessions"."workout_type" = 'plan';