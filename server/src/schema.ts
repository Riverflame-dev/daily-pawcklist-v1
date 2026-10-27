// Drizzle schema for the Daily Checklist.
//
// Tables:
// - templates: recurring items (weekend meds, Friday HelloFresh picks).
//   They are display-only reminders shown at the bottom of each matching
//   day — they are never checked off, so they do not become tasks.
// - tasks: one row per checkable task on a specific calendar day
//   (day = 'YYYY-MM-DD' in the user's local timezone). Unfinished one-off
//   tasks roll over as "carried over" (shown on top) until done/deleted.
//   Older rows may carry a templateId from when recurring items were
//   materialized as tasks; those rows are ignored by the day view.
// - habits: small everyday quick-mark buttons (Gym, Cook, Litter box,
//   Study). Definitions only; tapping one on a day writes a habit_logs row.
// - habit_logs: one row per habit per day it was done. This is the history
//   a future timeline view will read — deleting a habit definition keeps
//   its past logs.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  note: text("note"),
  timeHint: text("time_hint"),
  // 'daily' | 'weekdays' | 'weekends' | 'weekly' — only for kind='repeat'
  schedule: text("schedule").notNull().default("daily"),
  // 0 = Sunday .. 6 = Saturday; only used when schedule = 'weekly'
  weekday: integer("weekday"),
  // 'repeat' | 'once' — repeat shows on matching days, once shows on one date
  kind: text("kind").notNull().default("repeat"),
  // 'YYYY-MM-DD' — only used when kind = 'once'
  specificDate: text("specific_date"),
  // 'AM' | 'PM' — AM notifies at 9:00 AM, PM at 4:30 PM
  notifySlot: text("notify_slot"),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const habits = sqliteTable("habits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const habitLogs = sqliteTable("habit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  habitId: integer("habit_id").notNull(),
  // 'YYYY-MM-DD' in the user's local timezone — the day the habit was done.
  day: text("day").notNull(),
  doneAt: integer("done_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  note: text("note"),
  // JSON array of tag labels, e.g. '["work","urgent"]'. Notes were
  // removed from the UI in favour of tags; this column holds the tags.
  tags: text("tags"),
  timeHint: text("time_hint"),
  day: text("day").notNull(),
  // 'YYYY-MM-DD' — the day the task was added (its original page). "Move
  // to next day" changes `day` but never this, so the task always keeps
  // a copy on its original page: checking it off there (done_day =
  // origin_day) makes every future copy disappear, no matter which day
  // the task rolled over to or was manually moved to. Null on rows
  // written before this column existed — their origin is their `day`.
  originDay: text("origin_day"),
  done: integer("done").notNull().default(0),
  doneAt: integer("done_at", { mode: "timestamp_ms" }),
  // 'YYYY-MM-DD' in the user's local timezone — the day view the task was
  // checked off from. A carried-over task checked off today stays visible
  // (done) on today's list instead of vanishing; it stops appearing on
  // later days because its done_day is then in the past.
  doneDay: text("done_day"),
  templateId: integer("template_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
