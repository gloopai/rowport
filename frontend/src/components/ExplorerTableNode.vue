<script setup>
import ExplorerTableObjects from './ExplorerTableObjects.vue'

defineProps({
  profileId: {
    type: String,
    required: true
  },
  databaseName: {
    type: String,
    required: true
  },
  table: {
    type: Object,
    required: true
  },
  currentTab: {
    type: Object,
    default: null
  },
  tableMetadata: {
    type: Object,
    default: () => ({})
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

const emit = defineEmits(['toggleExpanded', 'selectTable', 'openTableContextMenu', 'selectTableObject'])

function isSelectedTable(profileId, databaseName, tableName, currentTab) {
  return currentTab?.profileId === profileId &&
    currentTab?.kind === 'data' &&
    currentTab.table === tableName &&
    currentTab.database === databaseName
}

function isActiveStructureParent(profileId, databaseName, tableName, currentTab) {
  return currentTab?.profileId === profileId &&
    currentTab?.kind === 'structure' &&
    currentTab.table === tableName &&
    currentTab.database === databaseName
}
</script>

<template>
  <div>
    <button
      class="tree-row table-node"
      :class="{
        selected: isSelectedTable(profileId, databaseName, table.name, currentTab),
        'active-parent': isActiveStructureParent(profileId, databaseName, table.name, currentTab)
      }"
      @click="emit('selectTable', table, databaseName, profileId)"
      @contextmenu.prevent="emit('openTableContextMenu', profileId, databaseName, table.name, $event)"
    >
      <span class="tree-expander" @click.stop="emit('toggleExpanded', 'table', profileId, databaseName, table.name)">{{ isExpanded('table', profileId, databaseName, table.name) ? '⌄' : '›' }}</span>
      <span class="tree-icon icon-table"></span>
      <span class="tree-label">{{ table.name }}</span>
    </button>

    <ExplorerTableObjects
      v-if="isExpanded('table', profileId, databaseName, table.name)"
      :profile-id="profileId"
      :database-name="databaseName"
      :table-name="table.name"
      :current-tab="currentTab"
      :table-metadata="tableMetadata"
      :metadata-key="metadataKey"
      :is-expanded="isExpanded"
      @toggle-expanded="(...args) => emit('toggleExpanded', ...args)"
      @select-table-object="(...args) => emit('selectTableObject', ...args)"
    />
  </div>
</template>
