<script setup>
import {ref} from 'vue'

defineProps({
  visibleLogs: {
    type: Array,
    default: () => []
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

const consoleOutputRef = ref(null)

function scrollToBottom() {
  if (consoleOutputRef.value) {
    consoleOutputRef.value.scrollTop = consoleOutputRef.value.scrollHeight
  }
}

defineExpose({scrollToBottom})
</script>

<template>
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
</template>

<style scoped>
.console-output {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: auto;
  color: #b9bdc5;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
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
