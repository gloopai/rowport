<script setup>
defineProps({
  currentTab: {
    type: Object,
    default: null
  },
  selectedTable: {
    type: String,
    default: ''
  },
  selectedObject: {
    type: Object,
    default: () => ({profileId: '', database: '', table: ''})
  },
  structureTitle: {
    type: String,
    default: 'Structure'
  },
  structureColumns: {
    type: Array,
    default: () => []
  },
  structureRows: {
    type: Array,
    default: () => []
  },
  selectedDdl: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['insertDdlTemplate'])
</script>

<template>
  <div class="data-surface">
    <div class="filter-row">
      <span>{{ structureTitle }}</span>
      <button :disabled="!selectedTable" @click="emit('insertDdlTemplate', 'addColumn', selectedObject.database, selectedObject.table, selectedObject.profileId)">+ Column</button>
      <button :disabled="!selectedTable" @click="emit('insertDdlTemplate', 'createIndex', selectedObject.database, selectedObject.table, selectedObject.profileId)">+ Index</button>
      <button :disabled="!selectedTable" @click="emit('insertDdlTemplate', 'renameTable', selectedObject.database, selectedObject.table, selectedObject.profileId)">Rename</button>
      <button class="danger-inline" :disabled="!selectedTable" @click="emit('insertDdlTemplate', 'dropTable', selectedObject.database, selectedObject.table, selectedObject.profileId)">Drop</button>
      <div class="pager">
        <span>{{ structureRows.length }} items</span>
      </div>
    </div>

    <div class="grid-wrap">
      <pre v-if="currentTab?.objectType === 'ddl'" class="ddl-view">{{ selectedDdl || 'Loading DDL...' }}</pre>
      <table v-if="currentTab?.objectType !== 'ddl'" class="data-grid">
        <thead>
          <tr>
            <th class="row-num"></th>
            <th v-for="column in structureColumns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in structureRows" :key="rowIndex">
            <td class="row-num">{{ rowIndex + 1 }}</td>
            <td v-for="(value, cellIndex) in row" :key="cellIndex">{{ value || '<null>' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="floating-count">{{ currentTab?.objectType === 'ddl' ? 'DDL' : `${structureRows.length} items` }}</div>
  </div>
</template>

<style scoped>
.data-surface {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #1f2023;
}

.filter-row,
.pager {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-row {
  height: 31px;
  padding: 0 10px;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
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

.filter-row button {
  min-height: 23px;
  padding: 0 7px;
  color: #aeb8c7;
  background: #2d3035;
  border-color: #3e434a;
}

.filter-row .danger-inline {
  color: #ffb4aa;
}

.pager {
  margin-left: auto;
}

.grid-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.ddl-view {
  min-width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 16px;
  overflow: auto;
  color: #cfd7e6;
  background: #1f2023;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 22px;
  white-space: pre;
}

.data-grid {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 13px;
}

.data-grid th,
.data-grid td {
  min-width: 150px;
  max-width: 360px;
  height: 27px;
  padding: 4px 8px;
  overflow: hidden;
  color: #c8ccd2;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid #35383d;
  border-bottom: 1px solid #35383d;
}

.data-grid th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: #b9bdc5;
  font-weight: 600;
  background: #2b2d30;
}

.data-grid tbody tr:hover td {
  background: #262a30;
}

.row-num {
  min-width: 44px !important;
  width: 44px;
  color: #727884 !important;
  text-align: right !important;
  background: #24262a;
}

.floating-count {
  position: absolute;
  left: 50%;
  bottom: 12px;
  padding: 7px 12px;
  color: #c9ccd2;
  background: #34373c;
  border: 1px solid #4a4e55;
  border-radius: 8px;
  transform: translateX(-50%);
}
</style>
