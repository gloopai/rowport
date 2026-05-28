<script setup>
import {ref} from 'vue'

defineProps({
  servicesColumns: {
    type: String,
    default: '240px 6px minmax(0, 1fr)'
  },
  openSelectId: {
    type: String,
    default: ''
  },
  logLevelOptions: {
    type: Array,
    default: () => []
  },
  logLevelFilter: {
    type: String,
    default: 'all'
  },
  logSearch: {
    type: String,
    default: ''
  },
  visibleLogs: {
    type: Array,
    default: () => []
  },
  selectedTable: {
    type: String,
    default: ''
  },
  tablePage: {
    type: Number,
    default: 1
  },
  selectedProfile: {
    type: Object,
    default: null
  },
  optionLabel: {
    type: Function,
    required: true
  },
  logContextSummary: {
    type: Function,
    required: true
  },
  logSql: {
    type: Function,
    required: true
  },
  compactSql: {
    type: Function,
    required: true
  }
})

const emit = defineEmits([
  'resizeServices',
  'resetServices',
  'toggleSelect',
  'chooseLogLevel',
  'update:logSearch',
  'copyVisibleLogs',
  'exportVisibleLogsCsv',
  'exportVisibleLogsJson',
  'clearLogs',
  'loadTablePage',
  'resizeServicesTree',
  'resetServicesTree'
])

const consoleOutputRef = ref(null)

function scrollToBottom() {
  if (consoleOutputRef.value) {
    consoleOutputRef.value.scrollTop = consoleOutputRef.value.scrollHeight
  }
}

defineExpose({scrollToBottom})
</script>

<template>
  <section class="services">
    <div
      class="resize-handle horizontal services-resizer"
      title="Drag to resize Services"
      @mousedown="emit('resizeServices', $event)"
      @dblclick="emit('resetServices')"
    ></div>
    <header class="services-title">
      <span>Services</span>
      <div class="window-actions">
        <div class="custom-select compact" :class="{open: openSelectId === 'logLevel'}" @click.stop>
          <button class="custom-select-button" title="Log level" @click="emit('toggleSelect', 'logLevel')">
            <span>{{ optionLabel(logLevelOptions, logLevelFilter, 'All') }}</span>
            <span class="select-caret">⌄</span>
          </button>
          <div v-if="openSelectId === 'logLevel'" class="custom-select-menu align-right">
            <button
              v-for="option in logLevelOptions"
              :key="option.value"
              :class="{active: option.value === logLevelFilter}"
              @click="emit('chooseLogLevel', option.value)"
            >{{ option.label }}</button>
          </div>
        </div>
        <input
          :value="logSearch"
          class="log-search"
          placeholder="Search logs"
          data-native-context
          @input="emit('update:logSearch', $event.target.value)"
        >
        <button title="Copy visible logs" :disabled="!visibleLogs.length" @click="emit('copyVisibleLogs')">⧉</button>
        <button title="Export visible logs as CSV" :disabled="!visibleLogs.length" @click="emit('exportVisibleLogsCsv')">CSV</button>
        <button title="Export visible logs as JSON" :disabled="!visibleLogs.length" @click="emit('exportVisibleLogsJson')">JSON</button>
        <button title="Clear logs" @click="emit('clearLogs')">⌫</button>
        <button title="Refresh current table" :disabled="!selectedTable" @click="emit('loadTablePage', tablePage)">↻</button>
        <button>×</button>
      </div>
    </header>
    <div class="services-body" :style="{gridTemplateColumns: servicesColumns}">
      <aside class="services-tree">
        <div class="tree-row muted-row"><span class="folder-icon">▣</span><span>Database</span></div>
        <div class="tree-row selected"><span class="mysql-mark">⌁</span><span>{{ selectedProfile?.name || '@localhost' }}</span></div>
        <div v-if="selectedTable" class="tree-row nested-service"><span class="table-icon">▦</span><span>{{ selectedTable }}</span></div>
      </aside>
      <div
        class="resize-handle vertical services-tree-resizer"
        title="Drag to resize Services tree"
        @mousedown="emit('resizeServicesTree', $event)"
        @dblclick="emit('resetServicesTree')"
      ></div>
      <div ref="consoleOutputRef" class="console-output">
        <div v-if="!visibleLogs.length" class="log-empty">Console output</div>
        <div v-for="log in visibleLogs" :key="log.id" :class="['log-row', `level-${log.level}`]">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-level">{{ log.level }}</span>
          <span class="log-text">{{ log.text }}</span>
          <span v-if="logContextSummary(log.context)" class="log-context">{{ logContextSummary(log.context) }}</span>
          <pre v-if="logSql(log.context)" class="log-sql">{{ compactSql(logSql(log.context)) }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.services {
  position: relative;
  display: grid;
  grid-template-rows: 38px minmax(0, 1fr);
  min-height: 0;
  background: var(--panel-darker);
  border-top: 1px solid var(--line);
}

.resize-handle {
  position: relative;
  z-index: 4;
  background: var(--line);
  transition: background 120ms ease;
}

.resize-handle:hover,
.resize-handle:active {
  background: #4d8df7;
}

.resize-handle.vertical {
  width: 6px;
  min-width: 6px;
  cursor: col-resize;
}

.resize-handle.horizontal {
  height: 6px;
  min-height: 6px;
  cursor: row-resize;
}

.services-resizer {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 7px;
  background: transparent;
}

.services-resizer:hover,
.services-resizer:active {
  background: #4d8df7;
}

.services-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 37px;
  padding: 0 8px;
  color: #e0e2e6;
  font-weight: 700;
  user-select: none;
  border-bottom: 1px solid var(--line);
}

.window-actions {
  display: flex;
  align-items: center;
  gap: 4px;
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

.log-search {
  width: 180px;
  min-height: 24px;
  padding: 3px 8px;
  color: var(--text);
  background: #1f2023;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.services-body {
  display: grid;
  min-height: 0;
  overflow: hidden;
}

.services-tree-resizer {
  height: 100%;
  background: var(--line);
}

.services-tree {
  min-width: 0;
  overflow: auto;
  padding: 8px;
  background: var(--panel);
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

.muted-row {
  color: var(--muted);
}

.nested-service {
  margin-left: 24px;
}

.mysql-mark {
  color: #35a7e8;
}

.folder-icon {
  color: #67a8ff;
}

.table-icon {
  color: #b5c7dd;
}

.console-output {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: auto;
  color: #b9bdc5;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 20px;
  user-select: text;
}

.console-output * {
  user-select: text;
}

.log-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: #6f7580;
}

.log-row {
  display: grid;
  grid-template-columns: 72px 58px minmax(180px, 1fr) minmax(160px, 0.8fr);
  gap: 10px;
  min-width: 720px;
  padding: 3px 4px;
  border-radius: 3px;
}

.log-row:hover {
  background: #24282f;
}

.log-time {
  color: #777d87;
}

.log-level {
  color: #9aa3af;
  text-transform: uppercase;
}

.log-text {
  color: #d0d5dd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-context {
  color: #7d8490;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-sql {
  grid-column: 3 / 5;
  margin: -4px 0 4px;
  padding: 6px 8px;
  color: #a9d7ff;
  background: #191b20;
  border: 1px solid #343942;
  border-radius: 4px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.level-success .log-level {
  color: #74c476;
}

.level-warn .log-level {
  color: #d6a35f;
}

.level-error .log-level {
  color: #ff8f87;
}

.level-debug .log-level {
  color: #7f8da3;
}
</style>
