# Demo build

Builds the real app (`client/` + `server/src/actions.ts`) into a static
page for GitHub Pages: https://riverflame-dev.github.io/daily-pawcklist-v1/

The Hatch-only `@hatch/space-sdk` is swapped for the shims in `sdk/`,
which run the server actions in the browser against a sql.js (SQLite
wasm) database. The tables come from `drizzle/*.sql`, sample data from
`seed.ts`, and the database is saved to the visitor's localStorage.

`.github/workflows/deploy-demo.yml` rebuilds and deploys it on every
push to `main` that touches `client/`, `server/`, `drizzle/` or `demo/`.

Locally:

```sh
cd demo
npm install
npm run dev     # or: npm run build  (output in demo/dist)
```
