<script setup>
import {ref} from 'vue'
import CustomSelect from './CustomSelect.vue'

defineProps({
  tableWhere: {
    type: String,
    default: ''
  },
  selectedTable: {
    type: String,
    default: ''
  },
  tableData: {
    type: Object,
    default: () => ({columns: [], rows: [], total: 0, page: 1, pageSize: 50})
  },
  openSelectId: {
    type: String,
    default: ''
  },
  orderByOptions: {
    type: Array,
    default: () => []
  },
  tableOrderBy: {
    type: String,
    default: ''
  },
  orderDirOptions: {
    type: Array,
    default: () => []
  },
  tableOrderDir: {
    type: String,
    default: 'ASC'
  },
  selectedRow: {
    type: Object,
    default: null
  },
  selectedRowsCount: {
    type: Number,
    default: 0
  },
  canEditSelectedRow: {
    type: Boolean,
    default: false
  },
  canDeleteSelectedRow: {
    type: Boolean,
    default: false
  },
  totalPages: {
    type: Number,
    default: 1
  },
  virtualDataRows: {
    type: Object,
    default: () => ({items: []})
  },
  dataTopSpacerHeight: {
    type: Number,
    default: 0
  },
  dataBottomSpacerHeight: {
    type: Number,
    default: 0
  },
  dataGridColspan: {
    type: Number,
    default: 1
  },
  canMutateRows: {
    type: Boolean,
    default: false
  },
  columnWidth: {
    type: Function,
    required: true
  },
  isSelectedDataRow: {
    type: Function,
    required: true
  }
})

const emit = defineEmits([
  'update:tableWhere',
  'clearSelection',
  'openFilterDialog',
  'toggleSelect',
  'chooseOrderBy',
  'chooseOrderDir',
  'applyFilter',
  'clearFilter',
  'openInsertRow',
  'openCsvImportPreview',
  'editSelectedRow',
  'deleteSelectedRow',
  'copySelectedRow',
  'copyVisibleRows',
  'exportVisibleCsv',
  'exportVisibleJson',
  'loadTablePage',
  'scroll',
  'beginColumnResize',
  'selectDataRow',
  'openEditRow',
  'deleteRow'
])

const dataGridRef = ref(null)

function scrollToTop() {
  if (dataGridRef.value) dataGridRef.value.scrollTop = 0
}

defineExpose({scrollToTop})
</script>

