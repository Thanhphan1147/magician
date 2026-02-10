# Systemd Service Setup for Juju Magician

This directory contains systemd service files and management scripts for running Juju Magician as system services.

## Features

- ✅ **Auto-restart on failure** - Services automatically restart if they crash
- ✅ **Auto-reload on code changes** - Flask debug mode and Vite HMR work with services
- ✅ **Centralized logging** - All logs go to journald
- ✅ **Start on boot** - Services can be enabled to start automatically
- ✅ **Standard service management** - Use familiar systemctl commands

## Quick Start

### Install and Start Services

```bash
cd systemd
./install.sh
```

This will:
1. Install backend and frontend dependencies if needed
2. Copy service files to `/etc/systemd/system/`
3. Enable and start both services
4. Show service status

### Check Status

```bash
cd systemd
./status.sh
```

Or use systemctl directly:
```bash
sudo systemctl status juju-magician-backend
sudo systemctl status juju-magician-frontend
```

### View Logs

Watch logs in real-time:
```bash
# Backend logs
sudo journalctl -u juju-magician-backend -f

# Frontend logs
sudo journalctl -u juju-magician-frontend -f

# Both together
sudo journalctl -u juju-magician-backend -u juju-magician-frontend -f
```

View recent logs:
```bash
sudo journalctl -u juju-magician-backend -n 100
sudo journalctl -u juju-magician-frontend -n 100
```

### Manage Services

```bash
# Start services
sudo systemctl start juju-magician-backend
sudo systemctl start juju-magician-frontend

# Stop services
sudo systemctl stop juju-magician-backend
sudo systemctl stop juju-magician-frontend

# Restart services (after code changes)
sudo systemctl restart juju-magician-backend
sudo systemctl restart juju-magician-frontend

# Enable auto-start on boot
sudo systemctl enable juju-magician-backend
sudo systemctl enable juju-magician-frontend

# Disable auto-start
sudo systemctl disable juju-magician-backend
sudo systemctl disable juju-magician-frontend
```

### Uninstall Services

```bash
cd systemd
./uninstall.sh
```

## Development Workflow

The systemd setup is designed to work seamlessly with development:

### Backend Development

1. **Edit code** in `backend/app.py`
2. **Flask auto-reloads** automatically (debug mode enabled)
3. **Or manually restart**: `sudo systemctl restart juju-magician-backend`
4. **View logs**: `sudo journalctl -u juju-magician-backend -f`

### Frontend Development

1. **Edit code** in `frontend/src/`
2. **Vite HMR updates** browser automatically
3. **Or manually restart**: `sudo systemctl restart juju-magician-frontend`
4. **View logs**: `sudo journalctl -u juju-magician-frontend -f`

## Service Files

### juju-magician-backend.service

- **User**: ubuntu
- **Working Directory**: `/home/trung.thanh.phan@canonical.com/personal/magician/backend`
- **Environment**:
  - `MOCK_MODE=false` (use real Juju)
  - `FLASK_DEBUG=true` (auto-reload enabled)
- **Restart**: Always (with 3 second delay)
- **Logs**: journald with identifier `juju-magician-backend`

### juju-magician-frontend.service

- **User**: ubuntu
- **Working Directory**: `/home/trung.thanh.phan@canonical.com/personal/magician/frontend`
- **Command**: `npm run dev`
- **Restart**: Always (with 3 second delay)
- **Logs**: journald with identifier `juju-magician-frontend`

## Accessing the Application

Once services are running:

- **Frontend**: http://localhost:5173 (or http://10.71.108.112:5173)
- **Backend**: http://localhost:5000 (or http://10.71.108.112:5000)
- **Backend Health**: http://localhost:5000/health

## Troubleshooting

### Service won't start

```bash
# Check service status
sudo systemctl status juju-magician-backend
sudo systemctl status juju-magician-frontend

# Check logs
sudo journalctl -u juju-magician-backend -n 50
sudo journalctl -u juju-magician-frontend -n 50
```

### Dependencies not installed

```bash
# Reinstall
cd systemd
./uninstall.sh
./install.sh
```

### Port already in use

Check what's using the ports:
```bash
sudo lsof -i :5000  # Backend
sudo lsof -i :5173  # Frontend
```

### Permission issues

Ensure the service user (ubuntu) has access to the project directory:
```bash
ls -la /home/trung.thanh.phan@canonical.com/personal/magician
```

### Service fails after reboot

If services don't auto-start after reboot:
```bash
# Enable services
sudo systemctl enable juju-magician-backend
sudo systemctl enable juju-magician-frontend

# Verify enabled
systemctl is-enabled juju-magician-backend
systemctl is-enabled juju-magician-frontend
```

## Files

```
systemd/
├── juju-magician-backend.service   # Backend systemd service file
├── juju-magician-frontend.service  # Frontend systemd service file
├── install.sh                      # Installation script
├── uninstall.sh                    # Uninstallation script
├── status.sh                       # Status check script
└── README.md                       # This file
```

## Notes

- Services run as the `ubuntu` user (change in service files if needed)
- Both services have auto-restart enabled (RestartSec=3)
- Flask runs in debug mode for auto-reload during development
- Vite dev server provides HMR (Hot Module Replacement)
- All output goes to systemd journal (use journalctl to view)
- Services are enabled by default (start on boot)

## Production Considerations

For production deployment, consider:

1. **Disable debug mode**: Remove `FLASK_DEBUG=true` from backend service
2. **Use gunicorn**: Replace Flask dev server with gunicorn
3. **Build frontend**: Use `npm run build` instead of `npm run dev`
4. **Use nginx**: Serve frontend build and proxy API requests
5. **Add authentication**: Implement auth middleware
6. **Configure firewall**: Restrict access to necessary ports
7. **Set up monitoring**: Add health checks and alerting
8. **Use secrets management**: Move sensitive config to environment files

## License

Apache 2.0
