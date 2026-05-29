<script setup>
defineProps({
  selectedProfile: {
    type: Object,
    default: null
  },
  selectedTable: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <aside class="services-tree">
    <div class="tree-row muted-row"><span class="folder-icon">▣</span><span>Database</span></div>
    <div class="tree-row selected">
      <span class="mysql-mark">⌁</span><span>{{ selectedProfile?.name || '@localhost' }}</span>
    </div>
    <div v-if="selectedTable" class="tree-row nested-service">
      <span class="table-icon">▦</span><span>{{ selectedTable }}</span>
    </div>
  </aside>
</template>

<style scoped>
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
</style>
