<script>
  import { getModelStatus } from "../api.js";

  // Props from Svelte Flow
  let { data, id } = $props();

  // Runes state management
  let modelName = $state(data?.modelName || "default");
  let isRefreshing = $state(false);
  let refreshError = $state("");
  let lastRefresh = $state(null);
  let modelStatus = $state(null);
  let isDropTarget = $state(data?.isDropTarget || false);
  let isDragActive = $state(data?.isDragActive || false);
  let showDropdown = $state(false);
  let autoRefreshInterval = $state("");
  let isAutoRefreshEnabled = $state(false);
  let autoRefreshTimer = $state(null);
  let viewMode = $state(data?.viewMode || "app");
  let modelType = $state(data?.modelType || "");
  let onClose = $derived(data?.onClose);

  // Update drop target state when data changes
  $effect(() => {
    isDropTarget = data?.isDropTarget || false;
    isDragActive = data?.isDragActive || false;
    viewMode = data?.viewMode || "app";
    modelType = data?.modelType || "";
  });

  let isK8sModel = $derived(
    (modelType || "").toString().toLowerCase() === "caas" ||
      (modelType || "").toString().toLowerCase() === "k8s" ||
      (modelType || "").toString().toLowerCase() === "kubernetes",
  );

  // Derived state
  let statusText = $derived(
    lastRefresh
      ? `Last updated: ${new Date(lastRefresh).toLocaleTimeString()}`
      : "Not refreshed",
  );

  // Computed class for drop target styling
  let frameClasses = $derived(
    isDropTarget
      ? "border-green-500 bg-green-50/50 border-4 shadow-lg shadow-green-200"
      : isDragActive
        ? "border-blue-400 bg-blue-50/30 border-2"
        : "border-blue-400 bg-blue-50/30 border-2",
  );

  // Computed border style - solid when dragging, dashed otherwise
  let borderStyle = $derived(isDragActive ? "border-solid" : "border-dashed");

  async function handleRefresh() {
    isRefreshing = true;
    refreshError = "";

    try {
      const status = await getModelStatus(modelName);
      modelStatus = status;
      lastRefresh = Date.now();

      // Notify parent if callback exists
      if (data?.onRefreshSuccess) {
        data.onRefreshSuccess(id, status);
      }
    } catch (error) {
      refreshError = error.message;
    } finally {
      isRefreshing = false;
    }
  }

  function toggleAutoRefresh() {
    if (isAutoRefreshEnabled) {
      // Stop auto-refresh
      if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
      }
      isAutoRefreshEnabled = false;
    } else {
      // Start auto-refresh
      const interval = parseInt(autoRefreshInterval);
      if (interval > 0) {
        isAutoRefreshEnabled = true;
        // Do an immediate refresh
        handleRefresh();
        // Set up the interval
        autoRefreshTimer = setInterval(() => {
          handleRefresh();
        }, interval * 1000);
      }
    }
    showDropdown = false;
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function setViewMode(mode) {
    const nextMode = !isK8sModel && mode === "machine" ? "machine" : "app";
    viewMode = nextMode;
    if (data?.onViewModeChange) {
      data.onViewModeChange(id, nextMode);
    }
  }

  function handleClose(event) {
    event.stopPropagation();
    event.preventDefault();
    if (onClose) {
      onClose(id);
    }
  }

  // Clean up interval when component is destroyed
  $effect(() => {
    return () => {
      if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
      }
    };
  });
</script>

<div
  class="model-frame rounded-xl p-4 w-full h-full min-w-[400px] min-h-[300px] transition-all duration-200 {frameClasses} {borderStyle}"
