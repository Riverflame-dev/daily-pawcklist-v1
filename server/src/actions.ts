// Actions for the Daily Checklist.
//
// The day view is computed server-side: getDay returns the day's checkable
// one-off tasks plus any unfinished one-off tasks from earlier days as
// "carried over" (shown on top). Recurring templates are NOT checkable
// tasks — they are returned separately as `recurringToday` so the client
// can display them at the bottom as reminders, alongside the day's notes.
// All state changes go through these actions so Muse can read exactly what
// Eddie has checked off.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import * as schema from "./schema";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const taskShape = z.object({
  id: z.number(),
  title: z.string(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  timeHint: z.string().nullable(),
  day: z.string(),
  // The day the task was added ('YYYY-MM-DD'). "Move to next day"
  // changes `day` but never this, so the original page always keeps a
  // copy of the task. The client compares it with the viewed date to
  // render that copy as the greyed "next day" copy.
  originDay: z.string(),
  done: z.boolean(),
  doneAt: z.string().nullable(),
  // Day view the task was checked off from ('YYYY-MM-DD'), or null.
  // The client uses it to tell whether a task was finished on the day
  // it was added or only on a later day — the latter means the copy on
  // its added day has moved on to the next day.
  doneDay: z.string().nullable(),
  templateId: z.number().nullable(),
  carried: z.boolean(),
});

const templateShape = z.object({
  id: z.number(),
  title: z.string(),
  note: z.string().nullable(),
  timeHint: z.string().nullable(),
  schedule: z.string(),
  weekday: z.number().nullable(),
  kind: z.string(),
  specificDate: z.string().nullable(),
  notifySlot: z.string().nullable(),
  active: z.boolean(),
});

const habitShape = z.object({
  id: z.number(),
  label: z.string(),
  done: z.boolean(),
});

const DEFAULT_HABITS = ["Gym", "Cook", "Litter box", "Study"] as const;

type TaskRow = typeof schema.tasks.$inferSelect;
type TemplateRow = typeof schema.templates.$inferSelect;
type HabitRow = typeof schema.habits.$inferSelect;

/**
 * The local day a task was checked off, for deciding whether a finished
 * carried-over task still belongs on the viewed day's list. Prefers the
 * recorded done_day; rows finished before that column existed fall back
 * to the UTC calendar date of done_at.
 */
function effectiveDoneDay(row: TaskRow): string | null {
  if (row.doneDay) return row.doneDay;
  if (row.doneAt) return row.doneAt.toISOString().slice(0, 10);
  return null;
}

/** Tags are stored as a JSON array string in tasks.tags. */
function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === "string" && t.trim() !== "");
    }
  } catch {
    // Legacy / hand-written values: fall back to comma-separated text.
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== "");
  }
  return [];
}

function normalizeTags(input: string[] | undefined): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    for (const part of raw.split(",")) {
      const tag = part.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
      if (out.length >= 20) return out;
    }
  }
  return out;
}

/** The day a task was added; rows predating the column use their day. */
function originOf(row: TaskRow): string {
  return row.originDay ?? row.day;
}

function toTask(row: TaskRow, carried: boolean): z.infer<typeof taskShape> {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    tags: parseTags(row.tags),
    timeHint: row.timeHint,
    day: row.day,
    originDay: originOf(row),
    done: row.done === 1,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
    doneDay: effectiveDoneDay(row),
    templateId: row.templateId,
    carried,
  };
}

function toHabit(row: HabitRow, done: boolean): z.infer<typeof habitShape> {
  return { id: row.id, label: row.label, done };
}

function toTemplate(row: TemplateRow): z.infer<typeof templateShape> {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    timeHint: row.timeHint,
    schedule: row.schedule,
    weekday: row.weekday,
    kind: row.kind ?? "repeat",
    specificDate: row.specificDate ?? null,
    notifySlot: row.notifySlot ?? null,
    active: row.active === 1,
  };
}

function slotToTimeHint(slot: string | null | undefined): string | null {
  if (slot === "AM") return "9:00 AM";
  if (slot === "PM") return "4:30 PM";
  return null;
}

function slotFromTimeHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const m = hint.trim().match(/(AM|PM)\s*$/i);
  return m?.[1] ? m[1].toUpperCase() : null;
}

