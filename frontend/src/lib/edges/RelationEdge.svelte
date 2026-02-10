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

  let multiCount = $derived(data?.multiCount ?? 1);
  let multiIndex = $derived(data?.multiIndex ?? 0);

  // Calculate edge path
  let edgePath = $derived((() => {
    if (multiCount <= 1) {
      return getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition
      });
    }

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.max(Math.hypot(dx, dy), 40);
  const baseRadius = distance / 2 + 10;
  const radiusStep = 35;
  const radius = (baseRadius + Math.floor(multiIndex / 2) * radiusStep) * 1.38;
  const sweep = multiIndex % 2 === 0 ? 1 : 0;

    const arcPath = `M ${sourceX},${sourceY} A ${radius} ${radius} 0 0 ${sweep} ${targetX},${targetY}`;
    return [arcPath];
  })());

  function getArcMidpoint(sx, sy, tx, ty, radius, sweep) {
    const dx = tx - sx;
    const dy = ty - sy;
    const distance = Math.hypot(dx, dy);

    if (!distance || radius <= distance / 2) {
      return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
    }

    const midX = (sx + tx) / 2;
    const midY = (sy + ty) / 2;
    const ux = -dy / distance;
    const uy = dx / distance;
    const h = Math.sqrt(Math.max(radius * radius - (distance / 2) ** 2, 0));
    const sign = sweep === 1 ? 1 : -1;
    const centerX = midX + ux * h * sign;
    const centerY = midY + uy * h * sign;

    const angleA = Math.atan2(sy - centerY, sx - centerX);
    const angleB = Math.atan2(ty - centerY, tx - centerX);
    let delta = angleB - angleA;

    if (sweep === 1 && delta < 0) {
      delta += Math.PI * 2;
    } else if (sweep === 0 && delta > 0) {
      delta -= Math.PI * 2;
    }

    const midAngle = angleA + delta / 2;

    return {
      x: centerX + radius * Math.cos(midAngle),
      y: centerY + radius * Math.sin(midAngle)
    };
  }

  // Calculate label position (stick to arc midpoint)
  let labelPosition = $derived((() => {
    if (multiCount <= 1) {
      return { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
    }

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.max(Math.hypot(dx, dy), 40);
    const baseRadius = distance / 2 + 10;
    const radiusStep = 35;
  const radius = (baseRadius + Math.floor(multiIndex / 2) * radiusStep) * 1.38;
    const sweep = multiIndex % 2 === 0 ? 1 : 0;

    return getArcMidpoint(sourceX, sourceY, targetX, targetY, radius, sweep);
  })());

  let labelX = $derived(labelPosition.x - 40);
  let labelY = $derived(labelPosition.y - 16);

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
  id={`${id}-path`}
  path={edgePath[0]} 
  markerEnd={markerEnd}
  style={edgeStyle}
  labelStyle="fill: {edgeColor};"
  interactionWidth={30}
/>

<EdgeLabelRenderer>
  <div
    class="relation-label pointer-events-none"
    style={`transform: translate(${labelX}px, ${labelY}px);`}
  >
    {relationInterface}
  </div>
</EdgeLabelRenderer>


<style>
  .relation-info-card {
    font-family: system-ui, -apple-system, sans-serif;
  }

  .relation-label {
    position: absolute;
    padding: 2px 6px;
    font-size: 10px;
    line-height: 1.2;
    color: #111827;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.8);
    border-radius: 6px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.15);
    white-space: nowrap;
  }
</style>
