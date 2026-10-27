ALTER TABLE tasks ADD COLUMN done_day TEXT;
--> statement-breakpoint
UPDATE tasks SET done_day = date(done_at / 1000, 'unixepoch') WHERE done = 1 AND done_at IS NOT NULL AND done_day IS NULL;
