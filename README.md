# Juju Magician - Infrastructure Management GUI

A modern web application for visualizing and managing Juju infrastructure. Built with Svelte 5 and Flask.

## Project Structure

```
magician/
├── backend/
│   ├── app.py                 # Flask API server
│   ├── requirements.txt       # Python dependencies
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── nodes/
│   │   │   │   ├── CharmNode.svelte    # Custom charm node component
│   │   │   │   └── ModelFrame.svelte   # Group node for Juju models
│   │   │   ├── edges/
│   │   │   │   └── RelationEdge.svelte # Custom relation edge component
│   │   │   └── api.js                   # API utility functions
│   │   ├── App.svelte                   # Main application
│   │   ├── main.js                      # Entry point
│   │   └── app.css                      # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── svelte.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
└── README.md
```

## Features

### Backend (Flask)
- ✅ Async execution using ThreadPoolExecutor
- ✅ Mock mode for testing without Juju
- ✅ RESTful API endpoints
- ✅ CORS enabled for frontend integration
- ✅ Background task tracking

### Frontend (Svelte 5)
- ✅ Custom CharmNode with 6 input fields
- ✅ Custom RelationEdge with endpoint configuration
- ✅ ModelFrame as a Group Node
- ✅ Drag-and-drop canvas using Svelte Flow
- ✅ Real-time status updates
- ✅ Modern UI with TailwindCSS
- ✅ Svelte 5 Runes syntax ($state, $derived)

## Getting Started

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run in mock mode (recommended for testing)
MOCK_MODE=true python app.py

# Or run with real Juju (requires Juju installed)
MOCK_MODE=false python app.py
```

The backend will start on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5173`

## Usage

### 1. Adding Charm Nodes
- Click "Add Charm Node" in the sidebar
- Fill in the charm details (charm name is required)
- Click "Deploy" to deploy the charm
- The node border will turn green when deployed successfully

### 2. Creating Relations
- Connect two charm nodes by dragging from one handle to another
- A control panel will appear in the middle of the edge
- Enter the source and target endpoints (e.g., `db:database`, `app:database`)
- Click "Connect" to create the relation
- The edge will turn solid green when the relation is established

### 3. Model Management
- Each Model Frame represents a Juju model
- Click "Refresh Status" to sync the latest model state
- Drag charm nodes into the frame to assign them to that model
- Add multiple model frames to manage different models

### 4. Canvas Controls
- **Pan**: Click and drag the canvas background
- **Zoom**: Use mouse wheel or the zoom controls
- **MiniMap**: Use the minimap in the bottom-right corner for navigation
- **Clear**: Click "Clear Canvas" to reset everything

## API Endpoints

### POST `/api/deploy`
Deploy a charm to a Juju model

**Request Body:**
```json
{
  "model": "default",
  "charm": "postgresql-k8s",
  "channel": "stable",
  "revision": "",
  "charm_name": "db",
  "config": "user=admin, pass=secret",
  "constraints": ""
}
```

**Response:**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### POST `/api/relate`
Create a relation between two endpoints

**Request Body:**
```json
{
  "model": "default",
  "endpoint_a": "db:database",
  "endpoint_b": "app:database"
}
```

**Response:**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

### GET `/api/status/<model>`
Get the status of a Juju model

**Response:**
```json
{
  "model": {
    "name": "default",
    "cloud": "microk8s",
    "version": "3.1.0"
  },
  "applications": {
    "postgresql": {
      "charm": "postgresql-k8s",
      "status": {
        "status": "active"
      }
    }
  }
}
```

### GET `/api/task/<task_id>`
Get the status of a background task

**Response:**
```json
{
  "status": "completed",
  "result": {
    "success": true,
    "message": "Deployed postgresql-k8s to model default"
  }
}
```

## Development

### Mock Mode
The backend runs in mock mode by default (`MOCK_MODE=true`). This is useful for:
- UI development and testing
- Demos without Juju installed
- Faster iteration

Mock mode simulates:
- Deployment delays (2 seconds)
- Relation creation delays (1 second)
- Sample status responses

### Real Juju Mode
To use with real Juju:
1. Install Juju: `sudo snap install juju --classic`
2. Bootstrap a controller
3. Set `MOCK_MODE=false` when starting the backend

## Technologies

### Backend
- **Flask**: Web framework
- **flask-cors**: CORS support
- **jubilant**: Juju Python library
- **concurrent.futures**: Async task execution

### Frontend
- **Svelte 5**: Reactive UI framework (Runes mode)
- **@xyflow/svelte**: Flow-based canvas library
- **TailwindCSS**: Utility-first CSS framework
- **Vite**: Build tool and dev server

## Architecture

### Data Flow
1. User interacts with Svelte components (CharmNode, RelationEdge)
2. Components call API functions from `lib/api.js`
3. API functions send HTTP requests to Flask backend
4. Flask creates background tasks using ThreadPoolExecutor
5. Tasks execute Juju commands via jubilant library
6. Frontend polls for task completion
7. UI updates based on task results

### Component Hierarchy
```
App.svelte
├── Sidebar (tools and controls)
└── SvelteFlow (canvas)
    ├── ModelFrame (group nodes)
    │   └── CharmNode (draggable, nested)
    └── RelationEdge (custom edges)
```

## Troubleshooting

### Frontend can't connect to backend
- Ensure backend is running on port 5000
- Check Vite proxy configuration in `vite.config.js`
- Verify CORS is enabled in Flask

### Svelte dependencies not found
```bash
cd frontend
npm install
```

### Python dependencies not found
```bash
cd backend
pip install -r requirements.txt
```

### Juju commands fail in production mode
- Verify Juju is installed: `juju version`
- Check you have a bootstrapped controller
- Ensure the model exists: `juju models`

## License

MIT

## Contributing

Contributions welcome! Please open an issue or pull request.
