<script setup>
import CustomSelect from './CustomSelect.vue'

defineProps({
  busy: {
    type: Boolean,
    default: false
  },
  selectedProfile: {
    type: Object,
    default: null
  },
  activeConnection: {
    type: Object,
    default: () => ({status: {connected: false}})
  },
  openSelectId: {
    type: String,
    default: ''
  },
  databaseOptions: {
    type: Array,
    default: () => []
  },
  selectedDatabase: {
    type: String,
    default: ''
  },
  selectedTable: {
    type: String,
    default: ''
  },
  tablePage: {
    type: Number,
    default: 1
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
  tableReadOnly: {
    type: Boolean,
    default: false
  },
  activeProfileId: {
    type: String,
    default: ''
  },
  pageSizeOptions: {
    type: Array,
    default: () => []
  },
  pageSize: {
    type: Number,
    default: 50
  }
})

const emit = defineEmits([
  'runOrConnect',
  'disconnect',
  'editProfile',
  'toggleSelect',
  'chooseDatabase',
  'loadTablePage',
  'openInsertRow',
  'editSelectedRow',
  'deleteSelectedRow',
  'selectTableObject',
  'choosePageSize'
])
</script>

<template>
  <div class="main-toolbar">
    <button class="run-button" :disabled="busy || !selectedProfile" @click="emit('runOrConnect')">▶</button>
    <button :disabled="!activeConnection.status.connected" @click="emit('disconnect')">■</button>
    <button :disabled="!selectedProfile" @click="emit('editProfile', selectedProfile)">⚙</button>
    <span class="toolbar-separator"></span>
    <CustomSelect
      :options="databaseOptions"
      :value="selectedDatabase"
      fallback="Database"
      :open="openSelectId === 'database'"
      :disabled="!activeConnection.status.connected"
      @toggle="emit('toggleSelect', 'database')"
      @choose="emit('chooseDatabase', $event)"
    />
    <span class="toolbar-mode">Tx: Auto</span>
    <button :disabled="!selectedTable" @click="emit('loadTablePage', tablePage)">↻</button>
    <button :disabled="!selectedTable || tableReadOnly" :title="tableReadOnly ? '无主键表为只读' : '新增行'" @click="emit('openInsertRow')">+</button>
    <span v-if="tableReadOnly" class="readonly-chip" title="该表没有主键，无法安全定位单行，已设为只读">无主键 · 只读</span>
    <template v-if="selectedRow">
      <span class="selection-chip">已选 {{ selectedRowsCount }} 行</span>
      <button class="icon-tool" title="编辑选中行" :disabled="!canEditSelectedRow" @click="emit('editSelectedRow')">✎</button>
      <button class="icon-tool danger-tool" title="删除选中行" :disabled="!canDeleteSelectedRow" @click="emit('deleteSelectedRow')">⌫</button>
    </template>
    <button :disabled="!selectedTable" @click="emit('selectTableObject', 'ddl', selectedTable, selectedDatabase, activeProfileId)">DDL</button>
    <div class="toolbar-fill"></div>
    <CustomSelect
      compact
      align-right
      :options="pageSizeOptions"
      :value="pageSize"
      fallback="50 rows"
      :open="openSelectId === 'pageSize'"
      @toggle="emit('toggleSelect', 'pageSize')"
      @choose="emit('choosePageSize', $event)"
    />
  </div>
</template>

<style scoped>
.main-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  padding: 0 8px;
  user-select: none;
  background: var(--panel);
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

.run-button {
  color: var(--green);
}

.toolbar-separator {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line);
}

.toolbar-fill {
  flex: 1;
}

.toolbar-mode {
  color: var(--muted);
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

.readonly-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 7px;
  color: #e0c08a;
  cursor: default;
  background: #3a3326;
  border: 1px solid #6b5a36;
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

</style>
