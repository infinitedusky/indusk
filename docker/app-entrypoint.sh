#!/bin/sh
# Entrypoint for app containers — bypasses turbo so Docker env vars
# reach the app process. turbo strips env vars from child processes,
# so we use pnpm --filter directly instead of turbo run.
#
# Usage: docker-compose command field passes the pnpm filter name:
#   command: "@myorg/myapp"

APP_FILTER="$1"

if [ "$NODE_ENV" = "production" ]; then
  pnpm --filter "$APP_FILTER" build
  exec pnpm --filter "$APP_FILTER" start
else
  exec pnpm --filter "$APP_FILTER" dev
fi
