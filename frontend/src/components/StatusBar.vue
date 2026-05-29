<script setup>
defineProps({
  profileName: {
    type: String,
    default: ''
  },
  selectedDatabase: {
    type: String,
    default: ''
  },
  selectedTable: {
    type: String,
    default: ''
  },
  perfStatusText: {
    type: String,
    default: ''
  },
  perfStatusTitle: {
    type: String,
    default: ''
  },
  latestLog: {
    type: Object,
    default: null
  },
  rowCount: {
    type: Number,
    default: 0
  }
})
</script>

<template>
  <footer class="statusbar">
    <span>Database</span>
    <span>›</span>
    <span>{{ profileName || '@localhost' }}</span>
    <span v-if="selectedDatabase">› {{ selectedDatabase }}</span>
    <span v-if="selectedTable">› {{ selectedTable }}</span>
    <span class="statusbar-fill"></span>
    <span v-if="perfStatusText" class="statusbar-perf" :title="perfStatusTitle">⏱ {{ perfStatusText }}</span>
    <span v-if="latestLog">{{ latestLog.level }}: {{ latestLog.text }}</span>
    <span>{{ rowCount }} rows</span>
    <span>UTF-8</span>
    <span>4 spaces</span>
  </footer>
</template>
