<script setup>
defineProps({
  openTabs: {
    type: Array,
    default: () => []
  },
  activeTabId: {
    type: String,
    default: ''
  },
  activeConnection: {
    type: Object,
    default: () => ({status: {connected: false}})
  },
  connectedLabel: {
    type: String,
    default: ''
  },
  tabTitle: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['activateTab', 'closeTab'])
</script>

<template>
  <nav class="editor-tabs">
    <button
      v-for="tab in openTabs"
      :key="tab.id"
      class="editor-tab"
      :class="{active: tab.id === activeTabId}"
      @click="emit('activateTab', tab.id)"
    >
      <span v-if="tab.kind === 'query'" class="mysql-mark">⌁</span>
      <span v-else-if="tab.kind === 'data'" class="table-icon">▦</span>
      <span v-else class="folder-icon">▣</span>
      {{ tabTitle(tab) }}
      <span class="tab-close" @click.stop="emit('closeTab', tab.id, $event)">×</span>
    </button>
    <div class="tab-spacer"></div>
    <span class="connection-pill">
      <span :class="['status-light', {online: activeConnection.status.connected}]"></span>
      {{ connectedLabel }}
    </span>
  </nav>
</template>

<style scoped>
.editor-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  user-select: none;
  background: var(--panel-darker);
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

.editor-tab {
  height: 37px;
  padding: 0 12px;
  border-radius: 0;
  border-right: 1px solid var(--line);
}

.editor-tab.active {
  background: #2b2d30;
}

.tab-close {
  margin-left: 10px;
  padding: 0 4px;
  color: var(--muted);
  border-radius: 4px;
}

.tab-close:hover {
  color: #ffffff;
  background: #4a4e55;
}

.tab-spacer {
  flex: 1;
}

.connection-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
  color: var(--muted);
}

.status-light {
  width: 8px;
  height: 8px;
  background: #6b7280;
  border-radius: 50%;
}

.status-light.online {
  color: var(--green);
  background: var(--green);
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
</style>
