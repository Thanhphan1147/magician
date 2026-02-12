<script>
  let { data } = $props();

  let machineId = $derived(data?.machineId ?? 'unknown');
  let units = $derived(data?.units ?? []);
  let isDropTarget = $derived(data?.isDropTarget ?? false);
  let pendingUnits = $derived(data?.pendingUnits ?? []);
  let isTemporary = $derived(data?.isTemporary ?? false);
  let modelName = $derived(data?.modelName ?? '');
  let isSelected = $derived(data?.isSelected ?? false);
  let onToggleSelect = $derived(data?.onToggleSelect);
  let onRemoveMachine = $derived(data?.onRemoveMachine);
  let isRemoving = $state(false);
  let showDeleteConfirm = $state(false);

  function handleSelectToggle(event) {
    if (!event.ctrlKey) {
      return;
    }
    event.stopPropagation();
    if (onToggleSelect && machineId !== 'pending') {
      onToggleSelect(modelName, machineId);
    }
  }

  function handleRemoveClick(event) {
    event.stopPropagation();
    showDeleteConfirm = true;
  }

  function handleCancelDelete(event) {
    event.stopPropagation();
    showDeleteConfirm = false;
  }

  async function handleConfirmDelete(event, force = false) {
    event.stopPropagation();
    if (!onRemoveMachine || isRemoving) {
      return;
    }
    isRemoving = true;
    try {
      await onRemoveMachine({ data, force });
    } finally {
      isRemoving = false;
      showDeleteConfirm = false;
    }
  }
</script>

<div
  class="relative bg-white border-2 rounded-xl p-3 w-[280px] min-h-[150px] shadow-sm {isDropTarget ? 'border-emerald-500 ring-2 ring-emerald-200' : isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-300'}"
  onpointerdown={handleSelectToggle}
  title={isSelected ? 'Ctrl+click to unselect' : 'Ctrl+click to select'}
>
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-semibold text-slate-800">
        {isTemporary ? 'Provisioning machine' : `Machine ${machineId}`}
      </h3>
      {#if isTemporary}
        <span class="h-2.5 w-2.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-slate-500">Units: {units.length + pendingUnits.length}</span>
      {#if !isTemporary && machineId !== 'pending'}
        <button
          class="text-slate-400 hover:text-red-500 transition-colors"
          onpointerdown={handleRemoveClick}
          title="Remove machine"
          type="button"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  {#if units.length === 0 && pendingUnits.length === 0}
    <div class="text-xs text-slate-400">No units</div>
  {:else}
    <div class="flex flex-wrap gap-1">
      {#each units as unit}
        <span class="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-700 border border-slate-200">
          {unit}
        </span>
      {/each}
      {#each pendingUnits as unit}
        <span class="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] text-amber-700 border border-amber-200 flex items-center gap-1">
          <span class="h-2 w-2 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></span>
          {unit}
        </span>
      {/each}
    </div>
  {/if}

  {#if showDeleteConfirm}
    <div class="absolute inset-0 bg-slate-900/30 rounded-xl flex items-center justify-center">
      <div class="bg-white rounded-xl p-3 shadow-lg w-full h-full flex flex-col justify-between" onpointerdown={(e) => e.stopPropagation()}>
        <div>
          <p class="text-xs font-semibold text-slate-800 mb-1">Remove this machine?</p>
          <p class="text-[11px] text-slate-500">This will remove the machine and its units.</p>
        </div>
        <div class="flex justify-end gap-2">
          <button
            class="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
            type="button"
            disabled={isRemoving}
            onpointerdown={handleCancelDelete}
          >
            Cancel
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
            type="button"
            disabled={isRemoving}
            onpointerdown={(event) => handleConfirmDelete(event, false)}
          >
            {isRemoving ? 'Removing…' : 'Remove'}
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-red-700 text-white hover:bg-red-800"
            type="button"
            disabled={isRemoving}
            onpointerdown={(event) => handleConfirmDelete(event, true)}
            title="Force remove"
          >
            Force
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
