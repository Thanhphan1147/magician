### Multipass VM Deployment
- Everything is done in a multipass VM. Do not make any changes to the host machine.
- The project is mounted in the VM at `/home/trung.thanh.phan@canonical.com/personal/magician`
- Assume that there's a multipass VM pre-spawned. Find the name using `multipass list`. Interact with the VM using `multipass exec <VM_NAME> -- <command>`. If there's no VM, ask the project manager to spawn one.
- node is installed in the multipass VM. It's installed with nvm. Any actions that require node/npm/npx should be executed inside the multipass VM using `multipass exec <VM_NAME> -- <command>`. Install nvm following the official guide for ubuntu if nvm is not installed.
- ALWAYS rebuild, restart the service and test the service after every change.
- Rebuilds must be done inside the multipass VM.
- Rebuild and refresh the systemd service after every change:
```bash
# Build frontend
multipass exec dev -- bash -c "cd /home/trung.thanh.phan@canonical.com/personal/magician/frontend && npm run build"

# Restart services in VM
multipass exec dev -- sudo systemctl restart juju-magician-backend juju-magician-frontend

# Check status
multipass exec dev -- systemctl is-active juju-magician-backend juju-magician-frontend

# View logs
multipass exec dev -- sudo journalctl -u juju-magician-backend -f
multipass exec dev -- sudo journalctl -u juju-magician-frontend -f
```
- Test the service using the Chrome MCP server. Fetch the multipass IP address using `multipass list` and open `http://<MULTIPASS_IP>:<PORT>` in the browser. Assume a Chrome browser instance is already running.