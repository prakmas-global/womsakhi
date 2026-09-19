#!/usr/bin/env bash
#
# WomenCrafts — one-command dev runner
# ------------------------------------
# Starts BOTH services together and connects the backend to MongoDB:
#   • FastAPI backend  →  http://localhost:8020   (+ MongoDB Atlas)
#   • Next.js frontend →  http://localhost:3100
#
# It also: frees stale ports, auto-installs missing deps on first run,
# streams both logs side-by-side, reports DB connection status, and shuts
# everything down cleanly on Ctrl+C.
#
# Usage:
#   ./dev.sh            # start everything
#   npm run dev         # same thing (from the project root)
#
set -uo pipefail

# ---- paths -----------------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/womencrafts-backend/backend"
FRONTEND_DIR="$ROOT/womencrafts-frontend/frontend"
LOG_DIR="$ROOT/.dev-logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACKEND_PORT=8020
FRONTEND_PORT=3100

# ---- pretty output ---------------------------------------------------------
BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
CYAN=$'\033[36m'; MAGENTA=$'\033[35m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'

say()  { printf "%s\n" "${BOLD}${MAGENTA}▶ ${1}${RESET}"; }
ok()   { printf "%s\n" "${GREEN}✔ ${1}${RESET}"; }
warn() { printf "%s\n" "${YELLOW}! ${1}${RESET}"; }
err()  { printf "%s\n" "${RED}✖ ${1}${RESET}"; }

# ---- process state ---------------------------------------------------------
BACKEND_PID=""
FRONTEND_PID=""

free_port() {
  local port="$1" label="$2" pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    warn "Port $port ($label) busy — stopping stale process(es): $(echo "$pids" | tr '\n' ' ')"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    # shellcheck disable=SC2086
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  fi
}

cleanup() {
  trap - INT TERM EXIT
  echo
  say "Shutting down…"
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  pkill -P $$ 2>/dev/null || true          # reap log-streamers / subshells
  free_port "$FRONTEND_PORT" frontend      # guarantee ports are free next time
  free_port "$BACKEND_PORT"  backend
  ok "All stopped. Bye!"
  exit 0
}
trap cleanup INT TERM

# ---- preflight -------------------------------------------------------------
[ -d "$BACKEND_DIR" ]  || { err "Backend not found at $BACKEND_DIR";  exit 1; }
[ -d "$FRONTEND_DIR" ] || { err "Frontend not found at $FRONTEND_DIR"; exit 1; }

mkdir -p "$LOG_DIR"
: > "$BACKEND_LOG"
: > "$FRONTEND_LOG"

# Backend virtualenv + dependencies (first run only)
if [ ! -x "$BACKEND_DIR/venv/bin/python" ]; then
  say "Creating Python virtualenv for backend…"
  python3 -m venv "$BACKEND_DIR/venv" || { err "Could not create venv"; exit 1; }
  "$BACKEND_DIR/venv/bin/python" -m pip install --quiet --upgrade pip
  "$BACKEND_DIR/venv/bin/python" -m pip install --quiet -r "$BACKEND_DIR/requirements.txt" \
    && ok "Backend dependencies installed" || { err "pip install failed"; exit 1; }
fi

# Frontend dependencies (first run only)
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  say "Installing frontend dependencies (first run, may take a minute)…"
  ( cd "$FRONTEND_DIR" && npm install ) || { err "npm install failed"; exit 1; }
  ok "Frontend dependencies installed"
fi

# Free any stale ports before we start
free_port "$BACKEND_PORT"  backend
free_port "$FRONTEND_PORT" frontend

# ---- start backend ---------------------------------------------------------
say "Starting backend  → http://localhost:$BACKEND_PORT  (FastAPI + MongoDB)"
( cd "$BACKEND_DIR" && exec venv/bin/python main.py ) >>"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
tail -n +1 -f "$BACKEND_LOG" | while IFS= read -r line; do
  printf '%s[api]%s %s\n' "$CYAN" "$RESET" "$line"
done &

say "Waiting for backend to be ready…"
code=000
for _ in $(seq 1 60); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    err "Backend exited during startup — see $BACKEND_LOG"; cleanup
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 3 "http://localhost:$BACKEND_PORT/health" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" = "200" ]; then
  ok "Backend up  → http://localhost:$BACKEND_PORT  (docs: /docs · api: /api/v1)"
else
  warn "Backend didn't pass health check in time — check $BACKEND_LOG"
fi

# Report MongoDB connection status (from the backend's own startup log)
sleep 1
if grep -q "Connected to MongoDB" "$BACKEND_LOG"; then
  ok "Database connected → MongoDB Atlas"
elif grep -q "without a database" "$BACKEND_LOG"; then
  warn "Backend running but could NOT reach MongoDB — check womencrafts-backend/backend/.env (MONGODB_URI)"
fi

# ---- start frontend --------------------------------------------------------
say "Starting frontend → http://localhost:$FRONTEND_PORT  (Next.js)"
( cd "$FRONTEND_DIR" && exec npm run dev -- --port "$FRONTEND_PORT" ) >>"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
tail -n +1 -f "$FRONTEND_LOG" | while IFS= read -r line; do
  printf '%s[web]%s %s\n' "$MAGENTA" "$RESET" "$line"
done &

say "Waiting for frontend to compile…"
code=000
for _ in $(seq 1 120); do
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    err "Frontend exited during startup — see $FRONTEND_LOG"; cleanup
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 3 "http://localhost:$FRONTEND_PORT" 2>/dev/null || echo 000)"
  [ "$code" != "000" ] && break
  sleep 1
done
if [ "$code" != "000" ]; then
  ok "Frontend up → http://localhost:$FRONTEND_PORT"
else
  warn "Frontend didn't respond in time — check $FRONTEND_LOG"
fi

# ---- ready -----------------------------------------------------------------
echo
printf "%s\n" "${BOLD}${GREEN}──────────────────────────────────────────────────────────────${RESET}"
printf "%s\n" "  ${BOLD}WomenCrafts is running 🎉${RESET}"
printf "%s\n" "    Frontend   ${BOLD}http://localhost:$FRONTEND_PORT${RESET}"
printf "%s\n" "    Backend    ${BOLD}http://localhost:$BACKEND_PORT${RESET}   (api: /api/v1 · docs: /docs)"
printf "%s\n" "  ${DIM}Logs in $LOG_DIR   ·   Press Ctrl+C to stop both${RESET}"
printf "%s\n" "${BOLD}${GREEN}──────────────────────────────────────────────────────────────${RESET}"
echo

# Block here, streaming logs, until a server stops or the user hits Ctrl+C
wait "$BACKEND_PID" "$FRONTEND_PID"
cleanup
