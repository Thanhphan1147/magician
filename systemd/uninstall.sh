#!/bin/bash
# Uninstall systemd services for Juju Magician

set -e

echo "=== Uninstalling Juju Magician Systemd Services ==="

# Stop services
echo "Stopping services..."
sudo systemctl stop juju-magician-backend.service || true
sudo systemctl stop juju-magician-frontend.service || true

# Disable services
echo "Disabling services..."
sudo systemctl disable juju-magician-backend.service || true
sudo systemctl disable juju-magician-frontend.service || true

# Remove service files
echo "Removing service files..."
sudo rm -f /etc/systemd/system/juju-magician-backend.service
sudo rm -f /etc/systemd/system/juju-magician-frontend.service

# Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload
sudo systemctl reset-failed || true

echo ""
echo "=== Uninstallation Complete ==="
echo "Services have been stopped and removed from systemd."
