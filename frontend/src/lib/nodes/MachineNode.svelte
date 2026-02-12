<script>
  let { data } = $props();

  let machineId = $derived(data?.machineId ?? 'unknown');
  let units = $derived(data?.units ?? []);
</script>

<div class="bg-white border-2 border-slate-300 rounded-xl p-3 w-[240px] shadow-sm">
  <div class="flex items-center justify-between mb-2">
    <h3 class="text-sm font-semibold text-slate-800">Machine {machineId}</h3>
    <span class="text-[10px] text-slate-500">Units: {units.length}</span>
  </div>

  {#if units.length === 0}
    <div class="text-xs text-slate-400">No units</div>
  {:else}
    <div class="flex flex-wrap gap-1">
      {#each units as unit}
        <span class="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-700 border border-slate-200">
          {unit}
        </span>
      {/each}
    </div>
  {/if}
</div>
