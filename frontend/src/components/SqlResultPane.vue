<script setup>
import {ref} from 'vue'

defineProps({
  resultTabs: {
    type: Array,
    default: () => []
  },
  activeResultTabId: {
    type: String,
    default: ''
  },
  activeResultTab: {
    type: Object,
    default: null
  },
  virtualResultRows: {
    type: Object,
    default: () => ({items: []})
  },
  resultTopSpacerHeight: {
    type: Number,
    default: 0
  },
  resultBottomSpacerHeight: {
    type: Number,
    default: 0
  },
  resultGridColspan: {
    type: Number,
    default: 1
  },
  compactSql: {
    type: Function,
    required: true
  }
})

const emit = defineEmits([
  'activateTab',
  'closeTab',
  'copyRows',
  'exportCsv',
  'exportJson',
  'openRowDetail',
  'scroll'
])

const resultGridRef = ref(null)

function scrollToTop() {
  if (resultGridRef.value) resultGridRef.value.scrollTop = 0
}

defineExpose({scrollToTop})
</script>

<template>
  <div class="query-result">
    <div class="result-toolbar">
      <div class="result-tabs">
        <button
          v-for="tab in resultTabs"
          :key="tab.id"
          :class="{active: tab.id === activeResultTabId}"
          :title="compactSql(tab.sql)"
          @click="emit('activateTab', tab.id)"
        >
          <span>{{ tab.title }}</span>
          <span class="tab-close" @click.stop="emit('closeTab', tab.id)">×</span>
        </button>
        <span v-if="!resultTabs.length" class="result-placeholder">Result</span>
      </div>
      <div class="result-actions">
        <span>{{ activeResultTab?.message || 'Ready' }}</span>
        <span>{{ activeResultTab?.elapsedMs || 0 }} ms</span>
        <button :disabled="!activeResultTab?.columns?.length" @click="emit('copyRows')">Copy</button>
        <button :disabled="!activeResultTab?.columns?.length" @click="emit('exportCsv')">CSV</button>
        <button :disabled="!activeResultTab?.columns?.length" @click="emit('exportJson')">JSON</button>
      </div>
    </div>
    <div ref="resultGridRef" class="grid-wrap" @scroll="emit('scroll', $event)">
      <table v-if="activeResultTab?.columns?.length" class="data-grid">
        <thead>
          <tr>
            <th class="row-num"></th>
            <th v-for="column in activeResultTab.columns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="resultTopSpacerHeight" class="virtual-spacer-row">
            <td :colspan="resultGridColspan" :style="{height: `${resultTopSpacerHeight}px`}"></td>
          </tr>
          <tr v-for="item in virtualResultRows.items" :key="item.index" @dblclick="emit('openRowDetail', item.row, item.index)">
            <td class="row-num">{{ item.index + 1 }}</td>
            <td v-for="(value, cellIndex) in item.row" :key="cellIndex">{{ value ?? '<null>' }}</td>
          </tr>
          <tr v-if="resultBottomSpacerHeight" class="virtual-spacer-row">
            <td :colspan="resultGridColspan" :style="{height: `${resultBottomSpacerHeight}px`}"></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">Run SQL to view results.</div>
    </div>
  </div>
</template>

<style scoped>
.query-result {
  display: grid;
  grid-template-rows: 31px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  background: #1f2023;
}

.result-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 8px;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}

.result-tabs,
.result-actions {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
}

.result-tabs {
  flex: 1;
  overflow: hidden;
}

.result-tabs button {
  display: inline-flex;
  align-items: center;
  max-width: 170px;
  height: 25px;
  min-height: 25px;
  padding: 0 6px 0 9px;
  color: #9fa6b2;
  background: transparent;
  border-color: transparent;
}

.result-tabs button.active {
  color: #eef2f8;
  background: #343840;
  border-color: #454b55;
}

.result-tabs button > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-placeholder {
  color: var(--text);
  font-weight: 700;
}

.result-actions {
  flex: 0 0 auto;
  color: #858b95;
}

.result-actions button {
  min-height: 23px;
  padding: 0 7px;
  color: #aeb8c7;
  background: #2d3035;
  border-color: #3e434a;
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

.data-grid tbody tr:hover td {
  background: #262a30;
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

.empty-state {
  display: grid;
  place-items: center;
  height: 100%;
  color: #6f7580;
}
</style>
