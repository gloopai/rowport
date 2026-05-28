<script setup>
import {ref} from 'vue'
import OperationLogList from './OperationLogList.vue'
import ServicesHeader from './ServicesHeader.vue'
import ServicesTree from './ServicesTree.vue'

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

const operationLogListRef = ref(null)

function scrollToBottom() {
  operationLogListRef.value?.scrollToBottom()
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
    <ServicesHeader
      :open-select-id="openSelectId"
      :log-level-options="logLevelOptions"
      :log-level-filter="logLevelFilter"
      :log-search="logSearch"
      :visible-logs-count="visibleLogs.length"
      :selected-table="selectedTable"
      :table-page="tablePage"
      @toggle-select="emit('toggleSelect', $event)"
      @choose-log-level="emit('chooseLogLevel', $event)"
      @update:log-search="emit('update:logSearch', $event)"
      @copy-visible-logs="emit('copyVisibleLogs')"
      @export-visible-logs-csv="emit('exportVisibleLogsCsv')"
      @export-visible-logs-json="emit('exportVisibleLogsJson')"
      @clear-logs="emit('clearLogs')"
      @load-table-page="emit('loadTablePage', $event)"
    />
    <div class="services-body" :style="{gridTemplateColumns: servicesColumns}">
      <ServicesTree
        :selected-profile="selectedProfile"
        :selected-table="selectedTable"
      />
      <div
        class="resize-handle vertical services-tree-resizer"
        title="Drag to resize Services tree"
        @mousedown="emit('resizeServicesTree', $event)"
        @dblclick="emit('resetServicesTree')"
      ></div>
      <OperationLogList
        ref="operationLogListRef"
        :visible-logs="visibleLogs"
        :log-context-summary="logContextSummary"
        :log-sql="logSql"
        :compact-sql="compactSql"
      />
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

.services-body {
  display: grid;
  min-height: 0;
  overflow: hidden;
}

.services-tree-resizer {
  height: 100%;
  background: var(--line);
}
</style>