>
  <!-- Frame Header -->
  <div
    class="flex items-center justify-between mb-3 pb-2 border-b nopan {isDropTarget
      ? 'border-green-400'
      : 'border-blue-300'}"
  >
    <div>
      <h2
        class="text-xl font-bold {isDropTarget
          ? 'text-green-800'
          : 'text-blue-800'}"
      >
        Model: {modelName}
      </h2>
      {#if isDropTarget}
        <p class="text-sm text-green-600 font-medium mt-1 flex items-center">
          <svg
            class="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Drop here to deploy
        </p>
      {:else}
        <p class="text-xs text-blue-600 mt-1">{statusText}</p>
      {/if}
      {#if refreshError}
        <p class="text-xs text-red-600 mt-1">{refreshError}</p>
      {/if}
    </div>

    <div class="relative nopan">
      <div class="flex items-center space-x-1">
        <button
          onpointerdown={handleClose}
          class="px-2 py-2 text-sm font-medium text-white bg-slate-500 rounded-lg hover:bg-slate-600 transition-colors"
          title="Close model frame"
          aria-label="Close model frame"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        {#if !isK8sModel}
          <div
            class="flex items-center rounded-lg border border-blue-600 overflow-hidden mr-2"
          >
            <button
              onpointerdown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setViewMode("app");
              }}
              class="px-3 py-2 text-xs font-semibold transition-colors {viewMode ===
              'app'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-700 hover:bg-blue-50'}"
            >
              App view
            </button>
            <button
              onpointerdown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setViewMode("machine");
              }}
              class="px-3 py-2 text-xs font-semibold transition-colors {viewMode ===
              'machine'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-700 hover:bg-blue-50'}"
            >
              Machine view
            </button>
          </div>
        {/if}
        <button
          onpointerdown={(e) => {
            if (!isRefreshing) {
              e.stopPropagation();
              e.preventDefault();
              handleRefresh();
            }
          }}
          disabled={isRefreshing}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-l-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {#if isRefreshing}
            <svg
              class="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          {:else}
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          {/if}
          <span>Refresh Status</span>
        </button>

        <button
          onpointerdown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleDropdown();
          }}
          class="px-2 py-2 text-sm font-medium text-white bg-blue-600 rounded-r-lg hover:bg-blue-700 transition-colors border-l border-blue-700"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {#if showDropdown}
        <div
          class="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10"
        >
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Auto-refresh every (seconds):
            </label>
            <input
              type="number"
              bind:value={autoRefreshInterval}
              min="1"
              max="10"
              placeholder="Enter seconds"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag"
              onpointerdown={(e) => {
                e.stopPropagation();
              }}
              onpointerup={(e) => {
                e.stopPropagation();
              }}
            />
          </div>

          <button
            onpointerdown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleAutoRefresh();
            }}
            disabled={!autoRefreshInterval ||
              parseInt(autoRefreshInterval) <= 0}
            class="w-full px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed {isAutoRefreshEnabled
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'}"
          >
            {isAutoRefreshEnabled ? "Stop Auto-refresh" : "Start Auto-refresh"}
          </button>

          {#if isAutoRefreshEnabled}
            <p class="mt-2 text-xs text-green-600 font-medium">
              Auto-refreshing every {autoRefreshInterval}s
            </p>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Frame Content Area -->
  <div class="frame-content min-h-[200px] relative">
    {#if modelStatus}
      <div
        class="absolute top-2 right-2 bg-white rounded-lg shadow p-2 text-xs max-w-[200px]"
      >
        <div class="font-semibold text-gray-700 mb-1">Model Info</div>
        {#if modelStatus.model}
          <div class="space-y-0.5 text-gray-600">
            <div>Cloud: {modelStatus.model.cloud || "N/A"}</div>
            <div>Version: {modelStatus.model.version || "N/A"}</div>
            {#if modelStatus.applications}
              <div class="mt-1 font-medium">
                Apps: {Object.keys(modelStatus.applications).length}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#if isDragActive && !isDropTarget}
      <div class="text-center text-blue-500 text-sm mt-16 font-medium">
        Drop Charm Nodes here
      </div>
    {:else if isDropTarget}
      <div
        class="text-center text-green-600 text-lg mt-16 font-bold flex items-center justify-center animate-pulse"
      >
        <svg
          class="w-6 h-6 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
        Release to deploy charm
      </div>
    {/if}
  </div>
</div>

<style>
  .model-frame {
    position: relative;
  }

  .frame-content {
    pointer-events: none;
  }

  /* Allow child nodes to be interactive */
  .frame-content > * {
    pointer-events: auto;
  }
</style>
