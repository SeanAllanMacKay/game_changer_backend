# Deploying to Railway

The backend is packaged as a Docker image (`Dockerfile`) that compiles the
TypeScript to `dist/` and runs `node dist/server.js`. `railway.json` pins the
Dockerfile builder and wires a healthcheck, so Railway needs no manual build
config.

Railway polls `GET /api/health` (configured in `railway.json`) after each
deploy and won't cut traffic over to a new release until it returns `200`. The
endpoint is a pure liveness probe — it doesn't touch the DB, so a transient
Aiven blip won't trigger restart loops.

## 1. Create the service

1. Push this repo to GitHub (or GitLab).
2. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
3. Railway sees the `Dockerfile` and builds it. No start command needed —
   the image's `CMD` runs the server.

## 2. Set environment variables

In the service's **Variables** tab, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `FE_ORIGIN` | your frontend host, no scheme (e.g. `app.example.com`) |
| `JWT_PASSPHRASE` | a long random secret |
| `COOKIE_SECRET` | a long random secret |
| `DB_HOST` | Aiven Postgres host |
| `DB_PORT` | Aiven Postgres port |
| `DB_USER` | Aiven user |
| `DB_PASSWORD` | Aiven password |
| `DB_DATABASE` | Aiven database name |
| `DB_CA_CERT` | full contents of `ca.pem` (paste the whole PEM, including the BEGIN/END lines) |
| `GEMINI_API_KEY` | your Gemini key |

Do **not** set `API_PORT` — Railway injects `PORT` and the server reads it.
`NGROK_*` are local-development only and aren't needed here.

> **`DB_CA_CERT`:** open `ca.pem` and paste its entire contents into the value
> box. Railway preserves the multi-line value. This replaces reading the
> gitignored `ca.pem` from disk (which isn't present in the image).

## 3. Expose the service

In **Settings → Networking → Public Networking**, click **Generate Domain**.
That URL is your backend origin — point the frontend's API base at it and add it
(without scheme) to the frontend's allowed origins. Update `FE_ORIGIN` here to
match the frontend so CORS and websocket auth line up.

## 4. Database migrations

The production image doesn't include `drizzle-kit` (a dev dependency), so run
migrations from your machine, which already has `ca.pem` and `.env`:

```bash
yarn db:migrate
```

(Or set `DB_CA_CERT` + the `DB_*` vars in your shell and run it against the
Aiven DB from anywhere — `drizzle.config.ts` now reads `DB_CA_CERT` too.)

## Local sanity check (optional)

Build and run the production image locally before deploying:

```bash
docker build -t game-changer-backend .
docker run --rm -p 8082:8082 --env-file .env -e PORT=8082 game-changer-backend
```
