#!/bin/sh
cp "$SNAP/frontend/vite.config.js" "$SNAP_DATA/vite.config.js"
cp "$SNAP/frontend/package.json" "$SNAP_DATA/package.json"
ln -sf "$SNAP/frontend/dist" "$SNAP_DATA/dist"
ln -sf "$SNAP/frontend/node_modules" "$SNAP_DATA/node_modules"
cd "$SNAP_DATA"
exec "$SNAP/bin/node" "$SNAP/frontend/node_modules/.bin/vite" preview --host 0.0.0.0 --port 8080
