# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `yarn dev` — runs `nodemon src/server.ts`, which execs `node -r ts-node/register --env-file=.env` (see `nodemon.json`). There is no `build`, `test`, or `lint` script — do not assume one exists.
- `yarn db:generate` — produce a new SQL migration in `drizzle/` from changes to `src/services/db/schemas/` (drizzle-kit generate).
- `yarn db:migrate` — apply pending migrations against the DB defined in `.env` (drizzle-kit migrate).
- `npx drizzle-kit studio` — open Drizzle Studio against the configured DB.

Drizzle Kit reads `drizzle.config.ts`, which loads `dotenv` and requires `ca.pem` at the repo root for TLS to the Postgres host. Both files are gitignored (see `.gitignore`).

## Architecture

Express 5 + TypeScript + Drizzle ORM (Postgres) backend. Single entrypoint `src/server.ts` mounts `routers/index.ts` under `/api`. In `NODE_ENV=development` it also opens an ngrok tunnel using `NGROK_DOMAIN` / `NGROK_AUTHTOKEN`.

Three-layer convention — keep new code in the same shape:

1. **`src/routers/`** — Express routers, one file per URL segment. Folder names mirror the URL path; dynamic segments use square-bracket names (e.g. `routers/games/[gameCode]/index.ts` handles `/api/games/:gameCode`). Routers are thin: parse request, call an action, map `{ status, message, ... }` onto the response, and translate thrown `{ status, error }` shapes back to the client. Auth-gated routes wrap the handler with `verifyToken` middleware (see below).
2. **`src/actions/`** — Pure functions that orchestrate the work. Validate input with `zod`, call DB queries, and return `{ status, message, ... }` on success or `throw { status, error }` on failure. Re-exported via `actions/index.ts` so routers import from `"../../actions"`.
3. **`src/services/db/`** — Drizzle setup. The `db` client is constructed in `services/db/index.ts` using the same `ca.pem` as Drizzle Kit. Queries (in `queries/select/` and `queries/insert/`) are the only callers of `db.*`; actions never touch the client directly.

Within `services/db/`:

- `schemas/` — `pgTable` definitions, one file per table, all re-exported through `schemas/index.ts`.
- `relations/` — Drizzle `relations()` declarations, one file per table, re-exported through `relations/index.ts`.
- Both barrels are spread into the drizzle instance: `drizzle(client, { schema: { ...schema, ...relations } })`. When you add a new table, you must add it to **both** `schemas/index.ts` and `relations/index.ts` for relational queries (`db.query.X.findFirst({ with: ... })`) to resolve.
- `Game.gameCode` is a 6-letter text primary key generated client-side via `$defaultFn` — other tables reference games by `gameCode`, not by a numeric id.

## Auth

- `services/auth/index.ts` is a thin wrapper around `jsonwebtoken` keyed off `JWT_PASSPHRASE`; tokens expire after 86400s.
- `services/auth/verifyToken.ts` is the auth middleware. It reads the JWT from `req.signedCookies.auth` (signed with `COOKIE_SECRET`), looks up the user via `getUserById`, and attaches it as `req.user`. On any failure it short-circuits with `401 Unauthorized`.
- On login/signup, the router sets the cookie itself (`httpOnly`, `signed`, `sameSite: "none"`, `secure: true`). Actions return the raw `newToken`; only routers touch `res.cookie`.
- `POST /api/user/login` is dual-purpose: if no user matches the supplied `name`, it falls through to `signUp` and creates one. There is no separate signup endpoint.

## Response/error contract

Actions return `{ status, message, ...payload }` (status from `HTTP_STATUSES` in `actions/HTTP_STATUSES.ts`). On failure they `throw` an object of shape `{ status, error }` — never a JS `Error`. Routers destructure with defaults: `const { status = 500, error = "..." } = caught`. Preserve this shape when adding new actions/routes so the existing catch blocks keep working.

## Environment

Required vars (see `.env.template`): `NODE_ENV`, `API_PORT` (avoid 8081 — frontend), `FE_ORIGIN` (used by CORS for both `http://` and `https://`), `JWT_PASSPHRASE`, `COOKIE_SECRET`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `NGROK_DOMAIN`, `NGROK_AUTHTOKEN`.
