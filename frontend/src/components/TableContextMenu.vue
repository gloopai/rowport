<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  menuStyle: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'open-data',
  'open-structure',
  'copy-name',
  'insert-sql',
  'insert-ddl'
])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="context-menu"
      :style="menuStyle"
      @click.stop
      @contextmenu.prevent.stop
    >
      <button @click="emit('open-data')">Open Data</button>
      <button @click="emit('open-structure', 'columns')">Columns</button>
      <button @click="emit('open-structure', 'indexes')">Indexes</button>
      <button @click="emit('open-structure', 'ddl')">Show DDL</button>
      <button @click="emit('copy-name')">Copy Qualified Name</button>
      <button @click="emit('insert-sql', 'select')">Generate SELECT</button>
      <button @click="emit('insert-sql', 'insert')">Generate INSERT</button>
      <button @click="emit('insert-sql', 'update')">Generate UPDATE</button>
      <button @click="emit('insert-sql', 'delete')">Generate DELETE</button>
      <button @click="emit('insert-ddl', 'addColumn')">Add Column SQL</button>
      <button @click="emit('insert-ddl', 'createIndex')">Create Index SQL</button>
      <button @click="emit('insert-ddl', 'renameTable')">Rename Table SQL</button>
      <button class="danger-menu-item" @click="emit('insert-ddl', 'dropTable')">Drop Table SQL</button>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 5px;
  color: #c9ccd2;
  background: #2b2d30;
  border: 1px solid #4a4e55;
  border-radius: 6px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  overscroll-behavior: contain;
}

.context-menu button {
  justify-content: flex-start;
  width: 100%;
  min-height: 28px;
  padding: 0 8px;
  color: #c9ccd2;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}

.context-menu button:hover {
  color: #ffffff;
  background: #373a3f;
}

.context-menu .danger-menu-item {
  color: #ffb4aa;
}
</style>
