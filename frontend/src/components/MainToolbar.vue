<script setup>
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
  },
  optionLabel: {
    type: Function,
    required: true
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
    <div class="custom-select" :class="{open: openSelectId === 'database', disabled: !activeConnection.status.connected}" @click.stop>
      <button class="custom-select-button" :disabled="!activeConnection.status.connected" @click="emit('toggleSelect', 'database')">
        <span>{{ optionLabel(databaseOptions, selectedDatabase, 'Database') }}</span>
        <span class="select-caret">⌄</span>
      </button>
      <div v-if="openSelectId === 'database'" class="custom-select-menu">
        <button
          v-for="option in databaseOptions"
          :key="option.value || 'empty'"
          :class="{active: option.value === selectedDatabase}"
          @click="emit('chooseDatabase', option.value)"
        >{{ option.label }}</button>
      </div>
    </div>
    <span class="toolbar-mode">Tx: Auto</span>
    <button :disabled="!selectedTable" @click="emit('loadTablePage', tablePage)">↻</button>
    <button :disabled="!selectedTable" @click="emit('openInsertRow')">+</button>
    <template v-if="selectedRow">
      <span class="selection-chip">已选 {{ selectedRowsCount }} 行</span>
      <button class="icon-tool" title="编辑选中行" :disabled="!canEditSelectedRow" @click="emit('editSelectedRow')">✎</button>
      <button class="icon-tool danger-tool" title="删除选中行" :disabled="!canDeleteSelectedRow" @click="emit('deleteSelectedRow')">⌫</button>
    </template>
    <button :disabled="!selectedTable" @click="emit('selectTableObject', 'ddl', selectedTable, selectedDatabase, activeProfileId)">DDL</button>
    <div class="toolbar-fill"></div>
    <div class="custom-select compact" :class="{open: openSelectId === 'pageSize'}" @click.stop>
      <button class="custom-select-button" @click="emit('toggleSelect', 'pageSize')">
        <span>{{ optionLabel(pageSizeOptions, pageSize, '50 rows') }}</span>
        <span class="select-caret">⌄</span>
      </button>
      <div v-if="openSelectId === 'pageSize'" class="custom-select-menu align-right">
        <button
          v-for="option in pageSizeOptions"
          :key="option.value"
          :class="{active: option.value === pageSize}"
          @click="emit('choosePageSize', option.value)"
        >{{ option.label }}</button>
      </div>
    </div>
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

.custom-select {
  position: relative;
  min-width: 140px;
}

.custom-select.compact {
  min-width: 92px;
}

.custom-select-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 25px;
  padding: 0 7px 0 9px;
  color: var(--text);
  background: #303338;
  border: 1px solid var(--line);
  border-radius: 5px;
}

.custom-select-button span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-select.open .custom-select-button {
  border-color: #4d8df7;
  box-shadow: 0 0 0 1px rgba(77, 141, 247, 0.25);
}

.custom-select.disabled {
  opacity: 0.48;
}

.select-caret {
  color: var(--muted);
  font-size: 12px;
}

.custom-select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  width: max(100%, 180px);
  max-height: 260px;
  overflow: auto;
  padding: 4px;
  background: #2b2d30;
  border: 1px solid #4a4e55;
  border-radius: 6px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.45);
}

.custom-select-menu.align-right {
  right: 0;
  left: auto;
}

.custom-select-menu button {
  display: block;
  width: 100%;
  min-height: 25px;
  padding: 0 8px;
  color: #cbd1db;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-select-menu button.active {
  color: #ffffff;
  background: #41506a;
}
</style>
