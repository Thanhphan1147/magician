<script>
  import { Handle, Position } from '@xyflow/svelte';
  import { deployCharm, pollTask, removeApplication } from '../api.js';
  import { onMount } from 'svelte';

  // Props from Svelte Flow
  let { data, id } = $props();

  // Runes state management
  let charm = $state(data.charm || '');
  let channel = $state(data.channel || 'stable');
  let revision = $state(data.revision || '');
  let charmName = $state(data.charmName || '');
  let configPairs = $state([{ key: '', value: '' }]);
  let constraintPairs = $state([{ key: '', value: '' }]);
  let isDeploying = $state(false);
  let deployError = $state('');
  let deploySuccess = $state(false);
  let existingApp = $state(data.existingApp || false);
  let appStatus = $state(data.status || '');
  let statusMessage = $state(data.statusMessage || '');
  let unitCount = $state(data.units || 0);
  let desiredUnits = $state(data.desiredUnits || '');
  let autoDeployOnDrop = $state(data.autoDeployOnDrop || false);
  let isRemoving = $state(false);
  let showDeleteConfirm = $state(false);
  let machineId = $state(data.machineId || '');

  // Derived config and constraints strings
  let config = $derived(
    configPairs
      .filter(pair => pair.key.trim() !== '' && pair.value.trim() !== '')
      .map(pair => `${pair.key}=${pair.value}`)
      .join(', ')
  );
  
  let constraints = $derived(
    constraintPairs
      .filter(pair => pair.key.trim() !== '' && pair.value.trim() !== '')
      .map(pair => `${pair.key}=${pair.value}`)
      .join(' ')
  );

  // Derived state
  let canDeploy = $derived(charm.trim() !== '' && !isDeploying && !existingApp);
  let statusColor = $derived(
    existingApp ? 'border-blue-500' :
    deploySuccess ? 'border-green-500' : 
    deployError ? 'border-red-500' : 
    'border-gray-300'
  );
  let titleColor = $derived(
    existingApp ? 'bg-blue-500' :
    deploySuccess ? 'bg-green-500' :
    'bg-purple-500'
  );

  $effect(() => {
    existingApp = data?.existingApp ?? existingApp;
    appStatus = data?.status ?? appStatus;
    statusMessage = data?.statusMessage ?? statusMessage;
    unitCount = data?.units ?? unitCount;
    channel = data?.channel ?? channel;
  });

  // Auto-deploy on mount if flag is set
  onMount(() => {
    if (autoDeployOnDrop && canDeploy) {
      handleDeploy();
    }
  });

  // Config pair management
  function addConfigPair() {
    configPairs = [...configPairs, { key: '', value: '' }];
  }

  function removeConfigPair(index) {
    if (configPairs.length > 1) {
      configPairs = configPairs.filter((_, i) => i !== index);
    }
  }

  // Constraint pair management
  function addConstraintPair() {
    constraintPairs = [...constraintPairs, { key: '', value: '' }];
  }

  function removeConstraintPair(index) {
    if (constraintPairs.length > 1) {
      constraintPairs = constraintPairs.filter((_, i) => i !== index);
    }
  }

  async function handleDeploy() {
    if (!canDeploy) return;

  const model = data.modelName || data.model || 'default';
    
    isDeploying = true;
    deployError = '';
    deploySuccess = false;

    try {
      // Start deployment
      const deployOptions = {
        channel,
        revision,
        charm_name: charmName,
        config,
        constraints,
        machine_id: machineId
      };

      if (!machineId && desiredUnits !== '' && Number(desiredUnits) > 0) {
        deployOptions.num_units = Number(desiredUnits);
      }

      const { task_id } = await deployCharm(model, charm, deployOptions);

      // Poll for completion
      await pollTask(task_id);
      
      deploySuccess = true;
      
      // Update node data if callback exists
      if (data.onDeploySuccess) {
        data.onDeploySuccess(id, { charm, charmName: charmName || charm });
      }
    } catch (error) {
      deployError = error.message;
    } finally {
      isDeploying = false;
    }
  }

  function confirmDelete() {
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
  }

  async function handleDelete(force = false) {
    if (!existingApp && !deploySuccess) {
      // If not deployed, just remove the node from canvas
      if (data.onRemoveNode) {
        data.onRemoveNode(id);
      }
      return;
    }

    // If deployed, remove from Juju
  const model = data.modelName || data.model || 'default';
    const appName = charmName || charm;

    isRemoving = true;
    deployError = '';
    showDeleteConfirm = false;

    try {
  const { task_id } = await removeApplication(model, appName, { force });
      await pollTask(task_id);
      
      // Remove the node from canvas after successful removal
      if (data.onRemoveNode) {
        data.onRemoveNode(id);
      }
    } catch (error) {
      deployError = error.message;
      isRemoving = false;
    }
  }
</script>

