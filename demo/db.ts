// In-browser database for the demo: sql.js (SQLite compiled to wasm),
// built from the app's own drizzle/*.sql migrations, seeded with sample
// data relative to today, and persisted to localStorage.

import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import * as schema from "../server/src/schema";
import { seedDemo } from "./seed";

const STORAGE_KEY = "pawcklist-demo-db";

// Migrations in filename order (0001_..., 0002_...). PRAGMA user_version
// records how many have run, so a saved database picks up new ones.
const migrations = Object.entries(
  import.meta.glob<string>("../drizzle/*.sql", { query: "?raw", import: "default", eager: true }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, sql]) => sql);

let raw: Database | null = null;
let dbPromise: Promise<SQLJsDatabase<typeof schema>> | null = null;

export function getDemoDb(): Promise<SQLJsDatabase<typeof schema>> {
  dbPromise ??= open();
  return dbPromise;
}

async function open(): Promise<SQLJsDatabase<typeof schema>> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = load();
  raw = saved ? new SQL.Database(saved) : new SQL.Database();
  const applied = Number(raw.exec("PRAGMA user_version")[0]?.values[0]?.[0] ?? 0);
  migrations.slice(applied).forEach((sql) => {
    sql.split("--> statement-breakpoint").forEach((stmt) => {
      if (stmt.trim()) raw!.exec(stmt);
    });
  });
  raw.exec(`PRAGMA user_version = ${migrations.length}`);
  const db = drizzle(raw, { schema });
  if (!saved) await seedDemo(db);
  saveDemoDb();
  return db;
}

export function saveDemoDb(): void {
  if (!raw) return;
  try {
    const bytes = raw.export();
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    localStorage.setItem(STORAGE_KEY, btoa(bin));
  } catch {
    // Storage blocked or full: the demo still works for this visit.
  }
}

function load(): Uint8Array | null {
  try {
    const b64 = localStorage.getItem(STORAGE_KEY);
    if (!b64) return null;
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function resetDemoDb(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  location.reload();
}
