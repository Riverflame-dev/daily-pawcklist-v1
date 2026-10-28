// Sample data for a fresh demo, dated relative to today so every visit
// shows a lived-in week: yesterday's tasks (two rolled over), today's
// list, a few upcoming days, the four Logs buttons and some reminders.

import type { SQLJsDatabase } from "drizzle-orm/sql-js";
import * as schema from "../server/src/schema";

function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function shift(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export async function seedDemo(db: SQLJsDatabase<typeof schema>): Promise<void> {
  const t = toKey(new Date());
  const yest = shift(t, -1);
  const weekday = new Date(`${t}T12:00:00`).getDay();

  await db.insert(schema.habits).values(
    ["Gym", "Cook", "Litter box", "Study"].map((label, i) => ({ label, sortOrder: i + 1 })),
  );

  await db.insert(schema.templates).values([
    { title: "Take meds", schedule: "weekends", kind: "repeat", notifySlot: "AM" },
    { title: "Pick up your HelloFresh order", schedule: "weekly", weekday, kind: "repeat", notifySlot: "PM" },
    { title: "Feed the cats", kind: "once", specificDate: t, notifySlot: "AM" },
    { title: "Doctor's appointment", kind: "once", specificDate: shift(t, 1), notifySlot: "AM" },
    { title: "Talk to Alex about the weekend", kind: "once", specificDate: shift(t, 2), notifySlot: "PM" },
    { title: "Pick up the prescription", kind: "once", specificDate: shift(t, 3), notifySlot: "AM" },
  ]);

  let order = 0;
  const task = (title: string, tags: string[], day: string, doneDay: string | null) => ({
    title,
    tags: JSON.stringify(tags),
    day,
    originDay: day,
    done: doneDay ? 1 : 0,
    doneAt: doneDay ? new Date(`${doneDay}T12:00:00`) : null,
    doneDay,
    sortOrder: ++order,
  });

  await db.insert(schema.tasks).values([
    // Yesterday: two checked off that day, two left open and rolled over —
    // one of those has since been finished today.
    task("Email the team the schedule", [], yest, yest),
    task("Finish the presentation slides", [], yest, yest),
    task("Check in for the flight", ["trip"], yest, t),
    task("Review the draft proposal", [], yest, null),
    // Today's own tasks.
    task("Grocery run for the week", ["grocery"], t, t),
    task("Call the hotel about check-in", [], t, t),
    task("Tidy the desk", ["chores"], t, null),
    // The next few days stay light.
    task("Prep for the morning call", [], shift(t, 1), null),
    task("Buy cat treats", [], shift(t, 1), null),
    task("Plan the weekend trip route", ["trip"], shift(t, 2), null),
    task("Call the dentist to reschedule", [], shift(t, 3), null),
  ]);
}