<div class="charm-node px-4 py-3 border-2 rounded-lg bg-white shadow-md min-w-[300px] {statusColor}">
  <!-- Node Header -->
  <div class="mb-3">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-800">
        {charmName || charm || 'New Charm'}
      </h3>
      <div class="flex items-center gap-2">
        {#if existingApp}
          <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            Deployed
          </span>
        {/if}
        <!-- Delete Button -->
        <button
          onclick={confirmDelete}
          disabled={isRemoving}
          class="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
          title="Remove {existingApp || deploySuccess ? 'application' : 'node'}"
        >
          {#if isRemoving}
            <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
    
    {#if existingApp}
      <div class="mt-2 text-xs text-blue-700 space-y-0.5">
        <div>Status: <span class="font-medium">{appStatus}</span></div>
        {#if statusMessage}
          <div class="text-[11px] text-blue-600">{statusMessage}</div>
        {/if}
        <div>Units: <span class="font-medium">{unitCount}</span></div>
        {#if channel}
          <div>Channel: <span class="font-medium">{channel}</span></div>
        {/if}
      </div>
    {/if}
    
    {#if deploySuccess}
      <p class="text-xs text-green-600 mt-2">Deployed successfully</p>
    {/if}
    {#if deployError}
      <p class="text-xs text-red-600 mt-2">{deployError}</p>
    {/if}
  </div>

  <!-- Input Fields -->
  {#if !existingApp && !autoDeployOnDrop}
  <div class="space-y-2">
    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Charm <span class="text-red-500">*</span>
      </label>
      <input
        type="text"
        bind:value={charm}
        placeholder="e.g., postgresql-k8s"
        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        disabled={isDeploying}
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Channel</label>
      <input
        type="text"
        bind:value={channel}
        placeholder="stable"
        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        disabled={isDeploying}
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Revision</label>
      <input
        type="text"
        bind:value={revision}
        placeholder="Optional"
        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        disabled={isDeploying}
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Application Name</label>
      <input
        type="text"
        bind:value={charmName}
        placeholder="Optional custom name"
        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        disabled={isDeploying}
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Config</label>
      <div class="space-y-2">
        {#each configPairs as pair, index}
          <div class="flex gap-1 items-center">
            <input
              type="text"
              bind:value={pair.key}
              placeholder="key"
              class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isDeploying}
            />
            <input
              type="text"
              bind:value={pair.value}
              placeholder="value"
              class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isDeploying}
            />
            {#if configPairs.length > 1}
              <button
                type="button"
                onclick={() => removeConfigPair(index)}
                class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                disabled={isDeploying}
              >
                ✕
              </button>
            {/if}
          </div>
        {/each}
        <button
          type="button"
          onclick={addConfigPair}
          class="text-xs text-blue-600 hover:text-blue-700 font-medium"
          disabled={isDeploying}
        >
          + Add another config
        </button>
      </div>
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Constraints</label>
      <div class="space-y-2">
        {#each constraintPairs as pair, index}
          <div class="flex gap-1 items-center">
            <input
              type="text"
              bind:value={pair.key}
              placeholder="key"
              class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isDeploying}
            />
            <input
              type="text"
              bind:value={pair.value}
              placeholder="value"
              class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isDeploying}
            />
            {#if constraintPairs.length > 1}
              <button
                type="button"
                onclick={() => removeConstraintPair(index)}
                class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                disabled={isDeploying}
              >
                ✕
              </button>
            {/if}
          </div>
        {/each}
        <button
          type="button"
          onclick={addConstraintPair}
          class="text-xs text-blue-600 hover:text-blue-700 font-medium"
          disabled={isDeploying}
        >
          + Add another constraint
        </button>
      </div>
    </div>
  </div>

  <!-- Deploy Button -->
  <button
    onclick={handleDeploy}
    disabled={!canDeploy}
    class="mt-3 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
  >
    {#if isDeploying}
      <span class="flex items-center justify-center">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Deploying...
      </span>
    {:else}
      Deploy
    {/if}
  </button>
  {/if}

  {#if autoDeployOnDrop && isDeploying}
  <div class="mt-3 flex items-center justify-center text-sm text-gray-700">
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Deploying...
  </div>
  {/if}

  <!-- Delete Confirmation Dialog -->
  {#if showDeleteConfirm}
  <div class="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center z-20">
    <div class="bg-white rounded-lg p-4 shadow-xl max-w-xs" onclick={(e) => e.stopPropagation()}>
      <h4 class="text-sm font-semibold text-gray-800 mb-2">Confirm Deletion</h4>
      <p class="text-xs text-gray-600 mb-4">
        {#if existingApp || deploySuccess}
          This will run <code class="bg-gray-100 px-1 rounded">juju remove-application {charmName || charm}</code> and remove it from the model.
        {:else}
          This will remove the node from the canvas.
        {/if}
      </p>
      <div class="flex gap-2 justify-end">
        <button
          onclick={cancelDelete}
          class="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={() => handleDelete(false)}
          class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Delete
        </button>
        <button
          onclick={() => handleDelete(true)}
          class="px-3 py-1 text-xs bg-red-800 hover:bg-red-900 text-white rounded transition-colors"
          title="Force remove"
        >
          Force
        </button>
      </div>
    </div>
  </div>
  {/if}

  <!-- Connection Handles -->
  <Handle type="target" position={Position.Left} class="handle-hit w-4 h-4 !bg-blue-500" />
  <Handle type="source" position={Position.Right} class="handle-hit w-4 h-4 !bg-blue-500" />
</div>

<style>
  .charm-node {
    transition: border-color 0.3s ease;
  }
</style>