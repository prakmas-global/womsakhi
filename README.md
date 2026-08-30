# WomSakhi

A women-empowerment admin platform — **Next.js** frontend + **FastAPI / MongoDB** backend.

## Run everything with one command

From this folder (`PRAKMAS-GLOBAL/`):

```bash
./dev.sh
# or
npm run dev
```

This single command will:

1. Free ports `3000` and `8010` if something stale is holding them.
2. Install backend (`venv` + `pip`) and frontend (`npm`) dependencies **on first run only**.
3. Start the **backend** on http://localhost:8010 and connect it to **MongoDB Atlas**.
4. Start the **frontend** on http://localhost:3000.
5. Stream both logs side-by-side (`[api]` / `[web]`) and print the DB connection status.

Press **Ctrl+C** to stop both cleanly.

| Service  | URL                              |
| -------- | -------------------------------- |
| Frontend | http://localhost:3000            |
| Backend  | http://localhost:8010            |
| API base | http://localhost:8010/api/v1     |
| API docs | http://localhost:8010/docs       |

Logs are written to `.dev-logs/backend.log` and `.dev-logs/frontend.log`.

## Stop the servers

```bash
./stop.sh
# or
npm run stop
```

## Layout

```
PRAKMAS-GLOBAL/
├── dev.sh                 # one-command runner (frontend + backend + DB)
├── stop.sh               # stop both servers
├── package.json          # npm run dev / npm run stop
├── womsakhi-frontend/frontend   # Next.js app  (port 3000)
└── womsakhi-backend/backend     # FastAPI app  (port 8010, MongoDB)
```

> The backend reads its `MONGODB_URI` from `womsakhi-backend/backend/.env`.
> If the database can't be reached, the backend still boots and the runner
> prints a warning so the UI keeps working.
