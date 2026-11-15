#!/bin/sh
set -e

API="${VITE_API_BASE:-}"
API="${API%/}"
case "$API" in
  */api) API="${API%/api}" ;;
esac

API_BASE="$API" node -e "const v=process.env.API_BASE||''; process.stdout.write('window.__DOPEKIT_API_BASE__='+JSON.stringify(v)+';')" \
  > /app/dist/config.js

if [ -z "$API" ]; then
  echo "WARNING: VITE_API_BASE is empty; login will hit /api on this host instead of Django."
fi

exec serve dist -l "tcp://0.0.0.0:${PORT:-3000}" -s