/** Parse a 'h:MM AM/PM' style hint into minutes since midnight, or null. */
function timeMinutes(hint: string | null): number | null {
  if (!hint) return null;
  const m = hint.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function sortTasks(rows: TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => {
    const am = timeMinutes(a.timeHint);
    const bm = timeMinutes(b.timeHint);
    if (am !== null && bm !== null && am !== bm) return am - bm;
    if (am !== null && bm === null) return -1;
    if (am === null && bm !== null) return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

function templateMatches(t: TemplateRow, day: string): boolean {
  if (t.active !== 1) return false;
  if ((t.kind ?? "repeat") === "once") {
    return t.specificDate === day;
  }
  const dow = new Date(`${day}T12:00:00`).getDay();
  switch (t.schedule) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekends":
      return dow === 0 || dow === 6;
    case "weekly":
      return t.weekday !== null && t.weekday === dow;
    default:
      return false;
  }
}

/** Whether a recurring template is scheduled to display on the given day. */

const okResponse = z.object({ ok: z.literal(true) });

export const Actions = {
  getDay: defineAction({
    request: z.object({ date: z.string().regex(dateRe) }),
    response: z.object({
      date: z.string(),
      tasks: z.array(taskShape),
      carried: z.array(taskShape),
      templates: z.array(templateShape),
      recurringToday: z.array(templateShape),
      habits: z.array(habitShape),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();

      // Only one-off tasks are checkable. Legacy rows materialized from a
      // recurring template (templateId set) are excluded — recurring items
      // display at the bottom instead of being checked off.
      //
      // Each task has an origin day O (the day it was added; only ever
      // changed by deleting/re-adding the task) and a live day S (`day` —
      // "move to next day" pushes S forward but never touches O). What a
      // day view V shows follows Eddie's rollover model:
      //
      // - V == O: the original page always keeps its copy. While the task
      //   is open, or was finished on a later day, that copy is the
      //   greyed "next day" copy (interactive while still open, locked
      //   once finished later — the client renders that from `done` /
      //   `doneDay` / `originDay`). Finished on O itself, it is a normal
      //   done task on that page.
      // - V > O, task still open: the live copy shows on S itself and
      //   rolls over to every later day. Days between O and S (reachable
      //   only after a manual move) show nothing — the task was
      //   postponed past them.
      // - V > O, task finished on a later day D: the live copy stays
      //   visible, crossed off, on every live day from S up to and
      //   including D — checking a rolled-over task off on a future day
      //   keeps it crossed on that page (and on the rollover pages it
      //   reached), never makes it vanish. After D it is gone.
      // - V > O, task finished on its origin day (D == O): no live copy
      //   anywhere. Checking a task off on its original page — even
      //   after that day has passed — is the one thing that makes the
      //   rollover disappear from all future pages, no matter which
      //   date the task rolled over to or was manually moved to.
      const allRows = await db
        .select()
        .from(schema.tasks)
        .where(isNull(schema.tasks.templateId))
        .orderBy(asc(schema.tasks.id));
      const dayRows: TaskRow[] = [];
      const carriedRows: TaskRow[] = [];
      for (const r of allRows) {
        const origin = originOf(r);
        const live = r.day;
        if (args.date === origin) {
          dayRows.push(r);
          continue;
        }
        if (args.date < origin) continue;
        // From here the viewed day is after the task's origin day.
        if (r.done === 1) {
          const doneDay = effectiveDoneDay(r);
          // Finished on the original page (or no recorded done day):
          // the rollover is gone from every future page.
          if (doneDay === null || doneDay === origin) continue;
          // Finished on a later day: crossed on the live days it
          // reached, up to and including the day it was checked off.
          if (args.date >= live && args.date <= doneDay) {
            if (args.date === live) dayRows.push(r);
            else carriedRows.push(r);
          }
          continue;
        }
        if (args.date === live) dayRows.push(r);
        else if (args.date > live) carriedRows.push(r);
        // origin < args.date < live: postponed by a manual move.
      }

      const tpls = await db
        .select()
        .from(schema.templates)
        .orderBy(asc(schema.templates.id));

      // Everyday quick-mark habits. Seed the four Eddie named the first
      // time the table is completely empty (no rows at all, including
      // soft-deleted ones) so a user who removes them all isn't reseeded.
      let allHabits = await db
        .select()
        .from(schema.habits)
        .orderBy(asc(schema.habits.sortOrder), asc(schema.habits.id));
      if (allHabits.length === 0) {
        await db.insert(schema.habits).values(
          DEFAULT_HABITS.map((label, i) => ({ label, sortOrder: i + 1 })),
        );
        allHabits = await db
          .select()
          .from(schema.habits)
          .orderBy(asc(schema.habits.sortOrder), asc(schema.habits.id));
      }
      const activeHabits = allHabits.filter((h) => h.active === 1);
      const logs =
        activeHabits.length > 0
          ? await db
              .select()
              .from(schema.habitLogs)
              .where(eq(schema.habitLogs.day, args.date))
          : [];
      const doneIds = new Set(logs.map((l) => l.habitId));

      return {
        date: args.date,
        tasks: sortTasks(dayRows).map((r) => toTask(r, false)),
        carried: sortTasks(carriedRows).map((r) => toTask(r, true)),
        templates: tpls.map(toTemplate),
        recurringToday: tpls.filter((t) => templateMatches(t, args.date)).map(toTemplate),
        habits: activeHabits.map((h) => toHabit(h, doneIds.has(h.id))),
      };
    },
  }),

  addTask: defineAction({
    request: z.object({
      date: z.string().regex(dateRe),
      title: z.string().min(1).max(300),
      // Tags replaced notes: a task carries a title and tags, no note.
      tags: z.array(z.string().max(60)).max(40).optional(),
      timeHint: z.string().max(40).optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const tags = normalizeTags(args.tags);
      const result = await db
        .insert(schema.tasks)
        .values({
          title: args.title.trim(),
          note: null,
          tags: tags.length > 0 ? JSON.stringify(tags) : null,
          timeHint: args.timeHint?.trim() ? args.timeHint.trim() : null,
          day: args.date,
        })
        .returning({ id: schema.tasks.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addTask: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  toggleTask: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      done: z.boolean(),
      // The day view the user toggled from. Recorded as done_day so a
      // carried-over task checked off from today's list stays visible
      // there (done) instead of disappearing. Callers that don't know
      // the viewed day (e.g. chat-driven updates) omit it and the UTC
      // date of the toggle is used.
      viewDate: z.string().regex(dateRe).optional(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      await db
        .update(schema.tasks)
        .set({
          done: args.done ? 1 : 0,
          doneAt: args.done ? now : null,
          // The viewed day is recorded as-is, future dates included:
          // checking a rolled-over task off on tomorrow's page is a
          // real completion that belongs to that page, and getDay's
          // lifespan rule keeps the task crossed off there (and on
          // every rollover day it reached) instead of dropping it.
          doneDay: args.done
            ? (args.viewDate ?? now.toISOString().slice(0, 10))
            : null,
        })
        .where(eq(schema.tasks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  toggleHabit: defineAction({
    request: z.object({
      habitId: z.number().int().positive(),
      date: z.string().regex(dateRe),
      done: z.boolean(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      if (args.done) {
        const existing = await db
          .select({ id: schema.habitLogs.id })
          .from(schema.habitLogs)
          .where(
            and(
              eq(schema.habitLogs.habitId, args.habitId),
              eq(schema.habitLogs.day, args.date),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          await db.insert(schema.habitLogs).values({
            habitId: args.habitId,
            day: args.date,
            doneAt: new Date(),
          });
        }
      } else {
        await db
          .delete(schema.habitLogs)
          .where(
            and(
              eq(schema.habitLogs.habitId, args.habitId),
              eq(schema.habitLogs.day, args.date),
            ),
          );
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  addHabit: defineAction({
    request: z.object({ label: z.string().min(1).max(60) }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ sortOrder: schema.habits.sortOrder })
        .from(schema.habits);
      const nextOrder =
        rows.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1;
      const result = await db
        .insert(schema.habits)
        .values({ label: args.label.trim(), sortOrder: nextOrder })
        .returning({ id: schema.habits.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addHabit: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deleteHabit: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      // Soft-delete: past habit_logs stay, so a future timeline still
      // shows the days this habit was done.
      await db
        .update(schema.habits)
        .set({ active: 0 })
        .where(eq(schema.habits.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  editTask: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).max(300),
      // Optional so callers that only rename a task keep its tags;
      // when provided, the list replaces the task's tags. Notes are
      // gone: editing a task clears any legacy note it still carries.
      tags: z.array(z.string().max(60)).max(40).optional(),
      timeHint: z.string().max(40).nullable().optional(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const tags = args.tags === undefined ? undefined : normalizeTags(args.tags);
      await db
        .update(schema.tasks)
        .set({
          title: args.title.trim(),
          note: null,
          ...(tags !== undefined
            ? { tags: tags.length > 0 ? JSON.stringify(tags) : null }
            : {}),
          ...(args.timeHint !== undefined
            ? { timeHint: args.timeHint?.trim() ? args.timeHint.trim() : null }
            : {}),
        })
        .where(eq(schema.tasks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteTask: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.tasks).where(eq(schema.tasks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  moveTaskToDay: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      date: z.string().regex(dateRe),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      // A manual move pushes the task's live day forward but never its
      // origin day: the original page keeps its greyed copy, and
      // checking the task off there still clears it from every future
      // page, this new day included.
      const existing = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, args.id))
        .limit(1);
      const row = existing[0];
      await db
        .update(schema.tasks)
        .set({
          day: args.date,
          ...(row ? { originDay: row.originDay ?? row.day } : {}),
        })
        .where(eq(schema.tasks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  addTemplate: defineAction({
    request: z.object({
      title: z.string().min(1).max(300),
      note: z.string().max(1000).optional(),
      timeHint: z.string().max(40).optional(),
      schedule: z.enum(["daily", "weekdays", "weekends", "weekly"]).optional(),
      weekday: z.number().int().min(0).max(6).optional(),
      kind: z.enum(["repeat", "once"]).optional(),
      specificDate: z.string().regex(dateRe).optional(),
      notifySlot: z.enum(["AM", "PM"]).optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const kind = args.kind ?? "repeat";
      const notifySlot =
        args.notifySlot ?? slotFromTimeHint(args.timeHint) ?? null;
      const timeHint =
        slotToTimeHint(notifySlot) ??
        (args.timeHint?.trim() ? args.timeHint.trim() : null);
      const schedule = kind === "once" ? "daily" : (args.schedule ?? "daily");
      const result = await db
        .insert(schema.templates)
        .values({
          title: args.title.trim(),
          note: args.note?.trim() ? args.note.trim() : null,
          timeHint,
          schedule,
          weekday:
            kind === "repeat" && schedule === "weekly"
              ? (args.weekday ?? 1)
              : null,
          kind,
          specificDate: kind === "once" ? (args.specificDate ?? null) : null,
          notifySlot,
        })
        .returning({ id: schema.templates.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addTemplate: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  setTemplateActive: defineAction({
    request: z.object({ id: z.number().int().positive(), active: z.boolean() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.templates)
        .set({ active: args.active ? 1 : 0 })
        .where(eq(schema.templates.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteTemplate: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      // Future instances stop because the template is gone; also remove
      // today's and future undone instances so a deleted routine disappears.
      await db
        .delete(schema.tasks)
        .where(
          and(
            eq(schema.tasks.templateId, args.id),
            eq(schema.tasks.done, 0),
            ne(schema.tasks.day, ""),
          ),
        );
      await db.delete(schema.templates).where(eq(schema.templates.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // One-time correction Eddie asked for: the Instacart order was a Friday
  // (2026-10-23) task and was done that Friday. Earlier data had it sitting
  // open on Sunday Oct 25. Idempotent: moves + marks it, or recreates it on
  // that Friday if it is missing entirely.
  fixInstacartFriday: defineAction({
    request: z.object({}),
    response: z.object({ ok: z.literal(true), updated: z.boolean() }),
    async handler(ctx): Promise<{ ok: true; updated: boolean }> {
      const db = ctx.db<typeof schema>();
      const friday = "2026-10-23";
      const doneAt = new Date("2026-10-23T16:00:00.000Z");
      const all = await db.select().from(schema.tasks);
      const match = all.find((t) =>
        t.title.toLowerCase().includes("instacart"),
      );
      if (!match) {
        await db.insert(schema.tasks).values({
          title: "Place the Instacart order",
          day: friday,
          done: 1,
          doneAt,
          doneDay: friday,
          sortOrder: 5,
        });
        ctx.invalidateQueries();
        return { ok: true as const, updated: true };
      }
      if (match.day === friday && match.done === 1) {
        return { ok: true as const, updated: false };
      }
      await db
        .update(schema.tasks)
        .set({ day: friday, done: 1, doneAt, doneDay: friday })
        .where(eq(schema.tasks.id, match.id));
      ctx.invalidateQueries();
      return { ok: true as const, updated: true };
    },
  }),

  // One-time import of the exact tasks Eddie handed over in conversation.
  // No-ops when either table already holds rows, so it never wipes edits.
  seedInitial: defineAction({
    request: z.object({}),
    response: z.object({ seeded: z.boolean() }),
    async handler(ctx): Promise<{ seeded: boolean }> {
      const db = ctx.db<typeof schema>();
      // Habits seed independently of tasks/templates so existing installs
      // still get Gym / Cook / Litter box / Study on their next seed call.
      const existingHabits = await db
        .select({ id: schema.habits.id })
        .from(schema.habits)
        .limit(1);
      if (existingHabits.length === 0) {
        await db.insert(schema.habits).values(
          DEFAULT_HABITS.map((label, i) => ({ label, sortOrder: i + 1 })),
        );
      }
      const existingTasks = await db
        .select({ id: schema.tasks.id })
        .from(schema.tasks)
        .limit(1);
      const existingTemplates = await db
        .select({ id: schema.templates.id })
        .from(schema.templates)
        .limit(1);
      if (existingTasks.length > 0 || existingTemplates.length > 0) {
        ctx.invalidateQueries();
        return { seeded: existingHabits.length === 0 };
      }

      await db.insert(schema.templates).values([
        {
          title: "Take your meds",
          timeHint: "9:00 AM",
          schedule: "weekends",
          kind: "repeat",
          notifySlot: "AM",
        },
        {
          title: "Pick HelloFresh meals for next week",
          timeHint: "4:30 PM",
          schedule: "weekly",
          weekday: 5, // Friday
          kind: "repeat",
          notifySlot: "PM",
        },
      ]);

      await db.insert(schema.tasks).values([
        // Carried over, still unconfirmed as of Sunday Oct 25.
        {
          title: "Print the Ugg return label and sort out the office UPS service",
          day: "2026-10-25",
          sortOrder: 1,
        },
        {
          title: "Chat with Kaku",
          day: "2026-10-25",
          sortOrder: 2,
        },
        {
          title: "Schedule the health appointment with Rishi",
          day: "2026-10-25",
          sortOrder: 3,
        },
        {
          title: "Go through the wedding photos and send yours over",
          day: "2026-10-25",
          sortOrder: 4,
        },
        {
          // Done on Friday Oct 23, per Eddie — a Friday task, marked off.
          title: "Place the Instacart order",
          day: "2026-10-23",
          done: 1,
          doneAt: new Date("2026-10-23T16:00:00.000Z"),
          doneDay: "2026-10-23",
          sortOrder: 5,
        },
        // Monday Oct 26: 8:30 AM get-ready items.
        {
          title: "Trash",
          note: "Get-ready — bring it out before work",
          timeHint: "8:30 AM",
          day: "2026-10-26",
          sortOrder: 1,
        },
        {
          title: "Mailbox",
          note: "Get-ready — check the mailbox before work",
          timeHint: "8:30 AM",
          day: "2026-10-26",
          sortOrder: 2,
        },
        {
          title: "Lunch bag",
          note: "Get-ready — bring your lunch bag to work",
          timeHint: "8:30 AM",
          day: "2026-10-26",
          sortOrder: 3,
        },
        {
          title: "Doctor's appointment",
          note: "Time and place still to add — tap Edit to fill them in",
          day: "2026-10-26",
          sortOrder: 4,
        },
      ]);

      ctx.invalidateQueries();
      return { seeded: true };
    },
  }),
} satisfies ActionsModule;
