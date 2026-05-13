#!/bin/sh
export PYTHONHOME="$SNAP/usr"
export PYTHONPATH="$SNAP/lib/python3.12/site-packages:$SNAP/usr/lib/python3.12"
cd "$SNAP"
exec "$SNAP/bin/python3" "$SNAP/bin/flask" --app app run --host 0.0.0.0 --port 5000
