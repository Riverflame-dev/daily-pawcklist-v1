# Daily Pawcklist

A cat-themed daily checklist app: per-day to-do tasks with tags and
roll-over to the next day, one-tap Logs buttons (Gym, Cook, Litter box,
Study), and repeating / one-time reminders — all in a black-cat theme
built from hand-drawn cat artwork.

This is the complete source of the app as it runs in Muse (a Hatch
TypeScript space, platformVersion 25), backed up here so it is never
lost. The repository name in Muse is `daily-checklist-v2`; this repo
is its public backup under the name Daily Pawcklist v1.

## Layout

- `client/` — the front end. `client/src/App.tsx` is the whole UI,
  `client/src/theme.css` the theme, `client/src/api.ts` the action
  client, and `client/src/assets/` the original cat artwork (used
  as-is, never redrawn).
- `server/` — the back end. `server/src/actions.ts` implements the
  app's actions (task / habit / reminder CRUD and the day view) and
  `server/src/schema.ts` the database schema.
- `drizzle/` — SQL migrations 0001–0005 that build the tables:
  tasks, habits, habit_logs, templates.
- `space.json`, `package.json`, `bunfig.toml`, `tsconfig*.json` —
  runtime and build configuration.

## Running it elsewhere

The app targets the Hatch space runtime. One dependency is local to
that environment:

- `@hatch/space-sdk` is referenced as a `file:/opt/hatch/...` path in
  `package.json`. To build or run outside Hatch, supply that SDK (or
  replace the import in `client/src/api.ts` and
  `server/src/actions.ts` with your own implementation of the same
  action transport and database layer).

Checklist data (tasks, Logs history, reminder settings) lives in the
app's database, not in this source tree. The schema and migrations
above recreate the tables; a fresh install seeds four Logs buttons
(Gym, Cook, Litter box, Study) and two reminders ("Take your meds",
weekends, morning; "Pick HelloFresh meals for next week", Friday,
afternoon).

## Backup note

This repo is a snapshot, not a live sync: edits made to the app in
Muse after this push are not reflected here until it is pushed
again.
