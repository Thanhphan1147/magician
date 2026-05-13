#!/bin/sh
cd "$SNAP"
exec runuser -u ubuntu -- "$SNAP/bin/python3" "$SNAP/bin/flask" --app app run --host 0.0.0.0 --port 5000
