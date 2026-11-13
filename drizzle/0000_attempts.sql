CREATE TABLE `attempts` (
 `id` text PRIMARY KEY NOT NULL,
 `owner` text NOT NULL,
 `nickname` text NOT NULL,
 `started_at` integer NOT NULL,
 `updated_at` integer NOT NULL,
 `finished_at` integer,
 `question_ids` text NOT NULL,
 `answers` text NOT NULL,
 `years` text NOT NULL,
 `total` integer NOT NULL,
 `answered` integer NOT NULL DEFAULT 0,
 `correct` integer NOT NULL DEFAULT 0,
 `points` integer NOT NULL DEFAULT 0,
 `max_points` integer NOT NULL,
 `percent` integer NOT NULL DEFAULT 0,
 `revision` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX `attempts_started_idx` ON `attempts` (`started_at`);
--> statement-breakpoint
CREATE INDEX `attempts_owner_idx` ON `attempts` (`owner`, `started_at`);
