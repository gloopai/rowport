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
  gap: 5px;
  padding: 11px 10px;
  border-top: 1px solid var(--line);
}

.tool-panel-section:first-child {
  border-top: 0;
}

.tool-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 18px;
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
  min-height: 28px;
  padding: 0 9px;
  color: #cbd1db;
  font: inherit;
  line-height: 1;
  text-align: left;
  background: #282b30;
  border: 1px solid #3a3f47;
  border-radius: 3px;
  box-shadow: none;
  appearance: none;
}

.tool-panel-button:hover:not(:disabled),
.tool-panel-grid button:hover:not(:disabled),
.history-panel-list button:hover:not(:disabled) {
  color: #ffffff;
  background: #343840;
  border-color: #4a505a;
}

.history-panel-list button.active {
  color: #ffffff;
  background: #41506a;
  border-color: #52647f;
}

.tool-panel-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 5px;
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
  height: 28px;
  min-height: 28px;
  padding: 0 8px;
  color: #cbd1db;
  font: inherit;
  background: #202226;
  border: 1px solid #3a3e45;
  border-radius: 4px;
  outline: none;
  box-shadow: none;
}

.history-search:focus {
  border-color: #52647f;
  background: #22252b;
}

.favorite-action {
  width: 28px;
  min-width: 28px;
  min-height: 26px;
  padding: 0;
  color: #aeb6c2;
  font: inherit;
  font-size: 14px;
  text-align: center;
  background: #25282e;
  border: 1px solid #3a3e45;
  border-radius: 4px;
  box-shadow: none;
  appearance: none;
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
  padding: 0;
  color: #9fb8e8;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  text-transform: none;
  background: transparent;
  border: 0;
  box-shadow: none;
  appearance: none;
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
