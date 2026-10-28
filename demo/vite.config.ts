// Static build of the real app for GitHub Pages.
//
// The app normally runs inside the Hatch space runtime, which supplies
// @hatch/space-sdk (action transport + database). Here those imports are
// swapped for the small shims in ./sdk, which run the real server actions
// from server/src/actions.ts in the browser against a sql.js database.

import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("."),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@hatch\/space-sdk\/client$/, replacement: here("./sdk/client.tsx") },
      { find: /^@hatch\/space-sdk$/, replacement: here("./sdk/server.ts") },
    ],
  },
  server: { fs: { allow: [here("..")] } },
  build: {
    outDir: here("./dist"),
    emptyOutDir: true,
  },
});
