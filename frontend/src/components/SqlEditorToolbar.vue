<script setup>
import {ref} from 'vue'

defineProps({
  selectedDatabase: {
    type: String,
    default: ''
  },
  busy: {
    type: Boolean,
    default: false
  },
  runningQueryId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['run', 'cancel', 'explain', 'openSql'])
const toolbarRef = ref(null)

function getElement() {
  return toolbarRef.value
}

defineExpose({getElement})
</script>

<template>
  <div ref="toolbarRef" class="query-toolbar">
    <div class="query-toolbar-title">
      <span class="query-title-icon">⌁</span>
      <div>
        <strong>SQL Console</strong>
        <span>{{ selectedDatabase || 'No database selected' }}</span>
      </div>
    </div>
    <span class="toolbar-divider"></span>
    <div class="toolbar-group">
      <span class="toolbar-label">Execute</span>
      <button class="toolbar-action primary-action" :disabled="busy" title="Run selected SQL, otherwise the statement at cursor" @click="emit('run', 'smart')">
        <span class="action-icon">▶</span>
        <span>Run</span>
      </button>
      <button class="toolbar-action danger-action" :disabled="!runningQueryId" title="Cancel running SQL query" @click="emit('cancel')">
        <span class="stop-icon"></span>
        <span>Stop</span>
      </button>
      <button class="toolbar-action" :disabled="busy" title="Run statement at cursor" @click="emit('run', 'current')">Current</button>
      <button class="toolbar-action" :disabled="busy" title="Run every SQL statement in the editor" @click="emit('run', 'all')">All</button>
      <button class="toolbar-action" :disabled="busy" title="Run EXPLAIN for selected SQL or statement at cursor" @click="emit('explain', 'smart')">Explain</button>
      <button class="toolbar-action" title="Open SQL file" @click="emit('openSql')">
        <span class="open-icon"></span>
        <span>Open</span>
      </button>
    </div>
    <div class="toolbar-fill"></div>
    <span class="shortcut-hint">Cmd/Ctrl+Enter current · Shift+Cmd/Ctrl+Enter all</span>
  </div>
</template>

<style scoped>
.query-toolbar {
  display: flex;
  align-items: center;
  align-content: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  min-height: 40px;
  padding: 0 10px;
  user-select: none;
  background: linear-gradient(#292b2f, #25272b);
  border-bottom: 1px solid var(--line);
}

.query-toolbar-title {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
  min-width: 176px;
  color: #d9dde5;
}

.query-toolbar-title strong,
.query-toolbar-title span {
  display: block;
}

.query-toolbar-title strong {
  font-size: 12px;
  line-height: 15px;
  font-weight: 700;
}

.query-toolbar-title div > span {
  max-width: 138px;
  overflow: hidden;
  color: #858b95;
  font-size: 11px;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.query-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: #35a7e8;
  background: rgba(53, 167, 232, 0.08);
  border: 1px solid rgba(53, 167, 232, 0.22);
  border-radius: 5px;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  gap: 4px;
  min-width: 0;
}

.toolbar-label {
  margin-right: 2px;
  color: #737982;
  font-size: 11px;
}

.toolbar-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 20px;
  background: #3b3e44;
}

.toolbar-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 26px;
  min-height: 26px;
  padding: 0 9px;
  color: #cbd1db;
  font: inherit;
  font-weight: 600;
  background: #2b2e34;
  border: 1px solid transparent;
  border-radius: 4px;
  box-shadow: none;
  appearance: none;
}

.toolbar-action:hover:not(:disabled) {
  color: #ffffff;
  background: #343840;
  border-color: #454b55;
}

.primary-action {
  color: #d9f2dd;
  background: rgba(77, 179, 99, 0.18);
  border-color: rgba(77, 179, 99, 0.46);
}

.primary-action:hover:not(:disabled) {
  background: rgba(77, 179, 99, 0.24);
  border-color: rgba(77, 179, 99, 0.62);
}

.danger-action:not(:disabled) {
  color: #ffd4ce;
  background: rgba(244, 87, 82, 0.12);
  border-color: rgba(244, 87, 82, 0.34);
}

.danger-action:hover:not(:disabled) {
  background: rgba(244, 87, 82, 0.22);
}

.action-icon {
  color: #7ee08e;
  font-size: 11px;
}

.stop-icon,
.open-icon {
  display: inline-block;
  flex: 0 0 auto;
}

.stop-icon {
  width: 9px;
  height: 9px;
  background: currentColor;
  border-radius: 2px;
}

.open-icon {
  width: 11px;
  height: 9px;
  border: 1px solid currentColor;
  border-radius: 2px;
  box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.08);
}

.toolbar-fill {
  flex: 1;
}

.shortcut-hint {
  flex: 0 0 auto;
  color: #737982;
  font-size: 11px;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .query-toolbar {
    gap: 6px;
  }

  .query-toolbar-title {
    min-width: 138px;
  }

  .toolbar-label,
  .shortcut-hint {
    display: none;
  }

  .toolbar-action {
    padding: 0 7px;
  }
}

@media (max-width: 1040px) {
  .query-toolbar-title {
    min-width: auto;
  }

  .query-toolbar-title > div {
    display: none;
  }

  .toolbar-divider {
    display: none;
  }
}
</style>
