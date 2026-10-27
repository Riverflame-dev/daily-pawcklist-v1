DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note TEXT,
  time_hint TEXT,
  schedule TEXT NOT NULL DEFAULT 'daily',
  weekday INTEGER,
  kind TEXT NOT NULL DEFAULT 'repeat',
  specific_date TEXT,
  notify_slot TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note TEXT,
  time_hint TEXT,
  day TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER,
  template_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX tasks_day_idx ON tasks (day);
--> statement-breakpoint
CREATE INDEX tasks_template_day_idx ON tasks (template_id, day);
--> statement-breakpoint
CREATE TABLE habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  done_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX habit_logs_habit_day_idx ON habit_logs (habit_id, day);
--> statement-breakpoint
CREATE INDEX habit_logs_day_idx ON habit_logs (day);
