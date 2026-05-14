#!/bin/sh
export PYTHONHOME="$SNAP/usr"
export PYTHONPATH="$SNAP/lib/python3.12/site-packages:$SNAP/usr/lib/python3.12"
export PATH="$SNAP/bin:$SNAP/usr/bin:/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
cd "$SNAP"
exec su -s /bin/sh ubuntu -c "PYTHONHOME='$PYTHONHOME' PYTHONPATH='$PYTHONPATH' PATH='$PATH' exec '$SNAP/bin/python3' '$SNAP/bin/flask' --app app run --host 0.0.0.0 --port 5000"
