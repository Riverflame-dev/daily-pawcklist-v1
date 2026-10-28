// Stand-in for "@hatch/space-sdk/client": the action client calls the
// real handlers from server/src/actions.ts in-page instead of POSTing to
// the space, then saves the database to localStorage.

import { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { Actions } from "../../server/src/actions";
import { getDemoDb, saveDemoDb } from "../db";
import type { ActionContext, ActionsModule } from "./server";

export const spaceQueryClient = new QueryClient();

type ActionClient<A extends ActionsModule> = {
  [K in keyof A]: (args: z.input<A[K]["request"]>) => Promise<z.output<A[K]["response"]>>;
};

type AnyFn = (...args: any[]) => Promise<unknown>;
export type ApiRequest<C, K extends keyof C> = C[K] extends AnyFn ? Parameters<C[K]>[0] : never;
export type ApiResponse<C, K extends keyof C> = C[K] extends AnyFn ? Awaited<ReturnType<C[K]>> : never;

export function createActionClient<A extends ActionsModule>(): ActionClient<A> {
  return new Proxy({} as ActionClient<A>, {
    get: (_target, name) => (args: unknown) => callAction(String(name), args),
  });
}

async function callAction(name: string, args: unknown): Promise<unknown> {
  const def = (Actions as ActionsModule)[name];
  if (!def) throw new Error(`unknown action: ${name}`);
  const db = await getDemoDb();
  let invalidate = false;
  const ctx: ActionContext = {
    db: () => db as never,
    invalidateQueries: () => {
      invalidate = true;
    },
  };
  const result = await def.handler(ctx, def.request.parse(args));
  saveDemoDb();
  if (invalidate) void spaceQueryClient.invalidateQueries();
  // Round-trip through JSON like the real HTTP transport (Dates -> strings).
  return def.response.parse(JSON.parse(JSON.stringify(result)));
}

export function SafeAreaTopScrim(_props: { backgroundColor?: string }) {
  return null;
}
