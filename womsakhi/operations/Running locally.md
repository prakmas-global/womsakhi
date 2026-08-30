---
status: stable
updated: 2026-08-22
tags: [ops]
---

# Running locally

Two processes. Backend first — the frontend expects it on :8020.

## Backend

```bash
cd womencrafts-backend/backend
source venv/bin/activate
uvicorn main:app --reload --port 8020 --host 0.0.0.0
```

Interactive API docs: `http://localhost:8020/docs`. Genuinely the fastest way to
check a payload shape — faster than reading the router.

## Frontend

```bash
cd womencrafts-frontend/frontend
npm run dev -- --port 3100
```

`http://localhost:3100`. Next.js 16 with Turbopack.

## Stack facts worth knowing

- **Next.js 16** — middleware is `proxy.ts`, *not* `middleware.ts`. Renamed in
  16. A file called `middleware.ts` is silently ignored, which is a confusing
  half hour.
- **React 19**
- **Tailwind v4** — config lives in CSS via `@theme static`, not
  `tailwind.config.js`. This is what makes [[Theme engine|theming]] work.
- **MongoDB Atlas** via Motor (async). No local Mongo.
- **Pydantic v2** — `model_validate`, not `parse_obj`.

## Seeding

`app/core/seed.py` and `seed_all.py` populate demo data on startup. See
[[Demo accounts]].

Related: [[Secrets]], [[Testing]]


## Ports, and why they are what they are

**Frontend :3100 · backend :8020.** One command starts both:

```bash
./dev.sh          # or: npm run dev
./stop.sh         # stops both
```

The API port is not a preference. This machine runs an unrelated Docker project
(`lawvyn`) whose containers publish **3000, 3001, 8000, 8001, 8002 and 8003**
with `restart: always`. The app took :3000 back by stopping one container:

```bash
docker stop lawvyn-frontend-1     # frees :3000
docker start lawvyn-frontend-1    # give it back
```

**That container returns on its own every time Docker Desktop starts**, so :3000
has to be re-freed after a reboot. Before assuming a response on :3000 is
WomSakhi, check who is actually listening — a 307 from lawvyn looks exactly like
a 307 from us:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

The API stays on **:8020** deliberately rather than moving to :8000 or :8002.
Those are Docker's too, and pinning the API there would break it on the next
reboot with no obvious cause.

The port is written in five places and they must agree, or the app half-works in
ways that look like unrelated bugs:

| Where | What |
|---|---|
| `dev.sh` | `BACKEND_PORT` / `FRONTEND_PORT` |
| `backend/main.py` | the uvicorn call, and `allow_origins` for CORS |
| `backend/.env` | `MEDIA_BASE_URL` |
| `backend/app/core/config.py` | the `APP_BASE_URL` / `MEDIA_BASE_URL` defaults, used in emails |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` |

The browser checks read the port from the environment (`checks/_shared.mjs`), so
they cannot drift from the dev server.

**It must be `localhost`, never `127.0.0.1`.** The session is an httpOnly cookie
scoped to `localhost`. Point the API at `127.0.0.1` and the browser treats it as
a different origin and stops sending the cookie — `/auth/session` returns
`{user: null}`, and **every member screen sits on a spinner forever** while curl
against the same endpoint works perfectly. That combination is what makes it
hard to spot: the API is fine, the data is fine, and the app is dead.

Bind uvicorn with `--host 0.0.0.0` so `localhost` resolves to it either way.
