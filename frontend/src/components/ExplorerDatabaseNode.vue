<script setup>
import ExplorerTableNode from './ExplorerTableNode.vue'

defineProps({
  profileId: {
    type: String,
    required: true
  },
  database: {
    type: Object,
    required: true
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
  },
  isExpanded: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['toggleExpanded', 'selectDatabase', 'toggleDatabase', 'toggleTables', 'selectTable', 'openTableContextMenu', 'selectTableObject'])
</script>

<template>
  <button
    class="tree-row database-node"
    :class="{
      selected: profileId === activeProfileId && database.name === selectedDatabase && !selectedTable,
      'active-parent': profileId === activeProfileId && database.name === selectedDatabase && selectedTable
    }"
    @click="emit('selectDatabase', profileId, database.name)"
  >
    <span class="tree-expander" @click.stop="emit('toggleDatabase', profileId, database.name)">{{
      isExpanded('database', profileId, database.name) ? '⌄' : '›'
    }}</span>
    <span class="tree-icon icon-database"></span>
    <span class="tree-label">{{ database.name }}</span>
  </button>

  <div v-if="isExpanded('database', profileId, database.name)" class="tree-children nested">
    <button class="tree-row muted-row" @click="emit('toggleTables', profileId, database.name)">
      <span class="tree-expander">{{ isExpanded('tables', profileId, database.name) ? '⌄' : '›' }}</span>
      <span class="tree-icon icon-folder"></span>
      <span class="tree-label">tables</span>
      <span class="tree-badge">{{ tableCount(profileId, database.name) }}</span>
    </button>
    <template v-if="isExpanded('tables', profileId, database.name)">
      <ExplorerTableNode
        v-for="table in tableList(profileId, database.name)"
        :key="table.name"
        :profile-id="profileId"
        :database-name="database.name"
        :table="table"
        :current-tab="currentTab"
        :table-metadata="tableMetadata"
        :metadata-key="metadataKey"
        :is-expanded="isExpanded"
        @toggle-expanded="(...args) => emit('toggleExpanded', ...args)"
        @select-table="(...args) => emit('selectTable', ...args)"
        @open-table-context-menu="(...args) => emit('openTableContextMenu', ...args)"
        @select-table-object="(...args) => emit('selectTableObject', ...args)"
      />
    </template>
  </div>
</template>
