<script setup>
import CustomSelect from './CustomSelect.vue'

defineProps({
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
  visibleLogsCount: {
    type: Number,
    default: 0
  },
  selectedTable: {
    type: String,
    default: ''
  },
  tablePage: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits([
  'toggleSelect',
  'chooseLogLevel',
  'update:logSearch',
  'copyVisibleLogs',
  'exportVisibleLogsCsv',
  'exportVisibleLogsJson',
  'clearLogs',
  'loadTablePage'
])
</script>

<template>
  <header class="services-title">
    <span>Services</span>
    <div class="window-actions">
      <CustomSelect
        compact
        align-right
        title="Log level"
        :options="logLevelOptions"
        :value="logLevelFilter"
        fallback="All"
        :open="openSelectId === 'logLevel'"
        @toggle="emit('toggleSelect', 'logLevel')"
        @choose="emit('chooseLogLevel', $event)"
      />
      <input
        :value="logSearch"
        class="log-search"
        placeholder="Search logs"
        data-native-context
        @input="emit('update:logSearch', $event.target.value)"
      >
      <button title="Copy visible logs" :disabled="!visibleLogsCount" @click="emit('copyVisibleLogs')">⧉</button>
      <button title="Export visible logs as CSV" :disabled="!visibleLogsCount" @click="emit('exportVisibleLogsCsv')">CSV</button>
      <button title="Export visible logs as JSON" :disabled="!visibleLogsCount" @click="emit('exportVisibleLogsJson')">JSON</button>
      <button title="Clear logs" @click="emit('clearLogs')">⌫</button>
      <button title="Refresh current table" :disabled="!selectedTable" @click="emit('loadTablePage', tablePage)">↻</button>
      <button>×</button>
    </div>
  </header>
</template>

<style scoped>
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

.log-search {
  width: 180px;
  min-height: 24px;
  padding: 3px 8px;
  color: var(--text);
  background: #1f2023;
  border: 1px solid var(--line);
  border-radius: 4px;
}
</style>
