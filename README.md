# WomSakhi

A women-empowerment admin platform — **Next.js** frontend + **FastAPI / MongoDB** backend.

## Documentation

- [Modules and features](docs/MODULES_AND_FEATURES.md): member and admin capabilities, user journeys, access rules and integration boundaries.
- [Technical module inventory](docs/MODULE_TECHNICAL_INVENTORY.md): every page file and registered backend router, with links to source.
- [Production operations](docs/PRODUCTION_OPERATIONS.md): health checks, protected metrics, release gates and recovery procedure.
- [Full-stack audit](docs/FULL_STACK_AUDIT_2026-10-30.md): validation results and observed limitations.

Regenerate the technical inventory after adding or removing routes:

```bash
python3 scripts/generate_module_inventory.py
```

## Run everything with one command

From the repository root:

```bash
./dev.sh
# or
npm run dev
```

This single command will:

1. Free ports `3100` and `8020` if something stale is holding them.
2. Install backend (`venv` + `pip`) and frontend (`npm`) dependencies **on first run only**.
3. Start the **backend** on http://localhost:8020 and connect it to **MongoDB Atlas**.
4. Start the **frontend** on http://localhost:3100.
5. Stream both logs side-by-side (`[api]` / `[web]`) and print the DB connection status.

Press **Ctrl+C** to stop both cleanly.

| Service  | URL                              |
| -------- | -------------------------------- |
| Frontend | http://localhost:3100            |
| Backend  | http://localhost:8020            |
| API base | http://localhost:8020/api/v1     |
| API docs | http://localhost:8020/docs       |

Logs are written to `.dev-logs/backend.log` and `.dev-logs/frontend.log`.

## Stop the servers

```bash
./stop.sh
# or
npm run stop
```

## Layout

```
womsakhi/
├── dev.sh                 # one-command runner (frontend + backend + DB)
├── stop.sh               # stop both servers
├── package.json          # npm run dev / npm run stop
├── womencrafts-frontend/frontend   # Next.js app  (port 3100)
└── womencrafts-backend/backend     # FastAPI app  (port 8020, MongoDB)
```

> The backend reads its `MONGODB_URI` from `womencrafts-backend/backend/.env`.
> If the database can't be reached, the backend still boots and the runner
> prints a warning so the UI keeps working.