<template>
  <div class="data-surface" @click="emit('clearSelection')">
    <div class="filter-row" @click.stop>
      <span>⌁ WHERE</span>
      <input
        class="inline-filter"
        :value="tableWhere"
        placeholder="e.g. id > 10"
        data-native-context
        @input="emit('update:tableWhere', $event.target.value)"
      >
      <button :disabled="!selectedTable || !tableData.columns.length" @click="emit('openFilterDialog')">Filter</button>
      <span>≡ ORDER BY</span>
      <CustomSelect
        :options="orderByOptions"
        :value="tableOrderBy"
        fallback="none"
        :open="openSelectId === 'orderBy'"
        @toggle="emit('toggleSelect', 'orderBy')"
        @choose="emit('chooseOrderBy', $event)"
      />
      <CustomSelect
        compact
        :options="orderDirOptions"
        :value="tableOrderDir"
        fallback="ASC"
        :open="openSelectId === 'orderDir'"
        :disabled="!tableOrderBy"
        @toggle="emit('toggleSelect', 'orderDir')"
        @choose="emit('chooseOrderDir', $event)"
      />
      <button @click="emit('applyFilter')">Apply</button>
      <button @click="emit('clearFilter')">Clear</button>
      <button :disabled="!selectedTable" @click="emit('openInsertRow')">+ Row</button>
      <button :disabled="!selectedTable" @click="emit('openCsvImportPreview')">Import CSV</button>
      <template v-if="selectedRow">
        <span class="selection-chip">已选 {{ selectedRowsCount }} 行</span>
        <button class="icon-tool" title="编辑选中行" :disabled="!canEditSelectedRow" @click="emit('editSelectedRow')">✎</button>
        <button class="icon-tool danger-tool" title="删除选中行" :disabled="!canDeleteSelectedRow" @click="emit('deleteSelectedRow')">⌫</button>
        <button class="icon-tool" title="复制选中行" @click="emit('copySelectedRow')">⧉</button>
      </template>
      <button title="复制当前页" :disabled="!tableData.rows?.length" @click="emit('copyVisibleRows')">Copy</button>
      <button title="导出当前页 CSV" :disabled="!tableData.rows?.length" @click="emit('exportVisibleCsv')">CSV</button>
      <button title="导出当前页 JSON" :disabled="!tableData.rows?.length" @click="emit('exportVisibleJson')">JSON</button>
      <div class="pager">
        <button :disabled="tableData.page <= 1" @click="emit('loadTablePage', tableData.page - 1)">‹</button>
        <span>{{ tableData.page }} / {{ totalPages }}</span>
        <button :disabled="tableData.page >= totalPages" @click="emit('loadTablePage', tableData.page + 1)">›</button>
      </div>
    </div>

    <div ref="dataGridRef" class="grid-wrap" @scroll="emit('scroll', $event)">
      <table v-if="tableData.columns.length" class="data-grid" @click.stop>
        <thead>
          <tr>
            <th class="row-num"></th>
            <th v-for="column in tableData.columns" :key="column.name" :style="{width: `${columnWidth(column.name)}px`, minWidth: `${columnWidth(column.name)}px`}">
              <span class="col-name" :style="{width: `${columnWidth(column.name)}px`}">{{ column.name }}</span>
              <span class="filter-mark">▽</span>
              <span class="column-resizer" @mousedown="emit('beginColumnResize', column.name, $event)"></span>
            </th>
            <th class="actions-col">actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="dataTopSpacerHeight" class="virtual-spacer-row">
            <td :colspan="dataGridColspan" :style="{height: `${dataTopSpacerHeight}px`}"></td>
          </tr>
          <tr
            v-for="item in virtualDataRows.items"
            :key="item.index"
            :class="{'selected-row': isSelectedDataRow(item.index)}"
            @click="emit('selectDataRow', item.index)"
            @dblclick="emit('openEditRow', item.row)"
          >
            <td class="row-num">{{ (tableData.page - 1) * tableData.pageSize + item.index + 1 }}</td>
            <td v-for="column in tableData.columns" :key="column.name" :style="{width: `${columnWidth(column.name)}px`, minWidth: `${columnWidth(column.name)}px`}">{{ item.row[column.name] ?? '<null>' }}</td>
            <td class="row-actions">
              <button :disabled="!canMutateRows" @click.stop="emit('openEditRow', item.row)">Edit</button>
              <button :disabled="!canMutateRows" @click.stop="emit('deleteRow', item.row)">Delete</button>
            </td>
          </tr>
          <tr v-if="dataBottomSpacerHeight" class="virtual-spacer-row">
            <td :colspan="dataGridColspan" :style="{height: `${dataBottomSpacerHeight}px`}"></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">Connect and select a table from Database Explorer.</div>
    </div>

    <div class="floating-count">{{ tableData.rows?.length || 0 }} rows · {{ tableData.total || 0 }} total</div>
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
.pager,
.row-actions {
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

.inline-filter {
  width: min(260px, 24vw);
  min-height: 24px;
  padding: 3px 8px;
  color: var(--text);
  background: #1f2023;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.selection-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 7px;
  color: #b9c7dc;
  background: #303641;
  border: 1px solid #465066;
  border-radius: 4px;
}

.icon-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  min-width: 26px;
  padding: 0;
  color: #cfd7e6;
  background: #303338;
  border-color: var(--line);
}

.icon-tool:hover:not(:disabled) {
  color: #ffffff;
  background: #3c4656;
}

.danger-tool {
  color: #ffb4aa;
  background: rgba(244, 87, 82, 0.12);
  border-color: rgba(244, 87, 82, 0.34);
}

.danger-tool:hover:not(:disabled) {
  color: #ffffff;
  background: rgba(244, 87, 82, 0.28);
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

.column-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
}

.column-resizer:hover {
  background: #4d8df7;
}

.data-grid tbody tr:hover td {
  background: #262a30;
}

.data-grid tbody tr.selected-row td {
  color: #eef3ff;
  background: #28364b;
}

.data-grid tbody tr.selected-row:hover td {
  background: #30415b;
}

.data-grid .virtual-spacer-row td {
  height: auto;
  min-width: 0;
  max-width: none;
  padding: 0;
  background: #1f2023;
  border-right: 0;
  border-bottom: 0;
}

.data-grid .virtual-spacer-row:hover td {
  background: #1f2023;
}

.row-num {
  min-width: 44px !important;
  width: 44px;
  color: #727884 !important;
  text-align: right !important;
  background: #24262a;
}

.col-name {
  color: #d0d4dc;
}

.filter-mark {
  float: right;
  color: #858b95;
}

.actions-col {
  min-width: 130px !important;
}

.row-actions button {
  min-height: 21px;
  padding: 0 6px;
  color: #9dbbff;
}

.empty-state {
  display: grid;
  place-items: center;
  height: 100%;
  color: #6f7580;
}

.floating-count {
  position: absolute;
  right: 14px;
  bottom: 12px;
  z-index: 2;
  padding: 4px 8px;
  color: #8c929c;
  font-size: 11px;
  pointer-events: none;
  background: rgba(31, 32, 35, 0.86);
  border: 1px solid #35383d;
  border-radius: 4px;
}
</style>
