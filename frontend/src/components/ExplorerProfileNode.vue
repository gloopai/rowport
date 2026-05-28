<script setup>
import ExplorerDatabaseNode from './ExplorerDatabaseNode.vue'

defineProps({
  profile: {
    type: Object,
    required: true
  },
  selectedProfileId: {
    type: String,
    default: ''
  },
  activeProfileId: {
    type: String,
    default: ''
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
  'connect',
  'toggleExpanded',
  'selectProfile',
  'selectDatabase',
  'toggleDatabase',
  'toggleTables',
  'selectTable',
  'openTableContextMenu',
  'selectTableObject'
])
</script>

<template>
  <div class="tree-group">
    <button
      class="tree-row server-row"
      :class="{selected: profile.id === selectedProfileId, connected: isProfileConnected(profile)}"
      @click="emit('selectProfile', profile)"
      @dblclick="emit('connect')"
    >
      <span class="tree-expander" @click.stop="emit('toggleExpanded', 'server', profile.id)">{{ isExpanded('server', profile.id) ? '⌄' : '›' }}</span>
      <span class="tree-icon icon-server"></span>
      <span class="tree-label">{{ profile.name }}</span>
      <span v-if="isProfileConnected(profile)" class="status-dot"></span>
      <span class="tree-badge">{{ profile.ssh.enabled ? 'SSH' : profile.host }}</span>
    </button>

    <div v-if="isExpanded('server', profile.id)" class="tree-children">
      <template v-if="isProfileConnected(profile)">
        <ExplorerDatabaseNode
          v-for="database in getConnectionState(profile.id).databases"
          :key="database.name"
          :profile-id="profile.id"
          :database="database"
          :active-profile-id="activeProfileId"
          :selected-database="selectedDatabase"
          :selected-table="selectedTable"
          :current-tab="currentTab"
          :table-metadata="tableMetadata"
          :table-count="tableCount"
          :table-list="tableList"
          :metadata-key="metadataKey"
          :is-expanded="isExpanded"
          @toggle-expanded="(...args) => emit('toggleExpanded', ...args)"
          @select-database="(...args) => emit('selectDatabase', ...args)"
          @toggle-database="(...args) => emit('toggleDatabase', ...args)"
          @toggle-tables="(...args) => emit('toggleTables', ...args)"
          @select-table="(...args) => emit('selectTable', ...args)"
          @open-table-context-menu="(...args) => emit('openTableContextMenu', ...args)"
          @select-table-object="(...args) => emit('selectTableObject', ...args)"
        />
      </template>
      <div v-else class="tree-row muted-row server-empty">
        <span class="tree-spacer"></span>
        <span class="tree-icon icon-disconnected"></span>
        <span class="tree-label">Not connected</span>
      </div>
    </div>
  </div>
</template>
