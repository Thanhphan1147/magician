#!/bin/bash
# Deploy script for Juju Magician GUI

set -e

echo "=== Juju Magician Deployment ==="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Juju is installed
if ! command -v juju &> /dev/null; then
    echo "Error: Juju is not installed. Please install Juju first."
    exit 1
fi

# Backend setup
echo "Setting up backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Start backend in background
echo "Starting backend server..."
MOCK_MODE=false nohup python app.py > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:5000/health > /dev/null; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# Frontend setup
cd ../frontend

# Install Node.js dependencies
echo "Installing frontend dependencies..."
npm install

# Start frontend in background
echo "Starting frontend server..."
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
echo "Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to be ready
echo "Waiting for frontend to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "Frontend is ready!"
        break
    fi
    sleep 1
done

echo ""
echo "=== Deployment Complete ==="
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo ""
echo "To stop the services, run: ./stop.sh"
echo "To view logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
