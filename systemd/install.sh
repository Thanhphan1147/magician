#!/bin/bash
# Install systemd services for Juju Magician

set -e

echo "=== Installing Juju Magician Systemd Services ==="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Project directory: $PROJECT_DIR"

# Ensure dependencies are installed
echo ""
echo "Checking dependencies..."

# Backend dependencies
if [ ! -d "$PROJECT_DIR/backend/venv" ]; then
    echo "Installing backend dependencies..."
    cd "$PROJECT_DIR/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    deactivate
fi

# Frontend dependencies
if [ ! -d "$PROJECT_DIR/frontend/node_modules" ] || [ -z "$(ls -A "$PROJECT_DIR/frontend/node_modules")" ]; then
    echo "Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    npm install
fi

# Copy service files to systemd
echo ""
echo "Installing systemd service files..."
sudo cp "$SCRIPT_DIR/juju-magician-backend.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/juju-magician-frontend.service" /etc/systemd/system/

# Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable services
echo "Enabling services..."
sudo systemctl enable juju-magician-backend.service
sudo systemctl enable juju-magician-frontend.service

# Start services
echo ""
echo "Starting services..."
sudo systemctl start juju-magician-backend.service
sudo systemctl start juju-magician-frontend.service

# Wait a moment for services to start
sleep 3

# Show status
echo ""
echo "=== Service Status ==="
sudo systemctl status juju-magician-backend.service --no-pager -l || true
echo ""
sudo systemctl status juju-magician-frontend.service --no-pager -l || true

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Services installed and started!"
echo ""
echo "Useful commands:"
echo "  Start:   sudo systemctl start juju-magician-{backend,frontend}"
echo "  Stop:    sudo systemctl stop juju-magician-{backend,frontend}"
echo "  Restart: sudo systemctl restart juju-magician-{backend,frontend}"
echo "  Status:  sudo systemctl status juju-magician-{backend,frontend}"
echo "  Logs:    sudo journalctl -u juju-magician-backend -f"
echo "           sudo journalctl -u juju-magician-frontend -f"
echo ""
echo "Access the application:"
echo "  Backend:  http://localhost:5000"
echo "  Frontend: http://localhost:5173"
echo ""
