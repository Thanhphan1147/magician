/**
 * API utility functions for communicating with the Flask backend
 */

// Use relative URLs in browser (will use Vite proxy), absolute URLs for tests
const API_BASE = typeof window !== 'undefined' ? '' : (import.meta.env.VITE_API_BASE || 'http://localhost:5000');

/**
 * Deploy a charm to a Juju model
 */
export async function deployCharm(model, charm, options = {}) {
  const response = await fetch(`${API_BASE}/api/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      charm,
      channel: options.channel || '',
      revision: options.revision || '',
      charm_name: options.charm_name || '',
      config: options.config || '',
      constraints: options.constraints || '',
      machine_id: options.machine_id || '',
      num_units: options.num_units ?? ''
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to deploy charm');
  }

  return response.json();
}

/**
 * Create a relation between two endpoints
 */
export async function createRelation(model, endpointA, endpointB) {
  const response = await fetch(`${API_BASE}/api/relate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      endpoint_a: endpointA,
      endpoint_b: endpointB
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create relation');
  }

  return response.json();
}

/**
 * Remove a relation between two endpoints
 */
export async function removeRelation(model, endpointA, endpointB) {
  const response = await fetch(`${API_BASE}/api/unrelate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      endpoint_a: endpointA,
      endpoint_b: endpointB
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove relation');
  }

  return response.json();
}

/**
 * Get the status of a Juju model
 */
export async function getModelStatus(model) {
  const encodedModel = encodeURIComponent(model);
  const response = await fetch(`${API_BASE}/api/status/${encodedModel}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get model status');
  }

  return response.json();
}

/**
 * Get application config for a model
 */
export async function getApplicationConfig(model, application) {
  const normalizedModel = model?.includes('/') ? model.split('/').pop() : model;
  const encodedModel = encodeURIComponent(normalizedModel);
  const encodedApp = encodeURIComponent(application);
  const response = await fetch(`${API_BASE}/api/config/${encodedModel}/${encodedApp}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get application config');
  }

  return response.json();
}

/**
 * Update application config
 */
export async function updateApplicationConfig(model, application, config) {
  const normalizedModel = model?.includes('/') ? model.split('/').pop() : model;
  const encodedModel = encodeURIComponent(normalizedModel);
  const encodedApp = encodeURIComponent(application);
  const response = await fetch(`${API_BASE}/api/config/${encodedModel}/${encodedApp}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update application config');
  }

  return response.json();
}

/**
 * Get the status of a background task
 */
export async function getTaskStatus(taskId) {
  const response = await fetch(`${API_BASE}/api/task/${taskId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Task not found');
  }

  return response.json();
}

/**
 * Poll a task until it completes
 * @param {string} taskId - The task ID to poll
 * @param {number} interval - Poll interval in milliseconds (default: 1000)
 * @param {number} timeout - Timeout in milliseconds (default: 60000)
 * @returns {Promise} Resolves with the task result or rejects on error/timeout
 */
export async function pollTask(taskId, interval = 1000, timeout = 60000) {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const task = await getTaskStatus(taskId);

        if (task.status === 'completed') {
          resolve(task.result);
        } else if (task.status === 'failed') {
          reject(new Error(task.error || 'Task failed'));
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Task timeout'));
        } else {
          // Continue polling
          setTimeout(poll, interval);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

/**
 * Remove an application from a Juju model
 */
export async function removeApplication(model, application, options = {}) {
  const response = await fetch(`${API_BASE}/api/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      application,
      force: options.force === true
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove application');
  }

  return response.json();
}

/**
 * Remove a machine from a Juju model
 */
export async function removeMachine(model, machineId, options = {}) {
  const response = await fetch(`${API_BASE}/api/remove-machine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      machine_id: machineId,
      force: options.force === true
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove machine');
  }

  return response.json();
}

/**
 * List all available Juju models
 */
export async function listModels() {
  const response = await fetch(`${API_BASE}/api/models`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list models');
  }

  return response.json();
}

/**
 * Add a new Juju model
 */
export async function addModel(modelName) {
  const response = await fetch(`${API_BASE}/api/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_name: modelName })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add model');
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}
