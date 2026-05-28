<script setup>
defineProps({
  historySearch: {
    type: String,
    default: ''
  },
  selectedTable: {
    type: String,
    default: ''
  },
  savedHistoryItem: {
    type: Object,
    default: null
  },
  savedQueryHistory: {
    type: Array,
    default: () => []
  },
  recentQueryHistory: {
    type: Array,
    default: () => []
  },
  selectedHistoryId: {
    type: String,
    default: ''
  },
  historyOptionLabel: {
    type: Function,
    required: true
  }
})

const emit = defineEmits([
  'update:historySearch',
  'format',
  'insertTemplate',
  'toggleSaved',
  'clearRecent',
  'chooseHistory'
])
</script>

<template>
  <aside class="query-side-panel">
    <section class="tool-panel-section">
      <div class="tool-panel-title">Tools</div>
      <button class="tool-panel-button" title="Format SQL" @click="emit('format')">Format</button>
    </section>
    <section class="tool-panel-section">
      <div class="tool-panel-title">Generate</div>
      <div class="tool-panel-grid">
        <button :disabled="!selectedTable" @click="emit('insertTemplate', 'select')">SELECT</button>
        <button :disabled="!selectedTable" @click="emit('insertTemplate', 'insert')">INSERT</button>
        <button :disabled="!selectedTable" @click="emit('insertTemplate', 'update')">UPDATE</button>
        <button :disabled="!selectedTable" @click="emit('insertTemplate', 'delete')">DELETE</button>
      </div>
    </section>
    <section class="tool-panel-section saved-panel-section">
      <div class="tool-panel-title history-menu-title">
        <span>Saved SQL</span>
        <button
          class="favorite-action"
          :class="{saved: savedHistoryItem?.favorite}"
          :title="savedHistoryItem?.favorite ? '取消收藏 SQL' : '收藏当前 SQL'"
          @click.stop="emit('toggleSaved')"
        >
          {{ savedHistoryItem?.favorite ? '★' : '☆' }}
        </button>
      </div>
      <div class="history-panel-list saved-history-list">
        <div v-if="!savedQueryHistory.length" class="select-empty">No saved SQL</div>
        <button
          v-for="item in savedQueryHistory"
          :key="item.id"
          :class="{active: item.id === selectedHistoryId}"
          @click="emit('chooseHistory', item.id)"
        >{{ historyOptionLabel(item) }}</button>
      </div>
    </section>
    <section class="tool-panel-section history-panel-section">
      <div class="tool-panel-title history-menu-title">
        <span>Recent History</span>
        <button class="panel-link-button" :disabled="!recentQueryHistory.length" @click="emit('clearRecent')">Clear</button>
      </div>
      <input
        :value="historySearch"
        class="history-search"
        placeholder="Search history"
        data-native-context
        @input="emit('update:historySearch', $event.target.value)"
        @click.stop
        @keydown.stop
      >
      <div class="history-panel-list">
        <div v-if="!recentQueryHistory.length" class="select-empty">{{ historySearch ? 'No matching history' : 'No recent history' }}</div>
        <button
          v-for="item in recentQueryHistory"
          :key="item.id"
          :class="{active: item.id === selectedHistoryId}"
          @click="emit('chooseHistory', item.id)"
        >{{ historyOptionLabel(item) }}</button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.query-side-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #24262a;
  border-left: 1px solid var(--line);
}

.tool-panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-top: 1px solid var(--line);
}

.tool-panel-section:first-child {
  border-top: 0;
}

.tool-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  padding: 0 4px;
  color: #7f8794;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.tool-panel-button,
.tool-panel-grid button,
.history-panel-list button {
  display: block;
  width: 100%;
  min-height: 26px;
  padding: 0 8px;
  color: #cbd1db;
  text-align: left;
  background: #2b2e34;
  border-color: #3a3e45;
}

.tool-panel-button:hover:not(:disabled),
.tool-panel-grid button:hover:not(:disabled),
.history-panel-list button:hover:not(:disabled) {
  color: #ffffff;
  background: #343840;
}

.history-panel-list button.active {
  color: #ffffff;
  background: #41506a;
}

.tool-panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.history-panel-section {
  flex: 1;
  min-height: 0;
}

.saved-panel-section {
  max-height: 34%;
  min-height: 96px;
}

.history-panel-list {
  min-height: 0;
  overflow: auto;
}

.saved-history-list {
  max-height: 160px;
}

.history-menu-title {
  padding-right: 0;
}

.history-search {
  width: 100%;
  height: 24px;
  min-height: 24px;
  margin-bottom: 4px;
  padding: 0 8px;
  color: #cbd1db;
  background: #202226;
  border: 1px solid #3a3e45;
  border-radius: 4px;
}

.favorite-action {
  width: 28px;
  min-width: 28px;
  min-height: 24px;
  padding: 0;
  color: #aeb6c2;
  background: transparent;
  border-color: #3a3e45;
  font-size: 14px;
}

.favorite-action:hover:not(:disabled) {
  color: #ffffff;
  background: #343840;
}

.favorite-action.saved {
  color: #ffd66e;
  background: rgba(214, 163, 95, 0.16);
  border-color: rgba(214, 163, 95, 0.52);
}

.favorite-action.saved:hover:not(:disabled) {
  background: rgba(214, 163, 95, 0.24);
}

.panel-link-button {
  min-height: 22px;
  padding: 0 6px;
  color: #9fb8e8;
  font-size: 11px;
  text-transform: none;
  background: transparent;
  border-color: transparent;
}

.panel-link-button:hover:not(:disabled) {
  color: #ffffff;
  background: #343840;
}

@media (max-width: 1040px) {
  .query-side-panel {
    font-size: 12px;
  }
}
</style>
