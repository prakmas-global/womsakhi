#!/usr/bin/env bash
#
# WomSakhi — stop both dev servers (frontend :3100 and backend :8020).
# Useful if you started them in the background or a run didn't shut down cleanly.
#
#   ./stop.sh      or      npm run stop
#
set -uo pipefail

for entry in "3100:frontend" "8020:backend"; do
  port="${entry%%:*}"; label="${entry##*:}"
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping $label on port $port (pids: $(echo "$pids" | tr '\n' ' '))"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    # shellcheck disable=SC2086
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
    echo "  stopped."
  else
    echo "$label on port $port — already stopped."
  fi
done
echo "Done."
