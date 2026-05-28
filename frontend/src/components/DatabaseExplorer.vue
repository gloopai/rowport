<script setup>
import ExplorerProfileNode from './ExplorerProfileNode.vue'

defineProps({
  profiles: {
    type: Array,
    default: () => []
  },
  busy: {
    type: Boolean,
    default: false
  },
  selectedProfile: {
    type: Object,
    default: null
  },
  selectedProfileId: {
    type: String,
    default: ''
  },
  activeProfileId: {
    type: String,
    default: ''
  },
  activeConnection: {
    type: Object,
    default: () => ({status: {connected: false}})
  },
  selectedDatabase: {
    type: String,
    default: ''
  },
  selectedTable: {
    type: String,
    default: ''
  },
  currentTab: {
    type: Object,
    default: null
  },
  tableMetadata: {
    type: Object,
    default: () => ({})
  },
  isProfileConnected: {
    type: Function,
    required: true
  },
  isExpanded: {
    type: Function,
    required: true
  },
  getConnectionState: {
    type: Function,
    required: true
  },
  tableCount: {
    type: Function,
    required: true
  },
  tableList: {
    type: Function,
    required: true
  },
  metadataKey: {
    type: Function,
    required: true
  }
})

const emit = defineEmits([
  'newProfile',
  'refreshTables',
  'editProfile',
  'connect',
  'disconnect',
  'removeProfile',
  'openConsole',
  'openData',
  'selectProfile',
  'toggleExpanded',
  'selectDatabase',
  'toggleDatabase',
  'toggleTables',
  'selectTable',
  'openTableContextMenu',
  'selectTableObject'
])
</script>

<template>
  <aside class="explorer">
    <header class="tool-window-title">
      <span>Database Explorer</span>
      <div class="window-actions">
        <button title="Add" @click="emit('newProfile')">+</button>
        <button title="Refresh" :disabled="!activeConnection.status.connected" @click="emit('refreshTables', activeProfileId, selectedDatabase, true)">↻</button>
        <button title="Edit" :disabled="!selectedProfile" @click="emit('editProfile', selectedProfile)">⚙</button>
      </div>
    </header>

    <div class="explorer-toolbar">
      <button title="Connect" :disabled="busy || !selectedProfile" @click="emit('connect')">▶</button>
      <button title="Disconnect" :disabled="!activeConnection.status.connected" @click="emit('disconnect')">■</button>
      <button title="Delete" :disabled="!selectedProfile" @click="emit('removeProfile', selectedProfile)">−</button>
      <span class="toolbar-separator"></span>
      <button title="Open SQL" @click="emit('openConsole')">SQL</button>
      <button title="View Data" :disabled="!selectedTable" @click="emit('openData', activeProfileId, selectedDatabase, selectedTable)">▦</button>
    </div>

    <div class="tree-scroll">
      <ExplorerProfileNode
        v-for="profile in profiles"
        :key="profile.id"
        :profile="profile"
        :selected-profile-id="selectedProfileId"
        :active-profile-id="activeProfileId"
        :selected-database="selectedDatabase"
        :selected-table="selectedTable"
        :current-tab="currentTab"
        :table-metadata="tableMetadata"
        :is-profile-connected="isProfileConnected"
        :is-expanded="isExpanded"
        :get-connection-state="getConnectionState"
        :table-count="tableCount"
        :table-list="tableList"
        :metadata-key="metadataKey"
        @connect="emit('connect')"
        @toggle-expanded="(...args) => emit('toggleExpanded', ...args)"
        @select-profile="(...args) => emit('selectProfile', ...args)"
        @select-database="(...args) => emit('selectDatabase', ...args)"
        @toggle-database="(...args) => emit('toggleDatabase', ...args)"
        @toggle-tables="(...args) => emit('toggleTables', ...args)"
        @select-table="(...args) => emit('selectTable', ...args)"
        @open-table-context-menu="(...args) => emit('openTableContextMenu', ...args)"
        @select-table-object="(...args) => emit('selectTableObject', ...args)"
      />
    </div>
  </aside>
</template>

<style scoped>
.explorer {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  user-select: none;
  background: var(--panel);
  border-right: 1px solid #151619;
}

button {
  min-height: 24px;
  padding: 0 8px;
  color: var(--text);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

button:hover:not(:disabled) {
  background: #373a3f;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.tool-window-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 37px;
  padding: 0 8px;
  color: #e0e2e6;
  font-weight: 700;
  border-bottom: 1px solid var(--line);
}

.window-actions,
.explorer-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.explorer-toolbar {
  height: 34px;
  padding: 0 8px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}

.toolbar-separator {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line);
}

.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 8px 12px;
}
</style>
