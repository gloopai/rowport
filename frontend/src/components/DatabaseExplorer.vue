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

.tree-group {
  margin-bottom: 2px;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-width: 0;
  height: 25px;
  padding: 0 7px 0 4px;
  color: var(--text);
  text-align: left;
  white-space: nowrap;
  border-radius: 4px;
}

.tree-row.selected {
  color: #edf1f7;
  background: #454a52;
}

.tree-row.active-parent {
  color: #d8dce3;
  background: rgba(69, 74, 82, 0.42);
}

.tree-row:hover {
  background: #383b40;
}

.tree-row.connected .tree-label {
  color: #e0e4ea;
  font-weight: 650;
}

.tree-children {
  margin-left: 14px;
  padding-left: 8px;
  border-left: 1px solid rgba(93, 99, 110, 0.28);
}

.tree-children.nested,
.tree-children.table-objects,
.tree-children.leaf-list {
  margin-left: 17px;
}

.tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-row .tree-label,
.database-node .tree-label,
.table-node .tree-label,
.object-folder .tree-label {
  flex: 1;
}

.tree-badge {
  margin-left: auto;
  padding: 1px 5px;
  color: var(--muted);
  font-size: 11px;
  background: #373a3f;
  border-radius: 4px;
}

.tree-detail {
  margin-left: 6px;
  color: #747a84;
  font-size: 12px;
}

.tree-expander,
.tree-spacer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
  width: 16px;
  height: 20px;
  color: #8b9099;
  font-size: 14px;
  border-radius: 4px;
}

.tree-expander:hover {
  color: #d8dce3;
  background: rgba(255, 255, 255, 0.08);
}

.tree-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
}

.icon-server::before {
  content: "";
  width: 12px;
  height: 12px;
  border: 1px solid #35a7e8;
  border-radius: 3px;
  box-shadow: inset 0 -3px 0 rgba(53, 167, 232, 0.28);
}

.icon-database::before {
  content: "";
  width: 12px;
  height: 14px;
  border: 1px solid #36a3ff;
  border-radius: 50% / 18%;
  box-shadow: inset 0 3px 0 rgba(54, 163, 255, 0.25);
}

.icon-folder::before {
  content: "";
  width: 13px;
  height: 10px;
  margin-top: 2px;
  border: 1px solid #67a8ff;
  border-radius: 2px;
  background: rgba(103, 168, 255, 0.08);
}

.icon-folder::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 6px;
  height: 3px;
  border: 1px solid #67a8ff;
  border-bottom: 0;
  border-radius: 2px 2px 0 0;
}

.icon-table::before {
  content: "";
  width: 13px;
  height: 13px;
  border: 1px solid #b5c7dd;
  border-radius: 2px;
  background:
    linear-gradient(#b5c7dd, #b5c7dd) 0 4px / 100% 1px no-repeat,
    linear-gradient(#b5c7dd, #b5c7dd) 0 8px / 100% 1px no-repeat,
    linear-gradient(#b5c7dd, #b5c7dd) 4px 0 / 1px 100% no-repeat;
}

.icon-column::before {
  content: "";
  width: 11px;
  height: 13px;
  border: 1px solid #82aaff;
  border-radius: 2px;
}

.icon-column.primary::after,
.icon-key::before {
  content: "";
  width: 11px;
  height: 11px;
  border: 1px solid #e5c463;
  border-radius: 50%;
}

.icon-column.primary::after {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 5px;
  height: 5px;
  background: #e5c463;
}

.icon-index::before {
  content: "i";
  color: #8ab4ff;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
}

.icon-disconnected::before {
  content: "";
  width: 8px;
  height: 8px;
  border: 1px solid #858b95;
  border-radius: 50%;
}

.status-dot {
  width: 7px;
  height: 7px;
  margin-left: auto;
  background: var(--green);
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(77, 179, 99, 0.16);
}

.server-row .tree-badge {
  margin-left: 0;
}

.server-empty,
.muted-row {
  color: var(--muted);
}

.leaf-row {
  color: #cfd3da;
}
</style>
