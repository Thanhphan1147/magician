<script>
  import { SvelteFlow, Controls, Background, MiniMap, Panel } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import CharmNode from './lib/nodes/CharmNode.svelte';
  import ModelFrame from './lib/nodes/ModelFrame.svelte';
  import MachineNode from './lib/nodes/MachineNode.svelte';
  import RelationEdge from './lib/edges/RelationEdge.svelte';
  import { createRelation, removeRelation, pollTask, getModelStatus, getApplicationConfig, updateApplicationConfig, resetApplicationConfig, getApplicationTrust, updateApplicationTrust, deployCharm, removeMachine, listModels, addModel, runMachineCommand } from './lib/api.js';
  import '@xyflow/svelte/dist/style.css';

  // Define custom node and edge types
  const nodeTypes = {
    charmNode: CharmNode,
    modelFrame: ModelFrame,
    machineNode: MachineNode
  };

  const edgeTypes = {
    relationEdge: RelationEdge
  };

  // Runes state
  let selectedModel = $state('');
  let nodeIdCounter = $state(1);
  let modelIdCounter = $state(1);
  let edgeIdCounter = $state(1);
  let sidebarCharms = $state([]); // Charm templates in sidebar
  let sidebarCharmCounter = $state(1);
  let savedCharmTemplates = $state([]);
  let savedCharmCounter = $state(1);
  let expandedCharmOptions = $state(new Set()); // Track which charms have expanded options
  let availableModels = $state([]); // List of models from Juju
  let isLoadingModels = $state(false);
  let modelLoadError = $state('');
  let addModelName = $state('');
  let isAddingModel = $state(false);
  let addModelError = $state('');
  let draggedModelName = $state(null);
  let selectedMachineGroups = $state({}); // { [modelName]: string[] }
  let lastEdgeSelectAt = $state(0);
  let selectedEdgeId = $state(null);
  let selectedNodeId = $state(null);
  let showFullConfig = $state(false);
  let configEdits = $state({});
  let isUpdatingConfig = $state(false);
  let trustValue = $state('');
  let trustInput = $state('');
  let trustLoadError = $state('');
  let isUpdatingTrust = $state(false);
  let showConfigResetPrompt = $state(false);
  let wipedConfigKeys = $state([]);
  let pendingConfigUpdates = $state({});
  let machineCommandInput = $state('');
  let machineCommandStatus = $state(null);
  let isRunningMachineCommand = $state(false);
  let relationCreateError = $state(null); // { message, sourceId, targetId, model, providerApp, requirerApp }
  let providerEndpointInput = $state('');
  let requirerEndpointInput = $state('');
  let isRetryingRelation = $state(false);
  
  // Notification state
  let notification = $state(null); // { type: 'error' | 'success', message: string }
  let notificationTimeout = $state(null);

  // Svelte Flow stores (required by the library)
  const nodes = writable([]);

  const edges = writable([]);

  let selectedEdge = $derived($edges.find(edge => edge.id === selectedEdgeId) || null);
  let selectedEdgeSource = $derived(selectedEdge ? $nodes.find(node => node.id === selectedEdge.source) : null);
  let selectedEdgeTarget = $derived(selectedEdge ? $nodes.find(node => node.id === selectedEdge.target) : null);
  let selectedProviderApp = $derived(selectedEdge?.data?.providerApp || selectedEdgeSource?.data?.charmName || 'unknown');
  let selectedProviderEndpoint = $derived(selectedEdge?.data?.providerEndpoint || 'unknown');
  let selectedRequirerApp = $derived(selectedEdge?.data?.requirerApp || selectedEdgeTarget?.data?.charmName || 'unknown');
  let selectedRequirerEndpoint = $derived(selectedEdge?.data?.requirerEndpoint || 'unknown');
  let selectedNode = $derived($nodes.find(node => node.id === selectedNodeId) || null);
  let selectedMachine = $derived(selectedNode?.type === 'machineNode' ? selectedNode : null);
  let pendingMachineDeploys = $state([]); // { id, modelId, machineId, label, position }

  onMount(async () => {
    isLoadingModels = true;
    modelLoadError = '';
    try {
      const response = await listModels();
      availableModels = response?.models || [];
      if (!selectedModel && availableModels.length > 0) {
        selectedModel = availableModels[0].name;
      }
    } catch (error) {
      modelLoadError = error.message || 'Failed to load models';
    } finally {
      isLoadingModels = false;
    }
  });

  function handleModelDragStart(event, model) {
    draggedModelName = model?.name || null;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', draggedModelName || '');
  }

  function handleModelDragEnd() {
    draggedModelName = null;
  }

  function getSelectedMachineGroup(modelName) {
    return selectedMachineGroups?.[modelName] || [];
  }

  function toggleMachineSelection(modelName, machineId) {
    if (!modelName || machineId === undefined || machineId === null) {
      return;
    }
    const current = new Set(getSelectedMachineGroup(modelName));
    const machineKey = String(machineId);
    if (current.has(machineKey)) {
      current.delete(machineKey);
    } else {
      current.add(machineKey);
    }
    selectedMachineGroups = {
      ...selectedMachineGroups,
      [modelName]: Array.from(current)
    };
  }

  function pruneMachineSelection(modelName, existingIds) {
    const current = getSelectedMachineGroup(modelName);
    if (!current.length) {
      return;
    }
    const filtered = current.filter(id => existingIds.has(String(id)));
    if (filtered.length === current.length) {
      return;
    }
    selectedMachineGroups = {
      ...selectedMachineGroups,
      [modelName]: filtered
    };
  }

  function parseConfigString(configValue) {
    return configValue
      .split(/[\s,]+/)
      .map(item => item.trim())
      .filter(item => item.includes('='))
      .map(item => {
        const [key, ...rest] = item.split('=');
        return {
          key: key.trim(),
          value: rest.join('=').trim(),
          isSet: true
        };
      })
      .filter(entry => entry.key && entry.value);
  }

  function normalizeConfigEntries(configData) {
    if (!configData) {
      return [];
    }

    const mapConfigEntries = (entries) => Object.entries(entries).map(([key, value]) => {
      const currentValue = value?.value ?? value?.current ?? value?.['value'] ?? '';
      const defaultValue = value?.default ?? value?.['default'] ?? value?.['default-value'];
      const source = value?.source ?? value?.['source'];
      const isSet = source === 'user' || (defaultValue !== undefined && currentValue !== defaultValue) ||
        (defaultValue === undefined && currentValue !== undefined && currentValue !== '');

      return {
        key,
        value: currentValue,
        defaultValue,
        source,
        isSet
      };
    });

    if (typeof configData === 'string') {
      return parseConfigString(configData);
    }

    if (Array.isArray(configData)) {
      return configData
        .map(entry => ({
          key: entry?.key || '',
          value: entry?.value ?? '',
          defaultValue: entry?.defaultValue,
          source: entry?.source,
          isSet: entry?.isSet ?? true
        }))
        .filter(entry => entry.key);
    }

    if (
      configData.settings &&
      typeof configData.settings === 'object' &&
      Object.keys(configData.settings).length > 0
    ) {
      return mapConfigEntries(configData.settings);
    }

    if (configData['application-config'] && typeof configData['application-config'] === 'object') {
      return mapConfigEntries(configData['application-config']);
    }

    if (configData.applicationConfig && typeof configData.applicationConfig === 'object') {
      return mapConfigEntries(configData.applicationConfig);
    }

    if (configData.application_config && typeof configData.application_config === 'object') {
      return mapConfigEntries(configData.application_config);
    }

    if (configData.charmConfig && typeof configData.charmConfig === 'object') {
      return mapConfigEntries(configData.charmConfig);
    }

    if (configData['charm-config'] && typeof configData['charm-config'] === 'object') {
      return mapConfigEntries(configData['charm-config']);
    }

    if (configData['charm_config'] && typeof configData['charm_config'] === 'object') {
      return mapConfigEntries(configData['charm_config']);
    }

    if (configData.config && typeof configData.config === 'object') {
      return mapConfigEntries(configData.config);
    }

    if (configData.options && typeof configData.options === 'object') {
      return mapConfigEntries(configData.options);
    }

    if (configData.config_options && typeof configData.config_options === 'object') {
      return mapConfigEntries(configData.config_options);
    }

    if (configData['config-options'] && typeof configData['config-options'] === 'object') {
      return mapConfigEntries(configData['config-options']);
    }

    if (configData['config_options'] && typeof configData['config_options'] === 'object') {
      return mapConfigEntries(configData['config_options']);
    }

    if (configData['options'] && typeof configData['options'] === 'object') {
      return mapConfigEntries(configData['options']);
    }

    if (typeof configData === 'object') {
      const entries = Object.entries(configData);
      const hasNested = entries.some(([, value]) => typeof value === 'object' && value !== null && !Array.isArray(value));

      if (hasNested) {
        return mapConfigEntries(configData);
      }

      return entries.map(([key, value]) => ({
        key,
        value: value ?? '',
        isSet: value !== undefined && value !== null && value !== ''
      }));
    }

    return [];
  }

  let selectedAppConfigAll = $derived(
    selectedNode ? normalizeConfigEntries(selectedNode.data?.config) : []
  );
  let selectedAppConfigSet = $derived(
    selectedAppConfigAll.filter(entry => entry.isSet)
  );
  let isConfigDirty = $derived(
    selectedAppConfigAll.some(entry => (configEdits?.[entry.key] ?? entry.value) !== entry.value)
  );
  let isTrustDirty = $derived((trustInput ?? '') !== (trustValue ?? ''));

  $effect(() => {
    if (!selectedNode) {
      configEdits = {};
      trustValue = '';
      trustInput = '';
      trustLoadError = '';
      showConfigResetPrompt = false;
      wipedConfigKeys = [];
      pendingConfigUpdates = {};
      return;
    }

    const newEdits = {};
    selectedAppConfigAll.forEach(entry => {
      newEdits[entry.key] = entry.value ?? '';
    });
    configEdits = newEdits;
  });

  $effect(() => {
    if (!selectedMachine) {
      machineCommandInput = '';
      machineCommandStatus = null;
      isRunningMachineCommand = false;
      return;
    }

    machineCommandStatus = null;
  });

  async function handleRunMachineCommand() {
    if (!selectedMachine || isRunningMachineCommand) {
      return;
    }

    const machineId = selectedMachine.data?.machineId;
    const modelName = selectedMachine.data?.modelName;
    const command = machineCommandInput.trim();

    if (!machineId || machineId === 'pending') {
      showNotification('error', 'Machine ID is not available yet');
      return;
    }

    if (!modelName) {
      showNotification('error', 'Missing model name for SSH command');
      return;
    }

    if (!command) {
      showNotification('error', 'Enter a command to run');
      return;
    }

    try {
      isRunningMachineCommand = true;
      const result = await runMachineCommand(modelName, machineId, command);
      machineCommandStatus = result?.status_code ?? null;
    } catch (error) {
      showNotification('error', error.message || 'Failed to run command');
    } finally {
      isRunningMachineCommand = false;
    }
  }

  async function handleUpdateConfig() {
    if (!selectedNode || isUpdatingConfig) {
      return;
    }

  const modelName = selectedNode.data?.modelName;
    const appName = selectedNode.data?.charmName;

    if (!modelName || !appName) {
      showNotification('error', 'Missing model or application name');
      return;
    }

    const updates = {};
    const wipedKeys = [];
    selectedAppConfigAll.forEach(entry => {
      const newValue = configEdits?.[entry.key];
      if (newValue !== undefined && newValue !== entry.value) {
        updates[entry.key] = newValue;
        if ((newValue === '' || newValue === null) && entry.value !== '' && entry.value !== null && entry.value !== undefined) {
          wipedKeys.push(entry.key);
        }
      }
    });

    if (Object.keys(updates).length === 0) {
      return;
    }

    if (wipedKeys.length > 0 && !showConfigResetPrompt) {
      wipedConfigKeys = wipedKeys;
      pendingConfigUpdates = updates;
      showConfigResetPrompt = true;
      return;
    }

    try {
      isUpdatingConfig = true;
      await updateApplicationConfig(modelName, appName, updates);
      const refreshedConfig = await getApplicationConfig(modelName, appName);

      nodes.update(currentNodes =>
        currentNodes.map(node =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  config: refreshedConfig
                }
              }
            : node
        )
      );

      showNotification('success', `Config updated for ${appName}`);
    } catch (error) {
      console.error('Failed to update application config:', error);
      showNotification('error', `Failed to update config: ${error.message}`);
    } finally {
      isUpdatingConfig = false;
    }
  }

  async function applyConfigUpdateWithReset(resetWipedKeys) {
    if (!selectedNode || isUpdatingConfig) {
      return;
    }

    const modelName = selectedNode.data?.modelName;
    const appName = selectedNode.data?.charmName;

    if (!modelName || !appName) {
      showNotification('error', 'Missing model or application name');
      return;
    }

    const updates = { ...pendingConfigUpdates };
    const resetKeys = resetWipedKeys ? [...wipedConfigKeys] : [];

    if (resetKeys.length > 0) {
      resetKeys.forEach(key => {
        delete updates[key];
      });
    }

    if (Object.keys(updates).length === 0 && resetKeys.length === 0) {
      showConfigResetPrompt = false;
      wipedConfigKeys = [];
      pendingConfigUpdates = {};
      return;
    }

    try {
      isUpdatingConfig = true;

      if (Object.keys(updates).length > 0) {
        await updateApplicationConfig(modelName, appName, updates);
      }
      if (resetKeys.length > 0) {
        await resetApplicationConfig(modelName, appName, resetKeys);
      }

      const refreshedConfig = await getApplicationConfig(modelName, appName);
      nodes.update(currentNodes =>
        currentNodes.map(node =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  config: refreshedConfig
                }
              }
            : node
        )
      );

      showNotification('success', `Config updated for ${appName}`);
    } catch (error) {
      console.error('Failed to update application config:', error);
      showNotification('error', `Failed to update config: ${error.message}`);
    } finally {
      isUpdatingConfig = false;
      showConfigResetPrompt = false;
      wipedConfigKeys = [];
      pendingConfigUpdates = {};
    }
  }

  async function loadTrustConfig(modelName, appName) {
    trustLoadError = '';
    if (!modelName || !appName) {
      trustValue = '';
      trustInput = '';
      return;
    }

    try {
      const result = await getApplicationTrust(modelName, appName);
      trustValue = result?.trust ?? '';
      trustInput = trustValue;
    } catch (error) {
      trustLoadError = error.message || 'Failed to load trust config';
      trustValue = '';
      trustInput = '';
    }
  }

  async function handleUpdateTrust() {
    if (!selectedNode || isUpdatingTrust) {
      return;
    }

    const modelName = selectedNode.data?.modelName;
    const appName = selectedNode.data?.charmName;
    const nextValue = (trustInput ?? '').toString().trim().toLowerCase();

    if (!modelName || !appName) {
      showNotification('error', 'Missing model or application name');
      return;
    }

    if (!['true', 'false'].includes(nextValue)) {
      showNotification('error', 'Trust must be true or false');
      return;
    }

    try {
      isUpdatingTrust = true;
      const result = await updateApplicationTrust(modelName, appName, nextValue);
      trustValue = result?.trust ?? nextValue;
      trustInput = trustValue;
      showNotification('success', `Updated trust for ${appName}`);
    } catch (error) {
      showNotification('error', error.message || 'Failed to update trust');
    } finally {
      isUpdatingTrust = false;
    }
  }

  function buildEndpoint(appName, inputValue) {
    const trimmed = (inputValue || '').trim();

    if (!trimmed) {
      return appName;
    }

    if (trimmed.includes(':')) {
      return trimmed;
    }

    return `${appName}:${trimmed}`;
  }

  async function handleRetryRelation() {
    if (!relationCreateError || isRetryingRelation) {
      return;
    }

    const { model, providerApp, requirerApp, sourceId, targetId } = relationCreateError;
    const endpointA = buildEndpoint(providerApp, providerEndpointInput);
    const endpointB = buildEndpoint(requirerApp, requirerEndpointInput);

    try {
      isRetryingRelation = true;
      const { task_id } = await createRelation(model, endpointA, endpointB);
      await pollTask(task_id);

      edges.update(currentEdges => {
        const existingEdge = currentEdges.find(edge =>
          (edge.source === sourceId && edge.target === targetId) ||
          (edge.source === targetId && edge.target === sourceId)
        );

        if (existingEdge) {
          return applyEdgeGrouping(currentEdges.map(edge =>
            edge.id === existingEdge.id
              ? { ...edge, data: { ...edge.data, isRelated: true } }
              : edge
          ));
        }

        return applyEdgeGrouping([
          ...currentEdges,
          {
            id: `edge-${edgeIdCounter++}`,
            source: sourceId,
            target: targetId,
            type: 'relationEdge',
            selectable: true,
            focusable: true,
            data: {
              model,
              isRelated: true
            }
          }
        ]);
      });

      showNotification('success', `Relation created: ${endpointA} ↔ ${endpointB}`);
      relationCreateError = null;
      providerEndpointInput = '';
      requirerEndpointInput = '';
    } catch (error) {
      console.error('Retry relation failed:', error);
      showNotification('error', `Failed to create relation: ${error.message}`);
    } finally {
      isRetryingRelation = false;
    }
  }

  // Debug: Log edge changes
  edges.subscribe(value => {
    console.log('Edges updated:', value.map(e => ({ 
      id: e.id, 
      source: e.source, 
      target: e.target, 
      selected: e.selected,
      type: e.type,
      isRelated: e.data?.isRelated
    })));
  });

  // Derived state for sidebar
  let showSidebar = $state(true);

  // Grid snapping configuration
  const GRID_SIZE = 20; // Size of grid cells in pixels

  function snapToGrid(position) {
    return {
      x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(position.y / GRID_SIZE) * GRID_SIZE
    };
  }

  // Handle keyboard events for deleting selected edges
  $effect(() => {
    function handleKeyDown(event) {
      // Only handle Delete or Backspace keys
      if (event.key === 'Delete' || event.key === 'Backspace') {
        console.log('Delete/Backspace key pressed');
        
        // Don't interfere if user is typing in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
          console.log('Ignoring - user is typing in input field');
          return;
        }

        // Find selected edges
        const selectedEdges = $edges.filter(edge => edge.selected);
        console.log('Selected edges:', selectedEdges);
        
        if (selectedEdges.length > 0) {
          event.preventDefault();
          console.log('Removing', selectedEdges.length, 'selected edge(s)');
          
          // Remove each selected edge
          selectedEdges.forEach(edge => {
            if (edge.data?.isRelated && edge.data?.onRemove) {
              handleRemoveRelation(edge.id);
            }
          });
        } else {
          console.log('No edges selected');
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  function handleNodeDragStop(event) {
    // The actual data is in event.detail for Svelte Flow
    const { targetNode } = event.detail;
    
    // Snap charm and machine nodes, not model frames
    if (targetNode && (targetNode.type === 'charmNode' || targetNode.type === 'machineNode')) {
      const snappedPosition = snapToGrid(targetNode.position);
      
      nodes.update(ns => 
        ns.map(n => 
          n.id === targetNode.id 
            ? { ...n, position: snappedPosition }
            : n
        )
      );
    }

    if (targetNode && targetNode.type === 'modelFrame') {
      const safePosition = findAvailableModelPosition(targetNode.position, targetNode.id);

      if (safePosition.x !== targetNode.position.x || safePosition.y !== targetNode.position.y) {
        nodes.update(ns =>
          ns.map(n =>
            n.id === targetNode.id
              ? { ...n, position: safePosition }
              : n
          )
        );
      }
    }
  }

  function handleEdgeClick(event) {
    console.log('Edge click event:', event.detail);
    const { edge, event: mouseEvent } = event.detail;

    // Prevent the pane from immediately deselecting the edge
    if (mouseEvent) {
      mouseEvent.stopPropagation();
      mouseEvent.preventDefault();
    }
    
    if (edge) {
      lastEdgeSelectAt = Date.now();
      selectedEdgeId = edge.id;
      selectedNodeId = null;
      showFullConfig = false;
      console.log('Manually selecting edge:', edge.id);
      // Manually update the edge selection state
      edges.update(currentEdges => 
        currentEdges.map(e => ({
          ...e,
          selected: e.id === edge.id
        }))
      );
    }
  }

  async function handleNodeClick(event) {
    console.log('Node click event:', event.detail);
    const { node, event: mouseEvent } = event.detail;

    if (mouseEvent) {
      mouseEvent.stopPropagation();
      mouseEvent.preventDefault();
    }

    if (node) {
      selectedNodeId = node.id;
      selectedEdgeId = null;
      showFullConfig = false;
      configEdits = {};
      trustValue = '';
      trustInput = '';
      trustLoadError = '';

      nodes.update(currentNodes =>
        currentNodes.map(n => ({
          ...n,
          selected: n.id === node.id
        }))
      );

      if (node.type === 'machineNode') {
        return;
      }

      if (node.type === 'charmNode') {
        const modelName = node.data?.modelName;
        const appName = node.data?.charmName;

        if (modelName && appName) {
          try {
            const configData = await getApplicationConfig(modelName, appName);
            nodes.update(currentNodes =>
              currentNodes.map(n =>
                n.id === node.id
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        config: configData
                      }
                    }
                  : n
              )
            );
          } catch (error) {
            console.error('Failed to fetch application config:', error);
          }

          await loadTrustConfig(modelName, appName);
        }
      }
    }
  }

  function handleSelectionChange(event) {
    console.log('Selection change event:', event.detail);

    const selectedEdgeIds = new Set((event.detail?.edges || []).map(edge => edge.id));
    const selectedNodeIds = new Set((event.detail?.nodes || []).map(node => node.id));

    if (selectedEdgeIds.size === 0 && selectedNodeIds.size === 0 && Date.now() - lastEdgeSelectAt < 250) {
      console.log('Ignoring immediate edge deselection');
      return;
    }

    if (selectedEdgeIds.size > 0) {
      selectedEdgeId = selectedEdgeIds.values().next().value;
      selectedNodeId = null;
      showFullConfig = false;
      configEdits = {};
      trustValue = '';
      trustInput = '';
      trustLoadError = '';
      showConfigResetPrompt = false;
      wipedConfigKeys = [];
      pendingConfigUpdates = {};
    } else if (selectedNodeIds.size > 0) {
      selectedNodeId = selectedNodeIds.values().next().value;
      selectedEdgeId = null;
      showFullConfig = false;
      configEdits = {};
      trustValue = '';
      trustInput = '';
      trustLoadError = '';
      showConfigResetPrompt = false;
      wipedConfigKeys = [];
      pendingConfigUpdates = {};
    } else {
      selectedEdgeId = null;
      selectedNodeId = null;
      showFullConfig = false;
      configEdits = {};
      trustValue = '';
      trustInput = '';
      trustLoadError = '';
      showConfigResetPrompt = false;
      wipedConfigKeys = [];
      pendingConfigUpdates = {};
    }


    // Keep edge selection in sync with Svelte Flow's selection state
    edges.update(currentEdges =>
      currentEdges.map(edge => ({
        ...edge,
        selected: selectedEdgeIds.has(edge.id)
      }))
    );

    nodes.update(currentNodes =>
      currentNodes.map(node => ({
        ...node,
        selected: selectedNodeIds.has(node.id)
      }))
    );
  }

  $effect(() => {
    function handleClickAway(event) {
      if (!selectedEdgeId && !selectedNodeId) {
        return;
      }

      if (Date.now() - lastEdgeSelectAt < 250) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest('.details-panel') ||
        target.closest('.svelte-flow__edge') ||
        target.closest('.svelte-flow__edge-path') ||
        target.closest('.svelte-flow__edgelabel-renderer') ||
        target.closest('.svelte-flow__node')
      ) {
        return;
      }

      selectedEdgeId = null;
      selectedNodeId = null;
      showFullConfig = false;
    configEdits = {};
  trustValue = '';
  trustInput = '';
  trustLoadError = '';
  showConfigResetPrompt = false;
  wipedConfigKeys = [];
  pendingConfigUpdates = {};
    trustValue = '';
    trustInput = '';
    trustLoadError = '';
      edges.update(currentEdges =>
        currentEdges.map(edge => ({
          ...edge,
          selected: false
        }))
      );
      nodes.update(currentNodes =>
        currentNodes.map(node => ({
          ...node,
          selected: false
        }))
      );
    }

    window.addEventListener('click', handleClickAway);

    return () => {
      window.removeEventListener('click', handleClickAway);
    };
  });

  function showNotification(type, message, duration = 5000) {
    // Clear any existing notification timeout
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }

    // Set new notification
    notification = { type, message };

    // Auto-hide after duration
    notificationTimeout = setTimeout(() => {
      notification = null;
      notificationTimeout = null;
    }, duration);
  }

  function getRelatedEndpoint(status, appName, relatedApp, relationInterface) {
    const relatedAppData = status?.applications?.[relatedApp];

    if (!relatedAppData?.relations) {
      return 'unknown';
    }

    for (const [relatedEndpoint, relatedList] of Object.entries(relatedAppData.relations)) {
      if (relatedEndpoint.includes('-peers')) {
        continue;
      }

      const matches = relatedList?.some(relation =>
        relation['related-application'] === appName &&
        relation.interface === relationInterface
      );

      if (matches) {
        return relatedEndpoint;
      }
    }

    return 'unknown';
  }

  function isRelationPresent(status, appA, endpointA, appB, relationInterface) {
    if (!status?.applications || !appA || !endpointA || !appB) {
      return false;
    }

    const relations = status.applications?.[appA]?.relations?.[endpointA] || [];
    return relations.some(relation =>
      relation['related-application'] === appB &&
      (!relationInterface || relation.interface === relationInterface)
    );
  }

  function applyEdgeGrouping(edgeList) {
    const relationGroups = new Map();

    edgeList.forEach(edge => {
      if (edge.type !== 'relationEdge') {
        return;
      }

      const key = [edge.source, edge.target].sort().join('::');
      if (!relationGroups.has(key)) {
        relationGroups.set(key, []);
      }

      relationGroups.get(key).push(edge.id);
    });

    relationGroups.forEach((ids, key) => {
      relationGroups.set(key, ids.sort());
    });

    return edgeList.map(edge => {
      if (edge.type !== 'relationEdge') {
        return edge;
      }

      const key = [edge.source, edge.target].sort().join('::');
      const ids = relationGroups.get(key) || [];
      const multiIndex = Math.max(ids.indexOf(edge.id), 0);
      const multiCount = Math.max(ids.length, 1);

      return {
        ...edge,
        data: {
          ...edge.data,
          multiIndex,
          multiCount
        }
      };
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function handleViewModeChange(modelId, viewMode) {
    const modelFrame = $nodes.find(node => node.id === modelId);
    const modelType = (modelFrame?.data?.modelType || '').toString().toLowerCase();
    const isK8sModel = modelType === 'caas' || modelType === 'k8s' || modelType === 'kubernetes';
    const resolvedView = !isK8sModel && viewMode === 'machine' ? 'machine' : 'app';

    nodes.update(currentNodes =>
      currentNodes.map(node => {
        if (node.id === modelId) {
          return {
            ...node,
            data: {
              ...node.data,
              viewMode: resolvedView
            }
          };
        }

        const parentId = node.parentId ?? node.parentNode;
        if (parentId === modelId) {
          if (node.type === 'charmNode') {
            return { ...node, hidden: resolvedView !== 'app' };
          }
          if (node.type === 'machineNode') {
            return { ...node, hidden: resolvedView !== 'machine' };
          }
        }

        return node;
      })
    );

    edges.update(currentEdges =>
      currentEdges.map(edge =>
        edge.type === 'relationEdge'
          ? { ...edge, hidden: resolvedView !== 'app' }
          : edge
      )
    );

    if (resolvedView === 'machine') {
      selectedEdgeId = null;
      selectedNodeId = null;
    }
  }

  function handleModelRefresh(modelId, status) {
    const modelFrame = $nodes.find(n => n.id === modelId);
    const modelName = modelFrame?.data?.modelName || 'default';
    const rawModelType = status?.model_type || status?.model?.type || status?.model?.['model-type'] || status?.model?.model_type || '';
    const modelType = rawModelType ? String(rawModelType).toLowerCase() : '';
    const isK8sModel = modelType === 'caas' || modelType === 'k8s' || modelType === 'kubernetes';
    const viewMode = isK8sModel ? 'app' : (modelFrame?.data?.viewMode || 'app');
    const isMachineView = !isK8sModel && viewMode === 'machine';

    nodes.update(currentNodes =>
      currentNodes.map(node => {
        if (node.id === modelId) {
          return {
            ...node,
            data: {
              ...node.data,
              modelType,
              viewMode
            }
          };
        }
        const parentId = node.parentId ?? node.parentNode;
        if (parentId === modelId) {
          return {
            ...node,
            data: {
              ...node.data,
              modelType,
              modelName,
              modelType,
            }
          };
        }
        return node;
      })
    );

    if (isK8sModel) {
      nodes.update(currentNodes =>
        currentNodes.filter(node => !(node.type === 'machineNode' && (node.parentId ?? node.parentNode) === modelId))
      );
      pendingMachineDeploys = pendingMachineDeploys.filter(entry => entry.modelId !== modelId);
      if (selectedMachineGroups?.[modelName]) {
        const { [modelName]: _removed, ...rest } = selectedMachineGroups;
        selectedMachineGroups = rest;
      }
    }

    if (isMachineView) {
      nodes.update(currentNodes =>
        currentNodes.map(node => {
          if (node.type !== 'charmNode') {
            return node;
          }
          const parentId = node.parentId ?? node.parentNode;
          const matchesModel = parentId === modelId || node.data?.modelName === modelName;
          if (!matchesModel) {
            return node;
          }
          return { ...node, hidden: true };
        })
      );
    }

    // Create nodes for applications that exist in the model
    if (status?.applications && !isMachineView) {
      // Get all existing charm nodes in this model to preserve their positions
      const existingCharmNodes = $nodes.filter(n => 
        n.type === 'charmNode' && (n.parentId ?? n.parentNode) === modelId
      );
      
      // Helper function to check if a position overlaps with existing nodes
      const CHARM_NODE_WIDTH = 300;
      const CHARM_NODE_HEIGHT = 150;
      const MIN_SPACING = 30;
      
      function isPositionOccupied(x, y, excludeNodeId = null) {
        return existingCharmNodes.some(node => {
          if (node.id === excludeNodeId) return false;
          
          const dx = Math.abs(node.position.x - x);
          const dy = Math.abs(node.position.y - y);
          
          return dx < (CHARM_NODE_WIDTH + MIN_SPACING) && 
                 dy < (CHARM_NODE_HEIGHT + MIN_SPACING);
        });
      }
      
      // Build a graph of relations to group related apps together
      const relationGraph = new Map(); // appName -> Set of related app names
      Object.entries(status.applications).forEach(([appName, appData]) => {
        if (!relationGraph.has(appName)) {
          relationGraph.set(appName, new Set());
        }
        
        if (appData.relations) {
          Object.entries(appData.relations).forEach(([endpoint, relationList]) => {
            if (!endpoint.includes('-peers')) {
              relationList.forEach(relation => {
                const relatedApp = relation['related-application'];
                relationGraph.get(appName).add(relatedApp);
              });
            }
          });
        }
      });
      
      // Group applications into clusters based on relations
      const visited = new Set();
      const clusters = [];
      
      function findCluster(appName, cluster) {
        if (visited.has(appName)) return;
        visited.add(appName);
        cluster.push(appName);
        
        const relatedApps = relationGraph.get(appName) || new Set();
        relatedApps.forEach(relatedApp => {
          if (!visited.has(relatedApp)) {
            findCluster(relatedApp, cluster);
          }
        });
      }
      
      Object.keys(status.applications).forEach(appName => {
        if (!visited.has(appName)) {
          const cluster = [];
          findCluster(appName, cluster);
          clusters.push(cluster);
        }
      });
      
      // Sort clusters: larger clusters first, then by first app name
      clusters.sort((a, b) => {
        if (a.length !== b.length) return b.length - a.length;
        return a[0].localeCompare(b[0]);
      });
      
      // Helper function to find a good position for a new node, considering clusters
      let currentX = 50;
      let currentY = 100;
  const baseHorizontalSpacing = CHARM_NODE_WIDTH + 50; // 350px between nodes
  const baseVerticalSpacing = CHARM_NODE_HEIGHT + 50; // 200px between rows
  const relatedSpacingBoost = 120; // Extra space for related apps
  const clusterSpacing = 100; // Extra space between clusters
      const positionMap = new Map(); // appName -> {x, y}
      
      clusters.forEach((cluster, clusterIndex) => {
        const horizontalSpacing = cluster.length > 1
          ? baseHorizontalSpacing + relatedSpacingBoost
          : baseHorizontalSpacing;
        const verticalSpacing = cluster.length > 1
          ? baseVerticalSpacing + relatedSpacingBoost
          : baseVerticalSpacing;
        // Reset to start of new row for each cluster
        if (clusterIndex > 0) {
          currentX = 50;
          currentY += verticalSpacing + clusterSpacing;
        }
        
        cluster.forEach((appName, indexInCluster) => {
          // Find available position
          let x = currentX;
          let y = currentY;
          
          while (isPositionOccupied(x, y)) {
            currentX += horizontalSpacing;
            if (currentX > 50 + horizontalSpacing * 2) { // Max 3 columns
              currentX = 50;
              currentY += verticalSpacing;
            }
            x = currentX;
            y = currentY;
          }
          
          positionMap.set(appName, { x, y });
          
          // Move to next position
          currentX += horizontalSpacing;
          if (currentX > 50 + horizontalSpacing * 2) { // Max 3 columns
            currentX = 50;
            currentY += verticalSpacing;
          }
        });
      });
      
      Object.entries(status.applications).forEach(([appName, appData], index) => {
        const appConfig =
          appData?.config ||
          appData?.['application-config'] ||
          appData?.['charm-config'] ||
          appData?.['config'] ||
          null;
        const statusMessage =
          appData?.['application-status']?.message ||
          appData?.status?.message ||
          appData?.['status-message'] ||
          '';

        // Check if a node for this app already exists
        const existingNode = $nodes.find(n => 
          n.data?.charmName === appName && (n.parentId ?? n.parentNode) === modelId
        );
        
        if (!existingNode) {
          // Create a new charm node for this application
          nodeIdCounter++;
          const position = positionMap.get(appName) || { x: 50, y: 100 };
          
          const newNode = {
            id: `charm-${nodeIdCounter}`,
            type: 'charmNode',
            position: position,
            data: {
              charmName: appName,
              charm: appData['charm-name'] || appData.charm || appName,
              channel: appData['charm-channel'] || '',
              modelName: modelName,
              modelType,
              onDeploySuccess: handleDeploySuccess,
              onRemoveNode: handleRemoveNode,
              // Populate with actual deployment data
              existingApp: true,
              status: appData['application-status']?.current || 'unknown',
              statusMessage,
              units: appData.units ? Object.keys(appData.units).length : 0,
              config: appConfig
            },
            parentId: modelId,
            extent: 'parent',
            style: 'z-index: 10;',
            hidden: viewMode !== 'app'
          };
          
          nodes.update(n => [...n, newNode]);
          // Add to existing nodes list so subsequent nodes won't overlap
          existingCharmNodes.push(newNode);
        } else {
          // Update existing node with fresh data from Juju
          nodes.update(n => n.map(node => {
            if (node.id === existingNode.id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  existingApp: true,
                  status: appData['application-status']?.current || 'unknown',
                  statusMessage,
                  units: appData.units ? Object.keys(appData.units).length : 0,
                  charm: appData['charm-name'] || appData.charm || appName,
                  channel: appData['charm-channel'] || '',
                  config: appConfig,
                  modelType
                },
                hidden: viewMode !== 'app'
              };
            }
            return node;
          }));
        }
      });
    }

  if (!isK8sModel && (status?.applications || status?.machines)) {
  const machineUnits = new Map();
  const machineInfoMap = new Map();

      if (status?.applications) {
        Object.entries(status.applications).forEach(([appName, appData]) => {
          if (!appData?.units) {
            return;
          }

          Object.entries(appData.units).forEach(([unitName, unitData]) => {
            const machineId = unitData?.machine ?? unitData?.['machine-id'];
            if (machineId === undefined || machineId === null) {
              return;
            }
            const machineKey = String(machineId);
            if (!machineUnits.has(machineKey)) {
              machineUnits.set(machineKey, []);
            }
            machineUnits.get(machineKey).push(unitName || `${appName}`);
          });
        });
      }

      if (status?.machines) {
        Object.entries(status.machines).forEach(([machineId, machineData]) => {
          if (!machineUnits.has(machineId)) {
            machineUnits.set(machineId, []);
          }

          const statusInfo = machineData?.['juju-status'] || machineData?.status || {};
          const baseInfo = machineData?.base || machineData?.['base'] || {};
          const baseName = typeof baseInfo === 'string' ? baseInfo : (baseInfo?.name || baseInfo?.['name']);

          const ipAddress =
            machineData?.['dns-name'] ||
            machineData?.['dns_name'] ||
            machineData?.['ip-addresses']?.[0] ||
            machineData?.['ip_addresses']?.[0] ||
            machineData?.['network-interfaces']?.eth0?.['ip-addresses']?.[0] ||
            machineData?.['network-interfaces']?.eth0?.['ip_addresses']?.[0] ||
            machineData?.['public-address'] ||
            machineData?.['public_address'] ||
            machineData?.['private-address'] ||
            machineData?.['private_address'] ||
            machineData?.addresses?.[0]?.value ||
            machineData?.addresses?.[0] ||
            'unknown';

          machineInfoMap.set(machineId, {
            instanceId: machineData?.['instance-id'] || machineData?.['instance_id'] || 'unknown',
            base: baseName || 'unknown',
            state: statusInfo?.current || statusInfo?.status || machineData?.status || 'unknown',
            message: statusInfo?.message || machineData?.['status-message'] || '',
            ipAddress
          });
        });
      }

      const machineIds = new Set(machineUnits.keys());
      pruneMachineSelection(modelName, machineIds);
      const existingMachineNodes = $nodes.filter(n =>
        n.type === 'machineNode' && (n.parentId ?? n.parentNode) === modelId
      );

      const MACHINE_NODE_WIDTH = 280;
      const MACHINE_NODE_HEIGHT = 150;
      const MACHINE_SPACING_X = 40;
      const MACHINE_SPACING_Y = 40;
      let machineX = 40;
      let machineY = 80;
      const machinesPerRow = 3;

      const positionByMachine = new Map();
      Array.from(machineUnits.keys()).sort().forEach((machineId, index) => {
        const snapped = snapToGrid({ x: machineX, y: machineY });
        positionByMachine.set(machineId, snapped);
        machineX += MACHINE_NODE_WIDTH + MACHINE_SPACING_X;
        if ((index + 1) % machinesPerRow === 0) {
          machineX = 40;
          machineY += MACHINE_NODE_HEIGHT + MACHINE_SPACING_Y;
        }
      });

      nodes.update(currentNodes => {
        const filteredNodes = currentNodes.filter(node => {
          if (node.type !== 'machineNode') {
            return true;
          }
          const parentId = node.parentId ?? node.parentNode;
          if (parentId !== modelId) {
            return true;
          }
          if (node.data?.isTemporary) {
            return true;
          }
          return machineIds.has(String(node.data?.machineId));
        });

        const updatedNodes = filteredNodes.map(node => {
          if (node.type !== 'machineNode') {
            return node;
          }
          const parentId = node.parentId ?? node.parentNode;
          if (parentId !== modelId) {
            return node;
          }
          const machineId = String(node.data?.machineId ?? '');
          const units = machineUnits.get(machineId) || [];
          const pendingUnits = getPendingUnitsForMachine(modelId, machineId);

          return {
            ...node,
            data: {
              ...node.data,
              units: units.sort(),
              pendingUnits,
              machineInfo: machineInfoMap.get(machineId) || node.data?.machineInfo,
              modelName,
              modelType,
              isSelected: getSelectedMachineGroup(modelName).includes(machineId),
              onToggleSelect: toggleMachineSelection,
              onRemoveMachine: handleRemoveMachine
            },
            hidden: viewMode !== 'machine'
          };
        });

        machineUnits.forEach((units, machineId) => {
          const existingNode = existingMachineNodes.find(n => String(n.data?.machineId) === machineId);
          if (existingNode) {
            return;
          }

          const position = positionByMachine.get(machineId) || { x: 40, y: 80 };
          updatedNodes.push({
            id: `machine-${modelId}-${machineId}`,
            type: 'machineNode',
            position,
            data: {
              machineId,
              units: units.sort(),
              pendingUnits: getPendingUnitsForMachine(modelId, machineId),
              machineInfo: machineInfoMap.get(machineId),
              modelName,
              modelType,
              isSelected: getSelectedMachineGroup(modelName).includes(machineId),
              onToggleSelect: toggleMachineSelection,
              onRemoveMachine: handleRemoveMachine
            },
            parentId: modelId,
            extent: 'parent',
            style: 'z-index: 8;',
            hidden: viewMode !== 'machine'
          });
        });

        const pendingNodes = getPendingMachineNodes(modelId);
        pendingNodes.forEach(pending => {
          const existingPending = updatedNodes.find(node => node.id === `machine-${modelId}-${pending.id}`);
          if (existingPending) {
            return;
          }
          const pendingPosition = snapToGrid(pending.position || { x: 40, y: 80 });
          updatedNodes.push({
            id: `machine-${modelId}-${pending.id}`,
            type: 'machineNode',
            position: pendingPosition,
            data: {
              machineId: 'pending',
              units: [],
              pendingUnits: [pending.label],
              isTemporary: true,
              machineInfo: {
                instanceId: 'pending',
                base: 'pending',
                state: 'deploying',
                message: ''
              },
              modelName,
              modelType,
              isSelected: false,
              onToggleSelect: toggleMachineSelection,
              onRemoveMachine: handleRemoveMachine
            },
            parentId: modelId,
            extent: 'parent',
            style: 'z-index: 8;',
            hidden: viewMode !== 'machine'
          });
        });

        return updatedNodes;
      });
    }

    // Create edges for relations found in application data
    // Use a Set to track processed relations and avoid duplicates
    const processedRelations = new Set();
    const currentRelationKeys = new Set();
    const newRelationEdges = [];
    
    if (status?.applications) {
      const modelName = modelFrame?.data?.modelName || 'default';
      const viewMode = modelFrame?.data?.viewMode || 'app';
      
      Object.entries(status.applications).forEach(([appName, appData]) => {
        if (appData.relations) {
          Object.entries(appData.relations).forEach(([endpoint, relationList]) => {
            // Skip peer relations (e.g., haproxy-peers)
            if (endpoint.includes('-peers')) {
              return;
            }
            
            relationList.forEach(relation => {
              const relatedApp = relation['related-application'];
              if (!relatedApp || relatedApp === appName) {
                return;
              }
              const relatedEndpoint = relation['related-endpoint'] || getRelatedEndpoint(status, appName, relatedApp, relation.interface);
              const resolvedRelatedEndpoint = relatedEndpoint === 'unknown' ? relation.interface : relatedEndpoint;
              const endpoints = [
                `${appName}:${endpoint}`,
                `${relatedApp}:${resolvedRelatedEndpoint}`
              ].sort();
              
              // Create a unique key for this relation (canonical order to avoid duplicates)
              const relationKey = `${endpoints[0]}::${endpoints[1]}::${relation.interface}`;
              
              if (!processedRelations.has(relationKey)) {
                processedRelations.add(relationKey);
                currentRelationKeys.add(relationKey);
                
                // Find the nodes for these applications
                const node1 = $nodes.find(n => n.data?.charmName === appName && (n.parentId ?? n.parentNode) === modelId);
                const node2 = $nodes.find(n => n.data?.charmName === relatedApp && (n.parentId ?? n.parentNode) === modelId);
                
                if (node1 && node2) {
                  // Create edge for this relation
                    let providerApp = appName;
                    let providerEndpoint = endpoint;
                    let requirerApp = relatedApp;
                    let requirerEndpoint = resolvedRelatedEndpoint;

                    if (endpoint === relation.interface && resolvedRelatedEndpoint !== relation.interface) {
                      providerApp = appName;
                      providerEndpoint = endpoint;
                      requirerApp = relatedApp;
                      requirerEndpoint = resolvedRelatedEndpoint;
                    } else if (resolvedRelatedEndpoint === relation.interface && endpoint !== relation.interface) {
                      providerApp = relatedApp;
                      providerEndpoint = resolvedRelatedEndpoint;
                      requirerApp = appName;
                      requirerEndpoint = endpoint;
                    }

                    const newEdge = {
                      id: `edge-${edgeIdCounter++}`,
                      source: node1.id,
                      target: node2.id,
                      type: 'relationEdge',
                      selectable: true,
                      focusable: true,
                      hidden: viewMode !== 'app',
                      data: {
                        model: modelName,
                        isRelated: true, // Already related
                        relationInterface: relation.interface,
                        relationKey,
                        sourceEndpoint: endpoint,
                        targetEndpoint: resolvedRelatedEndpoint,
                        providerApp,
                        providerEndpoint,
                        requirerApp,
                        requirerEndpoint,
                        onRemove: handleRemoveRelation
                      }
                    };
                    
                    newRelationEdges.push(newEdge);
                    console.log(`Created edge for relation: ${appName}:${endpoint} ↔ ${relatedApp} (${relation.interface})`);
                } else {
                  console.log(`Could not find nodes for relation: ${appName} ↔ ${relatedApp}`);
                }
              }
            });
          });
        }
      });
    }

    // Remove edges for relations that no longer exist
    edges.update(currentEdges => {
      const preservedEdges = currentEdges.filter(edge =>
        edge.type !== 'relationEdge' || edge.data?.model !== modelName
      );
      return applyEdgeGrouping([...preservedEdges, ...newRelationEdges]);
    });
  }

  function handleDeploySuccess(nodeId, data) {
    console.log('Deploy success:', nodeId, data);
    
    // Remove the temporary deployment node
    // The "real" node will be created when the model is refreshed
    nodes.update(n => n.filter(node => node.id !== nodeId));
  }

  function handleRelationSuccess(edgeId, data) {
    console.log('Relation success:', edgeId, data);
  }

  function handleRemoveNode(nodeId) {
    // Remove the node from the canvas
    nodes.update(n => n.filter(node => node.id !== nodeId));
    // Also remove any edges connected to this node
    edges.update(e => e.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
  }

  async function handleRemoveRelation(edgeId) {
    console.log('handleRemoveRelation called with edgeId:', edgeId);
    
    // Find the edge to get endpoint information
    const edge = $edges.find(e => e.id === edgeId);
    if (!edge) {
      console.error('Edge not found:', edgeId);
      return;
    }

    console.log('Found edge:', edge);

    // Get the source and target nodes
    const sourceNode = $nodes.find(n => n.id === edge.source);
    const targetNode = $nodes.find(n => n.id === edge.target);

    console.log('Source node:', sourceNode);
    console.log('Target node:', targetNode);

    if (!sourceNode || !targetNode) {
      console.error('Could not find source or target node');
      return;
    }

    const sourceApp = sourceNode.data?.charmName;
    const targetApp = targetNode.data?.charmName;
  const modelName = edge.data?.model || sourceNode.data?.modelName || targetNode.data?.modelName;

    // Get endpoint names from edge data, or use app names as fallback
    const endpointA = edge.data?.sourceEndpoint 
      ? `${sourceApp}:${edge.data.sourceEndpoint}` 
      : sourceApp;
    const endpointB = edge.data?.targetEndpoint 
      ? `${targetApp}:${edge.data.targetEndpoint}` 
      : targetApp;

    console.log(`Removing relation between ${endpointA} and ${endpointB} in model ${modelName}`);

    try {
      console.log('Calling removeRelation API...');
      const { task_id } = await removeRelation(modelName, endpointA, endpointB);
      console.log('Task ID received:', task_id);
      
      // Poll for completion
      console.log('Polling task...');
      const result = await pollTask(task_id);
      console.log('Task completed with result:', result);
      
      // Verify relation removal in model status before updating canvas
      const maxChecks = 10;
      let stillRelated = true;

      for (let attempt = 0; attempt < maxChecks; attempt += 1) {
        const status = await getModelStatus(modelName);
        stillRelated = isRelationPresent(
          status,
          sourceApp,
          edge.data?.sourceEndpoint,
          targetApp,
          edge.data?.relationInterface
        ) || isRelationPresent(
          status,
          targetApp,
          edge.data?.targetEndpoint,
          sourceApp,
          edge.data?.relationInterface
        );

        if (!stillRelated) {
          break;
        }

        await sleep(2000);
      }

      if (stillRelated) {
        throw new Error('Relation still present in model status');
      }

      // Remove the edge from the canvas
  edges.update(e => applyEdgeGrouping(e.filter(edge => edge.id !== edgeId)));

      if (selectedEdgeId === edgeId) {
        selectedEdgeId = null;
      }

      if (selectedEdgeId === edgeId) {
        selectedEdgeId = null;
      }

      console.log(`✅ Relation removed successfully: ${endpointA} ↔ ${endpointB}`);
      showNotification('success', `Relation removed: ${sourceApp} ↔ ${targetApp}`);
      
    } catch (error) {
      console.error('Failed to remove relation:', error);
      console.error('Error details:', error.message, error.stack);
      showNotification('error', `Failed to remove relation: ${error.message}`);
    }
  }

  async function handleRemoveMachine(machineNode) {
    if (!machineNode) {
      return;
    }

    const machineId = machineNode.data?.machineId;
    if (!machineId || machineId === 'pending') {
      return;
    }

    const force = machineNode.force === true;

    const modelId = machineNode.parentId ?? machineNode.parentNode;
    const modelFrame = $nodes.find(node => node.id === modelId);
    const modelName = machineNode.data?.modelName || modelFrame?.data?.modelName;

    if (!modelName) {
      showNotification('error', 'Missing model name for machine removal');
      return;
    }

    try {
  const { task_id } = await removeMachine(modelName, machineId, { force });
      await pollTask(task_id);
      showNotification('success', `Removed machine ${machineId}`);
      const status = await getModelStatus(modelName);
      handleModelRefresh(modelId, status);
    } catch (error) {
      showNotification('error', error.message || 'Failed to remove machine');
    }
  }

  function handleMachineSsh(machineNode) {
    const machineId = machineNode?.data?.machineId;
    const modelName = machineNode?.data?.modelName;
    if (!machineId || machineId === 'pending') {
      showNotification('error', 'Machine ID is not available yet');
      return;
    }

    const command = modelName ? `juju ssh -m ${modelName} ${machineId}` : `juju ssh ${machineId}`;
    const sshWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!sshWindow) {
      showNotification('error', 'Unable to open SSH window');
      return;
    }

    sshWindow.document.write(`
      <html>
        <head>
          <title>SSH to Machine ${machineId}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: #0f172a; color: #e2e8f0; }
            .cmd { background: #111827; padding: 12px 16px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #93c5fd; }
            button { margin-top: 12px; background: #2563eb; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
          </style>
        </head>
        <body>
          <h2>Run this command in your terminal</h2>
          <div class="cmd">${command}</div>
          <button onclick="navigator.clipboard.writeText('${command.replace(/'/g, "\\'")}')">Copy command</button>
          <p style="margin-top: 12px; font-size: 12px; color: #94a3b8;">This opens a new window with the Juju SSH command.</p>
        </body>
      </html>
    `);
    sshWindow.document.close();
  }

  function addCharmNode() {
    // Add charm template to sidebar instead of canvas
    sidebarCharms = [...sidebarCharms, {
      id: `sidebar-charm-${sidebarCharmCounter++}`,
      charm: '',
      channel: 'stable',
      revision: '',
      units: '',
      charmName: '',
      configPairs: [{ key: '', value: '' }],
      constraintPairs: [{ key: '', value: '' }]
    }];
  }

  function removeCharmTemplate(id) {
    sidebarCharms = sidebarCharms.filter(c => c.id !== id);
    expandedCharmOptions.delete(id);
    expandedCharmOptions = new Set(expandedCharmOptions); // Trigger reactivity
  }

  function handleSaveCharmTemplate(template) {
    if (!template?.charm?.trim()) {
      showNotification('error', 'Charm name is required to save a template');
      return;
    }

    const savedTemplate = {
      id: `saved-charm-${savedCharmCounter++}`,
      charm: template.charm,
      channel: template.channel,
      revision: template.revision,
      units: template.units,
      charmName: '',
      configPairs: Array.isArray(template.configPairs)
        ? template.configPairs.map(pair => ({ ...pair }))
        : [{ key: '', value: '' }],
      constraintPairs: Array.isArray(template.constraintPairs)
        ? template.constraintPairs.map(pair => ({ ...pair }))
        : [{ key: '', value: '' }]
    };
true
    savedCharmTemplates = [...savedCharmTemplates, savedTemplate];
    showNotification('success', `Saved template for ${template.charm}`);
  }

  function updateSavedTemplate(id, field, value) {
    savedCharmTemplates = savedCharmTemplates.map(template =>
      template.id === id ? { ...template, [field]: value } : template
    );
  }

  function removeSavedTemplate(id) {
    savedCharmTemplates = savedCharmTemplates.filter(template => template.id !== id);
  }

  async function handleAddModel() {
    const trimmedName = addModelName.trim();
    if (!trimmedName) {
      addModelError = 'Model name is required';
      return;
    }
    addModelError = '';
    isAddingModel = true;
    try {
      await addModel(trimmedName);
      showNotification('success', `Added model ${trimmedName}`);
      addModelName = '';
      const response = await listModels();
      availableModels = response?.models || [];
    } catch (error) {
      addModelError = error.message || 'Failed to add model';
      showNotification('error', addModelError);
    } finally {
      isAddingModel = false;
    }
  }

  function updateCharmTemplate(id, field, value) {
    sidebarCharms = sidebarCharms.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    );
  }

  function updateConfigPair(templateId, index, field, value) {
    sidebarCharms = sidebarCharms.map(c => {
      if (c.id === templateId) {
        const newConfigPairs = [...c.configPairs];
        newConfigPairs[index] = { ...newConfigPairs[index], [field]: value };
        return { ...c, configPairs: newConfigPairs };
      }
      return c;
    });
  }

  function addConfigPair(templateId) {
    sidebarCharms = sidebarCharms.map(c => 
      c.id === templateId ? { ...c, configPairs: [...c.configPairs, { key: '', value: '' }] } : c
    );
  }

  function removeConfigPair(templateId, index) {
    sidebarCharms = sidebarCharms.map(c => {
      if (c.id === templateId) {
        const newConfigPairs = c.configPairs.filter((_, i) => i !== index);
        // Keep at least one pair
        return { ...c, configPairs: newConfigPairs.length > 0 ? newConfigPairs : [{ key: '', value: '' }] };
      }
      return c;
    });
  }

  function updateConstraintPair(templateId, index, field, value) {
    sidebarCharms = sidebarCharms.map(c => {
      if (c.id === templateId) {
        const newConstraintPairs = [...c.constraintPairs];
        newConstraintPairs[index] = { ...newConstraintPairs[index], [field]: value };
        return { ...c, constraintPairs: newConstraintPairs };
      }
      return c;
    });
  }

  function addConstraintPair(templateId) {
    sidebarCharms = sidebarCharms.map(c => 
      c.id === templateId ? { ...c, constraintPairs: [...c.constraintPairs, { key: '', value: '' }] } : c
    );
  }

  function removeConstraintPair(templateId, index) {
    sidebarCharms = sidebarCharms.map(c => {
      if (c.id === templateId) {
        const newConstraintPairs = c.constraintPairs.filter((_, i) => i !== index);
        // Keep at least one pair
        return { ...c, constraintPairs: newConstraintPairs.length > 0 ? newConstraintPairs : [{ key: '', value: '' }] };
      }
      return c;
    });
  }

  function toggleCharmOptions(id) {
    if (expandedCharmOptions.has(id)) {
      expandedCharmOptions.delete(id);
    } else {
      expandedCharmOptions.add(id);
    }
    expandedCharmOptions = new Set(expandedCharmOptions); // Trigger reactivity
  }

  // Drag and drop state
  let draggedCharmTemplate = $state(null);
  let dropTargetModelFrame = $state(null);
  let dropTargetMachineId = $state(null);

  // Auto-resize model frames based on child charm nodes
  $effect(() => {
    const currentNodes = $nodes;
    let needsUpdate = false;
    let updatedNodes = [...currentNodes];
    
    // Calculate required size for each model frame
    const modelFrames = currentNodes.filter(n => n.type === 'modelFrame');
    
    modelFrames.forEach((modelFrame, mfIndex) => {
      // Get all charm nodes in this model frame (check both parentId and parentNode)
      const charmNodes = currentNodes.filter(n => 
        n.type === 'charmNode' && (n.parentId === modelFrame.id || n.parentNode === modelFrame.id)
      );
      
      if (charmNodes.length > 0) {
        // Calculate the bounding box of all charm nodes
        const CHARM_WIDTH = 300;
        const CHARM_HEIGHT = 150;
        const PADDING = 100; // Padding around the content
        const MIN_WIDTH = 800;
        const MIN_HEIGHT = 600;
        
        let maxX = 0;
        let maxY = 0;
        
        charmNodes.forEach(node => {
          const rightEdge = node.position.x + CHARM_WIDTH;
          const bottomEdge = node.position.y + CHARM_HEIGHT;
          
          if (rightEdge > maxX) maxX = rightEdge;
          if (bottomEdge > maxY) maxY = bottomEdge;
        });
        
        // Add padding and ensure minimum size
        const requiredWidth = Math.max(MIN_WIDTH, maxX + PADDING);
        const requiredHeight = Math.max(MIN_HEIGHT, maxY + PADDING);
        
        // Update model frame size if needed
        const newStyle = `width: ${requiredWidth}px; height: ${requiredHeight}px; z-index: 0;`;
        
        if (modelFrame.style !== newStyle) {
          const mfNodeIndex = updatedNodes.findIndex(n => n.id === modelFrame.id);
          if (mfNodeIndex !== -1) {
            updatedNodes[mfNodeIndex] = {
              ...updatedNodes[mfNodeIndex],
              style: newStyle
            };
            needsUpdate = true;
          }
        }
      }
    });
    
    // Only update if changes were made
    if (needsUpdate) {
      nodes.set(updatedNodes);
    }
  });

  // Update model frame visual state when drag target changes
  $effect(() => {
    // Always update when drag state changes (including when it resets to null)
    nodes.update(n => n.map(node => {
      if (node.type === 'modelFrame') {
        return {
          ...node,
          data: {
            ...node.data,
            isDropTarget: node.id === dropTargetModelFrame,
            isDragActive: draggedCharmTemplate !== null
          }
        };
      }
      if (node.type === 'machineNode') {
        return {
          ...node,
          data: {
            ...node.data,
            isDropTarget: node.id === dropTargetMachineId,
            isDragActive: draggedCharmTemplate !== null
          }
        };
      }
      return node;
    }));
  });

  function buildConfigAndConstraints(charmTemplate) {
    const configStr = Array.isArray(charmTemplate.configPairs)
      ? charmTemplate.configPairs
          .filter(pair => pair.key.trim() !== '')
          .map(pair => `${pair.key}=${pair.value}`)
          .join(' ')
      : (charmTemplate.config || '');

    const constraintsStr = Array.isArray(charmTemplate.constraintPairs)
      ? charmTemplate.constraintPairs
          .filter(pair => pair.key.trim() !== '')
          .map(pair => `${pair.key}=${pair.value}`)
          .join(' ')
      : (charmTemplate.constraints || '');

    return { configStr, constraintsStr };
  }

  function getPendingUnitsForMachine(modelId, machineId) {
    return pendingMachineDeploys
      .filter(item => item.modelId === modelId && item.machineId === machineId)
      .map(item => item.label);
  }

  function getPendingMachineNodes(modelId) {
    return pendingMachineDeploys.filter(item => item.modelId === modelId && !item.machineId);
  }

  function addPendingMachineDeploy({ modelId, machineId, label, position }) {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = { id, modelId, machineId: machineId ?? null, label, position };
    pendingMachineDeploys = [...pendingMachineDeploys, entry];

    if (machineId) {
      nodes.update(currentNodes =>
        currentNodes.map(node => {
          if (node.type !== 'machineNode') {
            return node;
          }
          const parentId = node.parentId ?? node.parentNode;
          if (parentId !== modelId) {
            return node;
          }
          if (String(node.data?.machineId) !== String(machineId)) {
            return node;
          }
          const existingPending = node.data?.pendingUnits ?? [];
          return {
            ...node,
            data: {
              ...node.data,
              pendingUnits: [...existingPending, label]
            }
          };
        })
      );
    } else {
      const snapped = snapToGrid(position);
      nodes.update(currentNodes => {
        const modelFrame = currentNodes.find(node => node.id === modelId);
        const viewMode = modelFrame?.data?.viewMode || 'app';
        const modelName = modelFrame?.data?.modelName || '';
        const modelType = modelFrame?.data?.modelType || '';
        return [
          ...currentNodes,
          {
            id: `machine-${modelId}-${id}`,
            type: 'machineNode',
            position: snapped,
            data: {
              machineId: 'pending',
              units: [],
              pendingUnits: [label],
              isTemporary: true,
              modelName,
              modelType,
              isSelected: false,
              onToggleSelect: toggleMachineSelection,
              onRemoveMachine: handleRemoveMachine,
              machineInfo: {
                instanceId: 'pending',
                base: 'pending',
                state: 'deploying',
                message: ''
              }
            },
            parentId: modelId,
            extent: 'parent',
            style: 'z-index: 8;',
            hidden: viewMode !== 'machine'
          }
        ];
      });
    }

    return id;
  }

  function clearPendingMachineDeploy(pendingId) {
    const removed = pendingMachineDeploys.find(item => item.id === pendingId);
    pendingMachineDeploys = pendingMachineDeploys.filter(item => item.id !== pendingId);

    if (removed?.machineId) {
      nodes.update(currentNodes =>
        currentNodes.map(node => {
          if (node.type !== 'machineNode') {
            return node;
          }
          const parentId = node.parentId ?? node.parentNode;
          if (parentId !== removed.modelId) {
            return node;
          }
          if (String(node.data?.machineId) !== String(removed.machineId)) {
            return node;
          }
          const remainingPending = (node.data?.pendingUnits ?? []).filter(unit => unit !== removed.label);
          return {
            ...node,
            data: {
              ...node.data,
              pendingUnits: remainingPending
            }
          };
        })
      );
    } else {
      nodes.update(currentNodes =>
        currentNodes.filter(node => !(node.type === 'machineNode' && node.id === `machine-${removed.modelId}-${removed.id}`))
      );
    }
  }

  async function handleMachineViewDeploy({ modelFrame, charmTemplate, machineTarget, position }) {
    const modelName = modelFrame.data?.modelName;
    const modelType = (modelFrame.data?.modelType || '').toString().toLowerCase();
    const isK8sModel = modelType === 'caas' || modelType === 'k8s' || modelType === 'kubernetes';
    if (!modelName) {
      showNotification('error', 'Model name is missing for this deploy');
      return;
    }
    if (isK8sModel) {
      showNotification('error', 'Kubernetes models do not support machine view deployments');
      return;
    }
    const { configStr, constraintsStr } = buildConfigAndConstraints(charmTemplate);
    const label = charmTemplate.charmName || charmTemplate.charm;
    const targetMachineId = machineTarget?.data?.machineId;
    const currentGroup = getSelectedMachineGroup(modelName);
    const isTargetInGroup = targetMachineId
      ? currentGroup.includes(String(targetMachineId))
      : false;
    const targetMachineIds = isTargetInGroup
      ? currentGroup
      : (targetMachineId ? [String(targetMachineId)] : []);

    const pendingIds = targetMachineIds.length
      ? targetMachineIds.map(machineId => addPendingMachineDeploy({
          modelId: modelFrame.id,
          machineId,
          label,
          position
        }))
      : [addPendingMachineDeploy({
          modelId: modelFrame.id,
          machineId: null,
          label,
          position
        })];

    try {
      const { task_id } = await deployCharm(modelName, charmTemplate.charm, {
        channel: charmTemplate.channel,
        revision: charmTemplate.revision,
        charm_name: charmTemplate.charmName,
        config: configStr,
        constraints: constraintsStr,
        machine_id: targetMachineIds.length ? targetMachineIds.join(',') : ''
      });

      await pollTask(task_id);
      if (targetMachineIds.length > 0) {
        showNotification('success', `Deploying ${label} to machine${targetMachineIds.length > 1 ? 's' : ''} ${targetMachineIds.join(', ')}`);
      } else {
        showNotification('success', `Deploying ${label} to new machine`);
      }
    } catch (error) {
      showNotification('error', error.message || 'Failed to deploy charm');
    } finally {
      pendingIds.forEach(id => clearPendingMachineDeploy(id));
      try {
        const status = await getModelStatus(modelName);
        handleModelRefresh(modelFrame.id, status);
      } catch (error) {
        console.error('Failed to refresh model after deploy:', error);
      }
    }
  }

  function findMachineNodeAtPoint(clientX, clientY) {
    const machineNodes = $nodes.filter(node => node.type === 'machineNode' && !node.hidden);
    for (const node of machineNodes) {
      const element = document.querySelector(`[data-id="${node.id}"]`);
      if (!element) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return node;
      }
    }
    return null;
  }

  function handleCharmDragStart(event, charmTemplate) {
    // Don't start drag if clicking on an input or button
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.closest('button')) {
      return;
    }
    
    if (!charmTemplate.charm.trim()) {
      event.preventDefault();
      alert('Please enter a charm name before dragging');
      return;
    }
    draggedCharmTemplate = charmTemplate;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', charmTemplate.id);
  }

  function handleCharmDragEnd(event) {
    draggedCharmTemplate = null;
    dropTargetModelFrame = null;
    dropTargetMachineId = null;
  }

  function handleCanvasDragOver(event) {
    if (draggedCharmTemplate) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const machineTarget = findMachineNodeAtPoint(event.clientX, event.clientY);
      dropTargetMachineId = machineTarget ? machineTarget.id : null;
    } else if (draggedModelName) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  async function handleCanvasDrop(event) {
    event.preventDefault();
    
    if (draggedModelName) {
      const modelName = draggedModelName;
      const canvasRect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - canvasRect.left;
      const y = event.clientY - canvasRect.top;
      await addModelFrame(modelName, { x: Math.max(20, x - 200), y: Math.max(20, y - 100) });
      draggedModelName = null;
      dropTargetMachineId = null;
      return;
    }

    if (!draggedCharmTemplate) return;

  const charmTemplate = draggedCharmTemplate;
  let machineTarget = findMachineNodeAtPoint(event.clientX, event.clientY);
    
    // Get drop position on the canvas
    const canvasRect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;
    
    // Find which model frame (if any) the drop happened on
    const modelFrame = machineTarget
      ? $nodes.find(node => node.id === (machineTarget.parentId ?? machineTarget.parentNode))
      : $nodes.find(node => {
          if (node.type !== 'modelFrame') return false;

          // Get the model frame's DOM element to check bounds
          const frameElement = document.querySelector(`[data-id="${node.id}"]`);
          if (!frameElement) return false;

          const frameRect = frameElement.getBoundingClientRect();
          return (
            event.clientX >= frameRect.left &&
            event.clientX <= frameRect.right &&
            event.clientY >= frameRect.top &&
            event.clientY <= frameRect.bottom
          );
        });

    if (!modelFrame) {
      alert('Please drop the charm into a model frame');
      draggedCharmTemplate = null;
      dropTargetMachineId = null;
      return;
    }

    // Calculate position relative to the model frame
    const frameElement = document.querySelector(`[data-id="${modelFrame.id}"]`);
    const frameRect = frameElement.getBoundingClientRect();
    const relativeX = event.clientX - frameRect.left;
    const relativeY = event.clientY - frameRect.top;

    const { configStr, constraintsStr } = buildConfigAndConstraints(charmTemplate);
    const modelType = (modelFrame.data?.modelType || '').toString().toLowerCase();
    const isK8sModel = modelType === 'caas' || modelType === 'k8s' || modelType === 'kubernetes';
    const isMachineView = !isK8sModel && modelFrame.data?.viewMode === 'machine';

    if (isK8sModel && machineTarget) {
      showNotification('error', 'Kubernetes models do not support machine placement');
      machineTarget = null;
    }

    if (isMachineView) {
      await handleMachineViewDeploy({
        modelFrame,
        charmTemplate,
        machineTarget,
        position: { x: relativeX, y: relativeY }
      });
      sidebarCharms = sidebarCharms.filter(c => c.id !== charmTemplate.id);
      draggedCharmTemplate = null;
      dropTargetModelFrame = null;
      dropTargetMachineId = null;
      return;
    }

    if (machineTarget) {
      nodeIdCounter++;
      const newNode = {
        id: `charm-${nodeIdCounter}`,
        type: 'charmNode',
        position: {
          x: Math.max(20, relativeX - 150),
          y: Math.max(20, relativeY - 100)
        },
        data: {
          charm: charmTemplate.charm,
          channel: charmTemplate.channel,
          revision: charmTemplate.revision,
          charmName: charmTemplate.charmName || charmTemplate.charm,
          config: configStr,
          constraints: constraintsStr,
          model: modelFrame.data.modelName,
          modelName: modelFrame.data.modelName,
          modelType,
          onDeploySuccess: handleDeploySuccess,
          onRemoveNode: handleRemoveNode,
          autoDeployOnDrop: true,
          machineId: machineTarget.data?.machineId,
          desiredUnits: ''
        },
        parentNode: modelFrame.id,
        extent: 'parent',
        style: 'z-index: 10;',
        hidden: isMachineView
      };

      nodes.update(n => [...n, newNode]);
      sidebarCharms = sidebarCharms.filter(c => c.id !== charmTemplate.id);
      draggedCharmTemplate = null;
      dropTargetModelFrame = null;
      dropTargetMachineId = null;
      return;
    }

    // Create a charm node on the canvas at the drop position
    nodeIdCounter++;
    const newNode = {
      id: `charm-${nodeIdCounter}`,
      type: 'charmNode',
      position: { 
        x: Math.max(20, relativeX - 150), // Center the node on cursor (node width ~300px)
        y: Math.max(20, relativeY - 100)
      },
      data: {
        charm: charmTemplate.charm,
        channel: charmTemplate.channel,
        revision: charmTemplate.revision,
        charmName: charmTemplate.charmName || charmTemplate.charm,
        config: configStr,
        constraints: constraintsStr,
  model: modelFrame.data.modelName,
  modelName: modelFrame.data.modelName,
  modelType,
        onDeploySuccess: handleDeploySuccess,
        onRemoveNode: handleRemoveNode,
        autoDeployOnDrop: true, // Signal to auto-deploy
        desiredUnits: charmTemplate.units
      },
      parentNode: modelFrame.id,
      extent: 'parent',
      style: 'z-index: 10;',
      hidden: isMachineView
    };

    nodes.update(n => [...n, newNode]);
    
    // Remove the charm template from sidebar after deployment
    sidebarCharms = sidebarCharms.filter(c => c.id !== charmTemplate.id);
    
    draggedCharmTemplate = null;
    dropTargetModelFrame = null;
    dropTargetMachineId = null;
  }

  function handleModelFrameDragOver(event, modelFrameId) {
    if (draggedCharmTemplate) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dropTargetModelFrame = modelFrameId;
    }
  }

  function handleModelFrameDragLeave(event, modelFrameId) {
    if (dropTargetModelFrame === modelFrameId) {
      dropTargetModelFrame = null;
    }
  }

  async function handleModelFrameDrop(event, modelFrame) {
    event.preventDefault();
    
    if (!draggedCharmTemplate) return;

  const charmTemplate = draggedCharmTemplate;
  const modelType = (modelFrame.data?.modelType || '').toString().toLowerCase();
  const isK8sModel = modelType === 'caas' || modelType === 'k8s' || modelType === 'kubernetes';
  const isMachineView = !isK8sModel && modelFrame.data?.viewMode === 'machine';
    
    // Get the drop position relative to the model frame
    const modelFrameElement = event.currentTarget;
    const rect = modelFrameElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const { configStr, constraintsStr } = buildConfigAndConstraints(charmTemplate);
    if (isMachineView) {
      await handleMachineViewDeploy({
        modelFrame,
        charmTemplate,
        machineTarget: null,
        position: { x, y }
      });
      sidebarCharms = sidebarCharms.filter(c => c.id !== charmTemplate.id);
      draggedCharmTemplate = null;
      dropTargetModelFrame = null;
      dropTargetMachineId = null;
      return;
    }

    // Create a charm node on the canvas at the drop position
    nodeIdCounter++;
    const newNode = {
      id: `charm-${nodeIdCounter}`,
      type: 'charmNode',
      position: { 
        x: Math.max(20, x - 150), // Center the node on cursor (node width ~300px)
        y: Math.max(20, y - 100)
      },
      data: {
        charm: charmTemplate.charm,
        channel: charmTemplate.channel,
        revision: charmTemplate.revision,
        charmName: charmTemplate.charmName || charmTemplate.charm,
  model: modelFrame.data.modelName,
  modelName: modelFrame.data.modelName,
  modelType,
        config: configStr,
        constraints: constraintsStr,
        onDeploySuccess: handleDeploySuccess,
        autoDeployOnDrop: true, // Signal to auto-deploy
        desiredUnits: charmTemplate.units
      },
      parentNode: modelFrame.id,
      extent: 'parent',
      style: 'z-index: 10;',
      hidden: isMachineView
    };

    nodes.update(n => [...n, newNode]);
    
    // Remove the charm template from sidebar after deployment
    sidebarCharms = sidebarCharms.filter(c => c.id !== charmTemplate.id);
    
    draggedCharmTemplate = null;
    dropTargetModelFrame = null;
    dropTargetMachineId = null;
  }

  async function addModelFrame(modelName, position = { x: 120, y: 60 }) {
    if (!modelName) {
      showNotification('error', 'Model name is required');
      return;
    }

    const existing = $nodes.find(node => node.type === 'modelFrame' && node.data?.modelName === modelName);
    if (existing) {
      showNotification('error', `Model ${modelName} is already on the canvas`);
      return;
    }

  const resolvedPosition = findAvailableModelPosition(position);
    const modelId = `model-${modelIdCounter++}`;
    const newNode = {
      id: modelId,
      type: 'modelFrame',
      position: resolvedPosition,
      data: { 
        modelName,
        modelType: '',
        onRefreshSuccess: handleModelRefresh,
        onViewModeChange: handleViewModeChange,
        onClose: handleRemoveModelFrame,
        viewMode: 'app'
      },
      style: 'width: 800px; height: 600px; z-index: 0;'
    };

    nodes.update(n => [...n, newNode]);

    try {
      const status = await getModelStatus(modelName);
      handleModelRefresh(modelId, status);
    } catch (error) {
      showNotification('error', `Failed to load model ${modelName}: ${error.message}`);
    }
  }

  function parseModelFrameSize(style) {
    const defaultSize = { width: 800, height: 600 };
    if (!style) {
      return defaultSize;
    }

    const widthMatch = /width:\s*(\d+)px/.exec(style);
    const heightMatch = /height:\s*(\d+)px/.exec(style);
    return {
      width: widthMatch ? Number(widthMatch[1]) : defaultSize.width,
      height: heightMatch ? Number(heightMatch[1]) : defaultSize.height
    };
  }

  function findAvailableModelPosition(initialPosition, excludeId = null) {
    const existingFrames = $nodes.filter(node => node.type === 'modelFrame' && node.id !== excludeId);
    if (!existingFrames.length) {
      return { x: Math.max(20, initialPosition.x), y: Math.max(20, initialPosition.y) };
    }

    const baseSize = parseModelFrameSize('width: 800px; height: 600px;');
    const padding = 20;
    const step = 40;
    const maxAttempts = 120;

    const isOverlapping = (candidate) => {
      return existingFrames.some(frame => {
        const frameSize = parseModelFrameSize(frame.style);
        const frameLeft = frame.position.x;
        const frameTop = frame.position.y;
        const frameRight = frameLeft + frameSize.width + padding;
        const frameBottom = frameTop + frameSize.height + padding;

        const candidateLeft = candidate.x;
        const candidateTop = candidate.y;
        const candidateRight = candidateLeft + baseSize.width + padding;
        const candidateBottom = candidateTop + baseSize.height + padding;

        return !(
          candidateRight <= frameLeft ||
          candidateLeft >= frameRight ||
          candidateBottom <= frameTop ||
          candidateTop >= frameBottom
        );
      });
    };

    const start = {
      x: Math.max(20, initialPosition.x),
      y: Math.max(20, initialPosition.y)
    };

    if (!isOverlapping(start)) {
      return start;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const xOffset = step * (attempt % 6);
      const yOffset = step * Math.floor(attempt / 6);
      const candidate = {
        x: start.x + xOffset,
        y: start.y + yOffset
      };
      if (!isOverlapping(candidate)) {
        return candidate;
      }
    }

    return start;
  }

  function handleRemoveModelFrame(modelId) {
    const modelFrame = $nodes.find(node => node.id === modelId);
    if (!modelFrame) {
      return;
    }

    const modelName = modelFrame.data?.modelName;
    const removedNodeIds = new Set();

    nodes.update(currentNodes =>
      currentNodes.filter(node => {
        const parentId = node.parentId ?? node.parentNode;
        const shouldRemove = node.id === modelId || parentId === modelId;
        if (shouldRemove) {
          removedNodeIds.add(node.id);
        }
        return !shouldRemove;
      })
    );

    edges.update(currentEdges =>
      currentEdges.filter(edge => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))
    );

    pendingMachineDeploys = pendingMachineDeploys.filter(entry => entry.modelId !== modelId);
    if (modelName && selectedMachineGroups?.[modelName]) {
      const { [modelName]: _removed, ...rest } = selectedMachineGroups;
      selectedMachineGroups = rest;
    }

    if (selectedNodeId && removedNodeIds.has(selectedNodeId)) {
      selectedNodeId = null;
    }
    if (selectedEdgeId) {
      const selectedEdge = $edges.find(edge => edge.id === selectedEdgeId);
      if (selectedEdge && (removedNodeIds.has(selectedEdge.source) || removedNodeIds.has(selectedEdge.target))) {
        selectedEdgeId = null;
      }
    }
  }

  async function onConnect(connection) {
    // Get the source and target nodes to extract app names
    const sourceNode = $nodes.find(n => n.id === connection.source);
    const targetNode = $nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) {
      console.error('Could not find source or target node');
      return;
    }

    const sourceApp = sourceNode.data?.appName || sourceNode.data?.charmName;
    const targetApp = targetNode.data?.appName || targetNode.data?.charmName;
    const sourceModel = sourceNode.data?.modelName || sourceNode.data?.model;
    const targetModel = targetNode.data?.modelName || targetNode.data?.model;
    const modelName = sourceModel || targetModel;

    if (sourceModel && targetModel && sourceModel !== targetModel) {
      showNotification('error', 'Cannot relate applications across different models');
      return;
    }

    if (!modelName) {
      showNotification('error', 'Model name is missing for this relation');
      return;
    }

    if (!sourceApp || !targetApp) {
      console.error('Could not determine app names');
      return;
    }

    console.log(`Creating relation between ${sourceApp} and ${targetApp}`);
  relationCreateError = null;

    // Create edge immediately (will show as pending)
    const edgeId = `edge-${edgeIdCounter++}`;
    const newEdge = {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      type: 'relationEdge',
      selectable: true,
      focusable: true,
      data: {
        model: modelName,
        isRelated: false,
        relationError: ''
      }
    };

  edges.update(e => applyEdgeGrouping([...e, newEdge]));

    // Store the connection info to remove both edges if needed
    const sourceId = connection.source;
    const targetId = connection.target;

    // Call API to create relation (simple integrate without endpoints)
    try {
  const { task_id } = await createRelation(modelName, sourceApp, targetApp);
      
      // Poll for completion
      await pollTask(task_id);
      
      // Update edge to show success
      edges.update(e => e.map(edge => 
        edge.id === edgeId 
          ? { ...edge, data: { ...edge.data, isRelated: true } }
          : edge
      ));

      console.log(`✅ Relation created successfully: ${sourceApp} ↔ ${targetApp}`);
      showNotification('success', `Relation created: ${sourceApp} ↔ ${targetApp}`);
  relationCreateError = null;
  providerEndpointInput = '';
  requirerEndpointInput = '';
      
      // Revert edge back to normal (gray dashed) when notification disappears
      setTimeout(() => {
        edges.update(e => e.map(edge => 
          edge.id === edgeId 
            ? { ...edge, data: { ...edge.data, isRelated: false } }
            : edge
        ));
      }, 5000);
      
    } catch (error) {
      console.error('Failed to create relation:', error);
      console.log(`Removing edges for connection: ${sourceId} -> ${targetId}`);
      
      // Show error notification
      showNotification('error', `Failed to create relation: ${error.message}`);
      relationCreateError = {
        message: error.message,
        sourceId,
        targetId,
        model: modelName,
        providerApp: sourceApp,
        requirerApp: targetApp
      };
      providerEndpointInput = '';
      requirerEndpointInput = '';
      
      // Remove ALL edges between these two nodes (both our custom edge and Svelte Flow's default edge)
      setTimeout(() => {
        console.log(`Timeout triggered, removing edges between ${sourceId} and ${targetId}`);
        edges.update(e => {
          console.log('Current edges:', e.map(edge => ({ id: edge.id, source: edge.source, target: edge.target })));
          const filtered = e.filter(edge => {
            // Remove any edge that connects these two nodes
            const shouldRemove = (edge.source === sourceId && edge.target === targetId) ||
                                 (edge.source === targetId && edge.target === sourceId);
            console.log(`Edge ${edge.id}: ${shouldRemove ? 'removing' : 'keeping'}`);
            return !shouldRemove;
          });
          console.log(`Edges before filter: ${e.length}, after filter: ${filtered.length}`);
          return applyEdgeGrouping(filtered);
        });
      }, 5000);
    }
  }

  function clearCanvas() {
    if (confirm('Clear all nodes and edges?')) {
      nodes.set([]);
      edges.set([]);
      nodeIdCounter = 1;
      modelIdCounter = 1;
      edgeIdCounter = 1;
      selectedMachineGroups = {};
    }
  }
