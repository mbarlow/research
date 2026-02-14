#!/bin/bash
# Dev server with live-reload + auto-rebuild content index

cd "$(dirname "$0")"

# Build index on start
node scripts/build-index.js

# Watch for post changes and rebuild index in background
(while true; do
  inotifywait -q -r -e modify,create,delete posts/ 2>/dev/null && node scripts/build-index.js
done) &
WATCH_PID=$!

trap "kill $WATCH_PID 2>/dev/null; exit" INT TERM

# Serve with live-reload (watches all files)
bunx browser-sync start --server --files "**/*.css, **/*.js, **/*.html, content.json, posts/*.md" --no-notify --port 3070
