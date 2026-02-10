<script>
  import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/svelte';

  // Props from Svelte Flow
  let {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    selected
  } = $props();

  // Runes state management
  let isRelated = $state(data?.isRelated || false);
  let showInfo = $state(false);
  let isRemoving = $state(false);

  // Debug logging
  console.log('RelationEdge rendered:', { id, selected, isRelated });

  // Update state when data changes
  $effect(() => {
    isRelated = data?.isRelated || false;
    console.log('isRelated updated:', isRelated, 'for edge:', id);
  });

  // Show info whenever relation exists or when removing
  $effect(() => {
    showInfo = isRelated || isRemoving;
    console.log('Edge selection changed:', { id, selected, showInfo, isRemoving });
  });

  // Derived state - color based on status
  let edgeColor = $derived(
    selected ? '#3b82f6' : (isRelated ? '#10b981' : '#9ca3af') // blue-500 (selected) : green-500 (success) : gray-400 (pending)
  );

  let edgeStyle = $derived(
    selected 
      ? 'stroke-width: 4;' 
      : (isRelated ? 'stroke-width: 3;' : 'stroke-width: 2; stroke-dasharray: 5;')
  );

  // Calculate edge path
  let edgePath = $derived(
    getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition
    })
  );

  // Calculate label position (top-left offset from middle of edge)
  let labelX = $derived((sourceX + targetX) / 2 - 120);
  let labelY = $derived((sourceY + targetY) / 2 - 80);

  // Get endpoint information
  let providerApp = $derived(data?.providerApp || 'unknown');
  let providerEndpoint = $derived(data?.providerEndpoint || 'unknown');
  let requirerApp = $derived(data?.requirerApp || 'unknown');
  let requirerEndpoint = $derived(data?.requirerEndpoint || 'unknown');
  let relationInterface = $derived(data?.relationInterface || 'unknown');

  async function handleRemove(event) {
    event.stopPropagation();
    event.preventDefault();
    console.log('Remove button clicked for edge:', id);
    
    if (data?.onRemove) {
      isRemoving = true; // Keep popup visible during removal
      try {
        await data.onRemove(id);
      } finally {
        isRemoving = false;
      }
    }
  }

  function handlePopupClick(event) {
    // Prevent clicks inside the popup from deselecting the edge
    event.stopPropagation();
  }
</script>

<!-- Render the edge line -->
<BaseEdge 
  path={edgePath[0]} 
  markerEnd={markerEnd}
  style={edgeStyle}
  labelStyle="fill: {edgeColor};"
  interactionWidth={30}
/>


<style>
  .relation-info-card {
    font-family: system-ui, -apple-system, sans-serif;
  }
</style>