</script>

<div class="app-container w-full h-screen flex">
  <!-- Sidebar -->
  {#if showSidebar}
    <div class="sidebar w-64 bg-gray-800 text-white p-4 flex flex-col space-y-4">
      <div class="sidebar-header">
        <h1 class="text-2xl font-bold mb-2">Magician</h1>
      </div>

      <div class="divider border-t border-gray-600"></div>

      <!-- Models -->
      <div>
        <label class="block text-sm font-medium mb-2">Models</label>
        {#if isLoadingModels}
          <div class="text-xs text-gray-400">Loading models...</div>
        {:else if modelLoadError}
          <div class="text-xs text-red-400">{modelLoadError}</div>
        {:else if availableModels.length === 0}
          <div class="text-xs text-gray-400">No models found.</div>
        {:else}
          <div class="space-y-2">
            {#each availableModels as model (model.name)}
              <div
                class="bg-gray-700 rounded-lg p-2 cursor-move hover:bg-gray-600 transition-colors border border-transparent hover:border-blue-500"
                draggable="true"
                ondragstart={(event) => handleModelDragStart(event, model)}
                ondragend={handleModelDragEnd}
                title="Drag to canvas to add model"
              >
                <div class="text-sm font-semibold text-white">{model.name}</div>
                <div class="text-[11px] text-gray-400">{model.cloud} • {model.type}</div>
              </div>
            {/each}
          </div>
        {/if}
        <div class="mt-3 space-y-2">
          <input
            type="text"
            value={addModelName}
            oninput={(event) => addModelName = event.target.value}
            placeholder="New model name"
            class="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onclick={handleAddModel}
            disabled={isAddingModel}
            class="w-full px-3 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isAddingModel ? 'Adding...' : 'Add Model'}
          </button>
          {#if addModelError}
            <div class="text-xs text-red-400">{addModelError}</div>
          {/if}
        </div>
      </div>

      <div class="divider border-t border-gray-600"></div>

      <!-- Toolbar -->
      <div class="toolbar space-y-2">
        <h2 class="text-sm font-semibold text-gray-400 uppercase mb-3">Tools</h2>
        
        <button
          onclick={addCharmNode}
          class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-left flex items-center space-x-3"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Charm Node</span>
        </button>

        <button
          onclick={clearCanvas}
          class="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-left flex items-center space-x-3"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Clear Canvas</span>
        </button>
      </div>

      <div class="divider border-t border-gray-600"></div>

      <!-- Charm Templates -->
      <div class="charm-templates flex-1 overflow-y-auto space-y-2">
        <h2 class="text-sm font-semibold text-gray-400 uppercase mb-3">Charm Templates</h2>
        
        {#if sidebarCharms.length === 0}
          <p class="text-xs text-gray-500 italic">No charms added yet. Click "Add Charm Node" above.</p>
        {:else}
          <div class="space-y-2">
            {#each sidebarCharms as charmTemplate (charmTemplate.id)}
              <div 
                class="bg-gray-700 rounded-lg p-3 space-y-2 cursor-move hover:bg-gray-600 transition-colors border-2 border-transparent hover:border-blue-500"
                draggable={charmTemplate.charm.trim() !== ''}
                ondragstart={(e) => handleCharmDragStart(e, charmTemplate)}
                ondragend={handleCharmDragEnd}
                title={charmTemplate.charm.trim() ? 'Drag to model frame to deploy' : 'Enter charm name to enable dragging'}
              >
                <div class="flex justify-between items-start gap-2 min-w-0">
                  <div class="flex-1 space-y-2 min-w-0">
                    <input
                      type="text"
                      value={charmTemplate.charm}
                      oninput={(e) => updateCharmTemplate(charmTemplate.id, 'charm', e.target.value)}
                      placeholder="Charm name"
                      draggable="false"
                      class="w-full min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={charmTemplate.charmName}
                      oninput={(e) => updateCharmTemplate(charmTemplate.id, 'charmName', e.target.value)}
                      placeholder="App name (optional)"
                      draggable="false"
                      class="w-full min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={charmTemplate.channel}
                      oninput={(e) => updateCharmTemplate(charmTemplate.id, 'channel', e.target.value)}
                      placeholder="Channel"
                      draggable="false"
                      class="w-full min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div class="flex space-x-2">
                      <input
                        type="text"
                        value={charmTemplate.revision}
                        oninput={(e) => updateCharmTemplate(charmTemplate.id, 'revision', e.target.value)}
                        placeholder="Rev"
                        draggable="false"
                        class="w-16 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
                      />
                      <input
                        type="number"
                        value={charmTemplate.units}
                        oninput={(e) => updateCharmTemplate(charmTemplate.id, 'units', e.target.value)}
                        placeholder="Units"
                        min="1"
                        draggable="false"
                        class="w-20 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
                      />
                    </div>
                  </div>
                  <div class="flex flex-col gap-2">
                    <button
                      onclick={() => handleSaveCharmTemplate(charmTemplate)}
                      class="p-1 text-emerald-300 hover:text-emerald-200"
                      title="Save template"
                      type="button"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9h6v6H9z" />
                      </svg>
                    </button>
                    <button
                      onclick={() => removeCharmTemplate(charmTemplate.id)}
                      class="p-1 text-red-400 hover:text-red-300"
                      title="Remove"
                      type="button"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <!-- More Options Toggle -->
                <button
                  onclick={() => toggleCharmOptions(charmTemplate.id)}
                  draggable="false"
                  class="w-full flex items-center justify-between px-2 py-1 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded transition-colors"
                >
                  <span>More options</span>
                  <svg 
                    class="w-3 h-3 transition-transform {expandedCharmOptions.has(charmTemplate.id) ? 'rotate-180' : ''}" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                <!-- Collapsible Options -->
                {#if expandedCharmOptions.has(charmTemplate.id)}
                  <div class="space-y-3 pt-2 border-t border-gray-600">
                    <!-- Config Section -->
                    <div class="space-y-2">
                      <label class="text-xs font-semibold text-gray-300">Config</label>
                      {#each charmTemplate.configPairs as configPair, index (index)}
                        <div class="config-pair flex gap-2 items-center min-w-0">
                          <input
                            type="text"
                            value={configPair.key}
                            oninput={(e) => updateConfigPair(charmTemplate.id, index, 'key', e.target.value)}
                            placeholder="key"
                            draggable="false"
                            class="flex-1 min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={configPair.value}
                            oninput={(e) => updateConfigPair(charmTemplate.id, index, 'value', e.target.value)}
                            placeholder="value"
                            draggable="false"
                            class="flex-1 min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {#if charmTemplate.configPairs.length > 1}
                            <button
                              onclick={() => removeConfigPair(charmTemplate.id, index)}
                              draggable="false"
                              class="p-1 text-red-400 hover:text-red-300 flex-shrink-0"
                              title="Remove"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          {/if}
                        </div>
                      {/each}
                      <button
                        onclick={() => addConfigPair(charmTemplate.id)}
                        draggable="false"
                        class="w-full px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-300 transition-colors"
                      >
                        + Add Config
                      </button>
                    </div>

                    <!-- Constraints Section -->
                    <div class="space-y-2">
                      <label class="text-xs font-semibold text-gray-300">Constraints</label>
                      {#each charmTemplate.constraintPairs as constraintPair, index (index)}
                        <div class="constraint-pair flex gap-2 items-center min-w-0">
                          <input
                            type="text"
                            value={constraintPair.key}
                            oninput={(e) => updateConstraintPair(charmTemplate.id, index, 'key', e.target.value)}
                            placeholder="key"
                            draggable="false"
                            class="flex-1 min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={constraintPair.value}
                            oninput={(e) => updateConstraintPair(charmTemplate.id, index, 'value', e.target.value)}
                            placeholder="value"
                            draggable="false"
                            class="flex-1 min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {#if charmTemplate.constraintPairs.length > 1}
                            <button
                              onclick={() => removeConstraintPair(charmTemplate.id, index)}
                              draggable="false"
                              class="p-1 text-red-400 hover:text-red-300 flex-shrink-0"
                              title="Remove"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          {/if}
                        </div>
                      {/each}
                      <button
                        onclick={() => addConstraintPair(charmTemplate.id)}
                        draggable="false"
                        class="w-full px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-300 transition-colors"
                      >
                        + Add Constraint
                      </button>
                    </div>
                  </div>
                {/if}
                
                {#if charmTemplate.charm.trim()}
                  <div class="flex items-center text-xs text-gray-400 mt-1">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    Drag to model frame
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="divider border-t border-gray-600"></div>

      <!-- Saved Charm Templates -->
      <div class="saved-templates flex-1 overflow-y-auto space-y-2">
        <h2 class="text-sm font-semibold text-gray-400 uppercase mb-3">Saved Charm Templates</h2>

        {#if savedCharmTemplates.length === 0}
          <p class="text-xs text-gray-500 italic">No saved templates yet.</p>
        {:else}
          <div class="space-y-2">
            {#each savedCharmTemplates as savedTemplate (savedTemplate.id)}
              <div
                class="bg-gray-700 rounded-lg p-3 space-y-2 cursor-move hover:bg-gray-600 transition-colors border-2 border-transparent hover:border-emerald-500"
                draggable={savedTemplate.charm.trim() !== ''}
                ondragstart={(e) => handleCharmDragStart(e, savedTemplate)}
                ondragend={handleCharmDragEnd}
                title="Drag to model frame to deploy"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="text-sm font-semibold text-white truncate">{savedTemplate.charm}</div>
                  <button
                    onclick={() => removeSavedTemplate(savedTemplate.id)}
                    class="p-1 text-red-400 hover:text-red-300"
                    title="Remove saved template"
                    type="button"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={savedTemplate.charmName}
                  oninput={(event) => updateSavedTemplate(savedTemplate.id, 'charmName', event.target.value)}
                  placeholder="App name (optional)"
                  draggable="false"
                  class="w-full min-w-0 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div class="text-xs text-gray-300 space-y-1">
                  <div>Channel: {savedTemplate.channel || 'default'}</div>
                  <div>Revision: {savedTemplate.revision || 'latest'}</div>
                  <div>Units: {savedTemplate.units || '1'}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="divider border-t border-gray-600"></div>

      <!-- Instructions -->
      <div class="instructions text-xs text-gray-400 space-y-1">
        <p><strong>Tips:</strong></p>
        <ul class="list-disc list-inside space-y-1">
          <li>Drag a model into the canvas to add a model frame</li>
          <li>Add charm nodes to configure them in the sidebar</li>
          <li>Drag charm templates and drop into model frames to deploy</li>
          <li>Charm nodes will auto-deploy when dropped</li>
          <li>Connect nodes to create relations</li>
          <li>Click refresh on model to sync status</li>
        </ul>
      </div>
    </div>
  {/if}

  <!-- Main Canvas -->
  <div 
    class="canvas-container flex-1 relative"
    ondrop={handleCanvasDrop}
    ondragover={handleCanvasDragOver}
  >
    <SvelteFlow
      {nodes}
      {edges}
      {nodeTypes}
      {edgeTypes}
      onconnect={onConnect}
      on:nodedragstop={handleNodeDragStop}
      on:nodeclick={handleNodeClick}
      on:edgeclick={handleEdgeClick}
      on:selectionchange={handleSelectionChange}
      connectionRadius={30}
      elementsSelectable={true}
      edgesSelectable={true}
      nodesSelectable={true}
      noPanClassName="nopan"
      fitView
    >
      <Background variant="dots" gap={GRID_SIZE} size={1} />
      <Controls />
      <MiniMap />
      
      <Panel position="top-right">
        <div class="flex flex-col gap-3">
          <button
            onclick={() => showSidebar = !showSidebar}
            class="px-3 py-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-50 transition-colors"
          >
            {showSidebar ? '← Hide Sidebar' : 'Show Sidebar →'}
          </button>

          {#if relationCreateError}
            <div class="details-panel bg-white border-2 border-red-500 rounded-lg shadow-lg p-3 min-w-[260px]">
              <div class="text-xs font-semibold text-gray-700 mb-1">Relation creation failed</div>
              <div class="text-xs text-red-600 mb-2">{relationCreateError.message}</div>
              <div class="text-xs text-gray-600 mb-2">Provide endpoints if needed:</div>

              <div class="space-y-2 text-xs">
                <label class="block text-gray-600">
                  Provider ({relationCreateError.providerApp})
                  <input
                    type="text"
                    value={providerEndpointInput}
                    oninput={(event) => providerEndpointInput = event.target.value}
                    placeholder="endpoint (optional)"
                    class="mt-1 w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </label>
                <label class="block text-gray-600">
                  Requirer ({relationCreateError.requirerApp})
                  <input
                    type="text"
                    value={requirerEndpointInput}
                    oninput={(event) => requirerEndpointInput = event.target.value}
                    placeholder="endpoint (optional)"
                    class="mt-1 w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </label>
              </div>

              <button
                onclick={handleRetryRelation}
                class="mt-3 w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
                disabled={isRetryingRelation}
              >
                {isRetryingRelation ? 'Retrying...' : 'Retry relation'}
              </button>
            </div>
          {/if}

          {#if selectedEdge && selectedEdge.data?.isRelated}
            <div class="details-panel bg-white border-2 border-blue-500 rounded-lg shadow-lg p-3 min-w-[220px]">
              <div class="text-xs font-semibold text-gray-700 mb-2">Relation Details</div>
              <div class="space-y-1 text-xs text-gray-600 mb-3">
                <div><span class="font-medium">Interface:</span> {selectedEdge.data?.relationInterface || 'unknown'}</div>
                <div><span class="font-medium">Provider:</span> {selectedProviderApp}:{selectedProviderEndpoint}</div>
                <div><span class="font-medium">Requirer:</span> {selectedRequirerApp}:{selectedRequirerEndpoint}</div>
              </div>
              <button
                onclick={() => handleRemoveRelation(selectedEdge.id)}
                class="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove Relation
              </button>
            </div>
          {:else if selectedMachine}
            <div class="details-panel bg-white border-2 border-indigo-500 rounded-lg shadow-lg p-3 min-w-[220px]">
              <div class="text-xs font-semibold text-gray-700 mb-2">Machine Details</div>
              <div class="text-xs text-gray-500 mb-2">Machine {selectedMachine.data?.machineId ?? 'unknown'}</div>
              <div class="space-y-1 text-xs text-gray-600">
                <div><span class="font-medium">Inst ID:</span> {selectedMachine.data?.machineInfo?.instanceId || 'unknown'}</div>
                <div><span class="font-medium">IP:</span> {selectedMachine.data?.machineInfo?.ipAddress || 'unknown'}</div>
                <div><span class="font-medium">Base:</span> {selectedMachine.data?.machineInfo?.base || 'unknown'}</div>
                <div><span class="font-medium">State:</span> {selectedMachine.data?.machineInfo?.state || 'unknown'}</div>
                <div><span class="font-medium">Message:</span> {selectedMachine.data?.machineInfo?.message || '—'}</div>
              </div>
              <button
                onclick={() => handleMachineSsh(selectedMachine)}
                class="mt-3 w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded transition-colors"
              >
                SSH
              </button>
              <div class="mt-3 border-t border-gray-200 pt-3">
                <div class="text-xs font-semibold text-gray-700 mb-2">Run command</div>
                <input
                  type="text"
                  value={machineCommandInput}
                  oninput={(event) => machineCommandInput = event.target.value}
                  placeholder="sudo apt update; sudo apt install -y apache2"
                  class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onclick={handleRunMachineCommand}
                  disabled={isRunningMachineCommand}
                  class="mt-2 w-full px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded transition-colors disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {isRunningMachineCommand ? 'Running…' : 'Run Command'}
                </button>
                {#if machineCommandStatus !== null}
                  <div class="mt-2 text-xs text-gray-600">
                    Exit status: <span class="font-semibold">{machineCommandStatus}</span>
                  </div>
                {/if}
              </div>
            </div>
          {:else if selectedNode && selectedNode.type === 'charmNode'}
            <div class="details-panel bg-white border-2 border-emerald-500 rounded-lg shadow-lg p-3 min-w-[240px]">
              <div class="text-xs font-semibold text-gray-700 mb-2">Application Config</div>
              <div class="text-xs text-gray-500 mb-3">{selectedNode.data?.charmName || 'Application'}</div>

              <div class="mb-3 text-xs text-gray-600">
                <div class="font-medium text-gray-700">Trust</div>
                <div class="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={trustInput}
                    oninput={(event) => trustInput = event.target.value}
                    placeholder="true/false"
                    class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onclick={handleUpdateTrust}
                    disabled={isUpdatingTrust || !isTrustDirty}
                    class="px-3 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {isUpdatingTrust ? 'Updating...' : 'Update'}
                  </button>
                </div>
                {#if trustLoadError}
                  <div class="mt-1 text-xs text-red-600">{trustLoadError}</div>
                {/if}
              </div>

              {#if selectedAppConfigSet.length > 0}
                <div class="space-y-1 text-xs text-gray-600 mb-3">
                  {#each selectedAppConfigSet as entry}
                    <div class="flex justify-between gap-3">
                      <span class="font-medium">{entry.key}</span>
                      <span class="text-gray-700 break-all">{entry.value}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-xs text-gray-500 mb-3">No config values set.</div>
              {/if}

              {#if selectedAppConfigAll.length > selectedAppConfigSet.length}
                <button
                  onclick={() => {
                    if (isConfigDirty) {
                      handleUpdateConfig();
                    } else {
                      showFullConfig = !showFullConfig;
                    }
                  }}
                  class="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition-colors"
                  disabled={isUpdatingConfig}
                >
                  {#if isUpdatingConfig}
                    Updating config...
                  {:else if isConfigDirty}
                    Update config
                  {:else}
                    {showFullConfig ? 'Hide full config options' : 'Show all configs'}
                  {/if}
                </button>

                {#if showConfigResetPrompt}
                  <div class="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                    <div class="font-semibold mb-1">Confirm wiped config values</div>
                    <div class="mb-2">
                      You cleared {wipedConfigKeys.length} config value{wipedConfigKeys.length === 1 ? '' : 's'}:
                      <span class="font-medium">{wipedConfigKeys.join(', ')}</span>.
                    </div>
                    <div class="mb-2">Choose whether to set them to an empty string or reset them to none.</div>
                    <div class="flex gap-2">
                      <button
                        onclick={() => applyConfigUpdateWithReset(false)}
                        class="flex-1 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Set empty
                      </button>
                      <button
                        onclick={() => applyConfigUpdateWithReset(true)}
                        class="flex-1 rounded bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        Reset to none
                      </button>
                    </div>
                    <button
                      onclick={() => {
                        showConfigResetPrompt = false;
                        wipedConfigKeys = [];
                        pendingConfigUpdates = {};
                      }}
                      class="mt-2 w-full rounded border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      Cancel
                    </button>
                  </div>
                {/if}

                {#if showFullConfig}
                  <div class="mt-3 space-y-2 text-xs text-gray-600 max-h-40 overflow-y-auto">
                    {#each selectedAppConfigAll as entry}
                      <div class="flex items-center gap-2">
                        <span class="font-medium w-32 shrink-0">{entry.key}</span>
                        <input
                          type="text"
                          value={configEdits?.[entry.key] ?? entry.value}
                          oninput={(event) => {
                            const value = event.target.value;
                            configEdits = {
                              ...configEdits,
                              [entry.key]: value
                            };
                          }}
                          class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      </Panel>
    </SvelteFlow>
  </div>

  <!-- Notification Popup -->
  {#if notification}
    <div 
      class="fixed top-4 right-4 z-[10000] max-w-md animate-slide-in"
      role="alert"
    >
      <div 
        class="rounded-lg shadow-lg p-4 {notification.type === 'error' ? 'bg-red-50 border-2 border-red-500' : 'bg-green-50 border-2 border-green-500'}"
      >
        <div class="flex items-start gap-3">
          {#if notification.type === 'error'}
            <svg class="w-6 h-6 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          {:else}
            <svg class="w-6 h-6 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          {/if}
          <div class="flex-1">
            <p class="text-sm font-medium {notification.type === 'error' ? 'text-red-800' : 'text-green-800'}">
              {notification.type === 'error' ? 'Error' : 'Success'}
            </p>
            <p class="mt-1 text-sm {notification.type === 'error' ? 'text-red-700' : 'text-green-700'}">
              {notification.message}
            </p>
          </div>
          <button
            onclick={() => notification = null}
            class="flex-shrink-0 {notification.type === 'error' ? 'text-red-400 hover:text-red-600' : 'text-green-400 hover:text-green-600'}"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .app-container {
    font-family: system-ui, -apple-system, sans-serif;
  }

  .divider {
    margin: 0.5rem 0;
  }

  :global(.svelte-flow) {
    background-color: #f9fafb;
  }

  :global(.svelte-flow__edges) {
    z-index: 5 !important;
  }

  :global(.svelte-flow__edge) {
    cursor: pointer;
  }

  :global(.svelte-flow__edge.selected) {
    z-index: 1000 !important;
  }

  :global(.svelte-flow__node) {
    cursor: grab;
  }

  :global(.svelte-flow__node:active) {
    cursor: grabbing;
  }

  .animate-slide-in {
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
