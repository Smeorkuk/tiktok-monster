CREATE TABLE `questions` (
 `id` text PRIMARY KEY NOT NULL,
 `data` text NOT NULL,
 `enabled` integer NOT NULL DEFAULT 1,
 `revision` integer NOT NULL DEFAULT 1,
 `updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attempts` ADD `question_snapshot` text;
