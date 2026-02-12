"""
Juju Infrastructure Management Backend
A Flask API that wraps the Juju CLI using the jubilant library
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor
import uuid
import json
from urllib.parse import unquote
from typing import Dict, Any
import threading
import subprocess
import jubilant

app = Flask(__name__)
CORS(app)

# Configuration
executor = ThreadPoolExecutor(max_workers=4)

# In-memory state cache
tasks: Dict[str, Dict[str, Any]] = {}
tasks_lock = threading.Lock()


def parse_config_string(config_str: str) -> Dict[str, str]:
    """
    Parse config string like 'user=admin, pass=123' into a dictionary
    """
    if not config_str or not config_str.strip():
        return {}
    
    config = {}
    for pair in config_str.split(','):
        pair = pair.strip()
        if '=' in pair:
            key, value = pair.split('=', 1)
            config[key.strip()] = value.strip()
    return config


def run_deploy_task(task_id: str, model: str, charm: str, channel: str, 
                   revision: str, charm_name: str, config: str, constraints: str,
                   machine_id: str | None = None, num_units: str | int | None = None):
    """
    Background task to run juju deploy
    """
    try:
        with tasks_lock:
            tasks[task_id]['status'] = 'running'
        
        # Real deployment using jubilant
        config_dict = parse_config_string(config)
        
        # Create Juju instance
        juju = jubilant.Juju(model=model)
        
        # Build deploy command arguments
        deploy_kwargs: Dict[str, Any] = {
            'charm': charm,
        }
        
        if channel:
            deploy_kwargs['channel'] = channel
        if revision:
            deploy_kwargs['revision'] = int(revision)
        if charm_name:
            deploy_kwargs['app'] = charm_name
        if config_dict:
            deploy_kwargs['config'] = config_dict
        if constraints:
            # Convert constraints string to dict
            constraints_dict = {}
            for pair in constraints.split(','):
                if '=' in pair:
                    k, v = pair.split('=', 1)
                    constraints_dict[k.strip()] = v.strip()
            deploy_kwargs['constraints'] = constraints_dict
        if machine_id:
            deploy_kwargs['to'] = str(machine_id)
        elif num_units not in (None, '', 0, '0'):
            deploy_kwargs['num_units'] = int(num_units)
        
        juju.deploy(**deploy_kwargs)
        result = {
            'success': True,
            'message': f'Deployed {charm} to model {model}',
            'charm_name': charm_name or charm
        }
        
        with tasks_lock:
            tasks[task_id]['status'] = 'completed'
            tasks[task_id]['result'] = result
            
    except Exception as e:
        with tasks_lock:
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)


def run_relate_task(task_id: str, model: str, endpoint_a: str, endpoint_b: str):
    """
    Background task to run juju relate
    """
    try:
        with tasks_lock:
            tasks[task_id]['status'] = 'running'
        
        # Real relation using jubilant
        # Create Juju instance
        juju = jubilant.Juju(model=model)
        
        # integrate is the jubilant method for creating relations
        juju.integrate(endpoint_a, endpoint_b)
        
        result = {
            'success': True,
            'message': f'Related {endpoint_a} to {endpoint_b}'
        }
        
        with tasks_lock:
            tasks[task_id]['status'] = 'completed'
            tasks[task_id]['result'] = result
            
    except Exception as e:
        with tasks_lock:
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)


def run_unrelate_task(task_id: str, model: str, endpoint_a: str, endpoint_b: str):
    """
    Background task to run juju remove-relation
    """
    try:
        print(f"[UNRELATE] Starting task {task_id}: {endpoint_a} ↔ {endpoint_b} in model {model}")
        
        with tasks_lock:
            tasks[task_id]['status'] = 'running'
        
        # Remove relation using jubilant
        # Create Juju instance
        juju = jubilant.Juju(model=model)
        
        print(f"[UNRELATE] Calling juju.remove_relation({endpoint_a}, {endpoint_b})")
        
        # remove_relation is the method for removing relations
        juju.remove_relation(endpoint_a, endpoint_b)
        
        print("[UNRELATE] Successfully removed relation")
        
        result = {
            'success': True,
            'message': f'Removed relation between {endpoint_a} and {endpoint_b}'
        }
        
        with tasks_lock:
            tasks[task_id]['status'] = 'completed'
            tasks[task_id]['result'] = result
            
    except Exception as e:
        print(f"[UNRELATE] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        with tasks_lock:
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)


def run_remove_task(task_id: str, model: str, application: str, force: bool = False):
    """
    Background task to run juju remove-application
    """
    try:
        with tasks_lock:
            tasks[task_id]['status'] = 'running'
        
        # Real remove using jubilant
        # Create Juju instance
        juju = jubilant.Juju(model=model)
        
        # Remove the application
        if force:
            juju.cli('remove-application', '--force', application)
        else:
            juju.remove_application(application)
        
        result = {
            'success': True,
            'message': f'Removed application {application} from model {model}'
        }
        
        with tasks_lock:
            tasks[task_id]['status'] = 'completed'
            tasks[task_id]['result'] = result
            
    except Exception as e:
        with tasks_lock:
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)


def run_remove_machine_task(task_id: str, model: str, machine_id: str, force: bool = False):
    """
    Background task to run juju remove-machine
    """
    try:
        with tasks_lock:
            tasks[task_id]['status'] = 'running'

        juju = jubilant.Juju(model=model)

        args = ['remove-machine', '--no-prompt']
        if force:
            args.append('--force')
        args.append(str(machine_id))
        juju.cli(*args)

        result = {
            'success': True,
            'message': f'Removed machine {machine_id} from model {model}'
        }

        with tasks_lock:
            tasks[task_id]['status'] = 'completed'
            tasks[task_id]['result'] = result
    except Exception as e:
        with tasks_lock:
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)


@app.route('/api/deploy', methods=['POST'])
def deploy():
    """
    Deploy a charm to a Juju model
    """
    data = request.json
    
    # Validate required fields
    if not data.get('model') or not data.get('charm'):
        return jsonify({'error': 'model and charm are required'}), 400
    
    # Generate task ID
    task_id = str(uuid.uuid4())
    
    # Initialize task state
    with tasks_lock:
        tasks[task_id] = {
            'status': 'pending',
            'type': 'deploy',
            'model': data.get('model'),
            'charm': data.get('charm')
        }
    
    # Submit background task
    executor.submit(
        run_deploy_task,
        task_id,
        data.get('model'),
        data.get('charm'),
        data.get('channel', ''),
        data.get('revision', ''),
        data.get('charm_name', ''),
        data.get('config', ''),
        data.get('constraints', ''),
        data.get('machine_id'),
        data.get('num_units')
    )
    
    return jsonify({'task_id': task_id}), 202


@app.route('/api/relate', methods=['POST'])
def relate():
    """
    Create a relation between two endpoints
    """
    data = request.json
    
    # Validate required fields
    if not data.get('model') or not data.get('endpoint_a') or not data.get('endpoint_b'):
        return jsonify({'error': 'model, endpoint_a, and endpoint_b are required'}), 400
    
    # Generate task ID
    task_id = str(uuid.uuid4())
    
    # Initialize task state
    with tasks_lock:
        tasks[task_id] = {
            'status': 'pending',
            'type': 'relate',
            'model': data.get('model'),
            'endpoints': [data.get('endpoint_a'), data.get('endpoint_b')]
        }
    
    # Submit background task
    executor.submit(
        run_relate_task,
        task_id,
        data.get('model'),
        data.get('endpoint_a'),
        data.get('endpoint_b')
    )
    
    return jsonify({'task_id': task_id}), 202


@app.route('/api/unrelate', methods=['POST'])
def unrelate():
    """
    Remove a relation between two endpoints
    """
    data = request.json
    
    # Validate required fields
    if not data.get('model') or not data.get('endpoint_a') or not data.get('endpoint_b'):
        return jsonify({'error': 'model, endpoint_a, and endpoint_b are required'}), 400
    
    # Generate task ID
    task_id = str(uuid.uuid4())
    
    # Initialize task state
    with tasks_lock:
        tasks[task_id] = {
            'status': 'pending',
            'type': 'unrelate',
            'model': data.get('model'),
            'endpoints': [data.get('endpoint_a'), data.get('endpoint_b')]
        }
    
    # Submit background task
    executor.submit(
        run_unrelate_task,
        task_id,
        data.get('model'),
        data.get('endpoint_a'),
        data.get('endpoint_b')
    )
    
    return jsonify({'task_id': task_id}), 202


@app.route('/api/remove', methods=['POST'])
def remove_application():
    """
    Remove an application from a Juju model
    """
    data = request.json
    
    # Validate required fields
    if not data.get('model') or not data.get('application'):
        return jsonify({'error': 'model and application are required'}), 400
    
    # Generate task ID
    task_id = str(uuid.uuid4())
    
    # Initialize task state
    with tasks_lock:
        tasks[task_id] = {
            'status': 'pending',
            'type': 'remove',
            'model': data.get('model'),
            'application': data.get('application')
        }
    
    # Submit background task
    executor.submit(
        run_remove_task,
        task_id,
        data.get('model'),
        data.get('application'),
        bool(data.get('force'))
    )
    
    return jsonify({'task_id': task_id}), 202


@app.route('/api/remove-machine', methods=['POST'])
def remove_machine():
    """
    Remove a machine from a Juju model
    """
    data = request.json

    if not data.get('model') or data.get('machine_id') is None:
        return jsonify({'error': 'model and machine_id are required'}), 400

    task_id = str(uuid.uuid4())

    with tasks_lock:
        tasks[task_id] = {
            'status': 'pending',
            'type': 'remove-machine',
            'model': data.get('model'),
            'machine_id': str(data.get('machine_id'))
        }

    executor.submit(
        run_remove_machine_task,
        task_id,
        data.get('model'),
        str(data.get('machine_id')),
        bool(data.get('force'))
    )

    return jsonify({'task_id': task_id}), 202


@app.route('/api/status/<path:model>', methods=['GET'])
def get_status(model):
    """
    Get the status of a Juju model
    """
    try:
        model = unquote(model)
        # Real status using subprocess
        # Run juju status --format=json --relations
        result = subprocess.run(
            ['juju', 'status', '-m', model, '--format=json', '--relations'],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return jsonify({'error': result.stderr}), 500
        
        status_data = json.loads(result.stdout)
        return jsonify(status_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/config/<path:model>/<path:application>', methods=['GET'])
def get_application_config(model, application):
    """
    Get the configuration for a Juju application
    """
    try:
        model = unquote(model)
        application = unquote(application)
        def run_config(target_model):
            return subprocess.run(
                ['juju', 'config', '-m', target_model, application, '--format=json'],
                capture_output=True,
                text=True
            )

        result = run_config(model)

        if result.returncode != 0 and '/' in model:
            short_model = model.split('/')[-1]
            result = run_config(short_model)

        if result.returncode != 0:
            return jsonify({'error': result.stderr}), 500

        config_data = json.loads(result.stdout)
        return jsonify(config_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/config/<path:model>/<path:application>', methods=['POST'])
def update_application_config(model, application):
    """
    Update the configuration for a Juju application
    """
    try:
        model = unquote(model)
        application = unquote(application)
        data = request.json or {}
        config_updates = data.get('config', {})

        if not config_updates or not isinstance(config_updates, dict):
            return jsonify({'error': 'config updates are required'}), 400

        config_args = [f"{key}={value}" for key, value in config_updates.items()]

        def run_update(target_model):
            return subprocess.run(
                ['juju', 'config', '-m', target_model, application, *config_args],
                capture_output=True,
                text=True
            )

        result = run_update(model)

        if result.returncode != 0 and '/' in model:
            short_model = model.split('/')[-1]
            result = run_update(short_model)

        if result.returncode != 0:
            return jsonify({'error': result.stderr}), 500

        return jsonify({
            'success': True,
            'message': f'Updated config for {application}'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ssh-command', methods=['POST'])
def run_ssh_command():
    """
    Run a command on a Juju machine via juju ssh and return the exit status.
    """
    try:
        data = request.json or {}
        model = data.get('model')
        machine_id = data.get('machine_id')
        command = data.get('command')

        if not model or machine_id is None or not command:
            return jsonify({'error': 'model, machine_id, and command are required'}), 400

        model = unquote(str(model))
        machine_id = str(machine_id)
        command = str(command)

        result = subprocess.run(
            ['juju', 'ssh', '-m', model, machine_id, command],
            capture_output=True,
            text=True
        )

        return jsonify({
            'status_code': result.returncode
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/task/<task_id>', methods=['GET'])
def get_task(task_id):
    """
    Get the status of a background task
    """
    with tasks_lock:
        task = tasks.get(task_id)
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    return jsonify(task), 200


@app.route('/api/models', methods=['GET'])
def list_models():
    """
    List all available Juju models
    """
    try:
        result = subprocess.run(
            ['juju', 'models', '--format=json'],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
          return jsonify({'error': result.stderr.strip() or 'Failed to list models'}), 500

        payload = json.loads(result.stdout or '{}')
        raw_models = payload.get('models', [])
        models = []
        for model in raw_models:
            models.append({
                'name': model.get('name') or model.get('model') or '',
                'cloud': model.get('cloud') or model.get('cloud-name') or model.get('cloud_name') or '',
                'type': model.get('type') or model.get('model-type') or model.get('model_type') or ''
            })
        return jsonify({'models': models}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/models', methods=['POST'])
def add_model():
    """
    Add a new Juju model
    """
    try:
        data = request.json or {}
        model_name = data.get('model_name') or data.get('name')
        if not model_name:
            return jsonify({'error': 'model_name is required'}), 400

        result = subprocess.run(
            ['juju', 'add-model', model_name],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            return jsonify({'error': result.stderr.strip() or 'Failed to add model'}), 500

        return jsonify({'success': True, 'model': model_name}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint
    """
    return jsonify({
        'status': 'healthy'
    }), 200


if __name__ == '__main__':
    print("Starting Juju Infrastructure Management Backend")
    app.run(debug=True, host='0.0.0.0', port=5000)
