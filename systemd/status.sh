#!/bin/bash
# Show status and logs for Juju Magician services

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Juju Magician Service Status ==="
echo ""

# Backend status
echo -e "${YELLOW}Backend Service:${NC}"
if systemctl is-active --quiet juju-magician-backend.service; then
    echo -e "  Status: ${GREEN}Running${NC}"
    BACKEND_PID=$(systemctl show -p MainPID --value juju-magician-backend.service)
    echo "  PID: $BACKEND_PID"
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        HEALTH=$(curl -s http://localhost:5000/health)
        echo "  Health: $HEALTH"
    else
        echo -e "  Health: ${RED}Not responding${NC}"
    fi
else
    echo -e "  Status: ${RED}Not running${NC}"
fi
echo ""

# Frontend status
echo -e "${YELLOW}Frontend Service:${NC}"
if systemctl is-active --quiet juju-magician-frontend.service; then
    echo -e "  Status: ${GREEN}Running${NC}"
    FRONTEND_PID=$(systemctl show -p MainPID --value juju-magician-frontend.service)
    echo "  PID: $FRONTEND_PID"
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "  Access: http://localhost:5173"
    else
        echo -e "  Access: ${RED}Not responding${NC}"
    fi
else
    echo -e "  Status: ${RED}Not running${NC}"
fi
echo ""

# Show recent logs
echo -e "${YELLOW}Recent Backend Logs (last 10 lines):${NC}"
sudo journalctl -u juju-magician-backend.service -n 10 --no-pager || echo "  No logs available"
echo ""

echo -e "${YELLOW}Recent Frontend Logs (last 10 lines):${NC}"
sudo journalctl -u juju-magician-frontend.service -n 10 --no-pager || echo "  No logs available"
echo ""

echo "To view live logs, run:"
echo "  sudo journalctl -u juju-magician-backend -f"
echo "  sudo journalctl -u juju-magician-frontend -f"
