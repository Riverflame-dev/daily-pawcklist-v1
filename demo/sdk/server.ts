// Stand-in for "@hatch/space-sdk" (server side): just enough of
// defineAction / ActionsModule for server/src/actions.ts to run in the
// browser. Handlers get a ctx whose db() is drizzle over sql.js.

import type { SQLJsDatabase } from "drizzle-orm/sql-js";
import { z } from "zod";

export { z };

export interface ActionContext {
  db<S extends Record<string, unknown>>(): SQLJsDatabase<S>;
  invalidateQueries(): void;
}

export interface ActionDefinition<Req extends z.ZodType, Res extends z.ZodType> {
  request: Req;
  response: Res;
  handler(ctx: ActionContext, args: z.output<Req>): Promise<z.input<Res>>;
}

export type ActionsModule = Record<string, ActionDefinition<any, any>>;

export function defineAction<Req extends z.ZodType, Res extends z.ZodType>(
  def: ActionDefinition<Req, Res>,
): ActionDefinition<Req, Res> {
  return def;
}
