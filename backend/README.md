# Juju Infrastructure Management - Backend

Flask API server that wraps the Juju CLI using the jubilant library.

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Running

```bash
# Run in mock mode (no actual Juju commands)
MOCK_MODE=true python app.py

# Run in production mode (requires Juju installed)
MOCK_MODE=false python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

- `POST /api/deploy` - Deploy a charm
- `POST /api/relate` - Create a relation
- `GET /api/status/<model>` - Get model status
- `GET /api/task/<task_id>` - Get task status
- `GET /api/models` - List available models
- `GET /health` - Health check
