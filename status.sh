#!/bin/bash
# Status check script for Juju Magician GUI

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Juju Magician Status ==="
echo ""

# Check backend
echo "Backend:"
if [ -f "backend.pid" ]; then
    BACKEND_PID=$(cat backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "  Status: Running (PID: $BACKEND_PID)"
        if curl -s http://localhost:5000/health > /dev/null 2>&1; then
            HEALTH=$(curl -s http://localhost:5000/health)
            echo "  Health: $HEALTH"
        else
            echo "  Health: Not responding"
        fi
    else
        echo "  Status: Not running (stale PID file)"
    fi
else
    echo "  Status: Not running"
fi

echo ""

# Check frontend
echo "Frontend:"
if [ -f "frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "  Status: Running (PID: $FRONTEND_PID)"
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo "  Access: http://localhost:5173"
        else
            echo "  Access: Not responding"
        fi
    else
        echo "  Status: Not running (stale PID file)"
    fi
else
    echo "  Status: Not running"
fi

echo ""

# Check Juju
echo "Juju:"
if command -v juju &> /dev/null; then
    JUJU_VERSION=$(juju version)
    echo "  Version: $JUJU_VERSION"
    CURRENT_MODEL=$(juju switch 2>/dev/null || echo "none")
    echo "  Current Model: $CURRENT_MODEL"
else
    echo "  Status: Not installed"
fi

echo ""
