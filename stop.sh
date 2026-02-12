#!/bin/bash
# Stop script for Juju Magician GUI

set -e

echo "=== Stopping Juju Magician ==="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Stop backend
if [ -f "backend.pid" ]; then
    BACKEND_PID=$(cat backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        rm backend.pid
        echo "Backend stopped"
    else
        echo "Backend process not running"
        rm backend.pid
    fi
else
    echo "No backend.pid file found"
fi

# Stop frontend
if [ -f "frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        rm frontend.pid
        echo "Frontend stopped"
    else
        echo "Frontend process not running"
        rm frontend.pid
    fi
else
    echo "No frontend.pid file found"
fi

echo ""
echo "=== Juju Magician Stopped ==="
