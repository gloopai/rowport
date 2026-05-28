<script setup>
const props = defineProps({
  profileId: {
    type: String,
    required: true
  },
  databaseName: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  currentTab: {
    type: Object,
    default: null
  },
  tableMetadata: {
    type: Object,
    default: () => ({})
  },
  metadataKey: {
    type: Function,
    required: true
  },
  isExpanded: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['toggleExpanded', 'selectTableObject'])

function metadata() {
  return props.tableMetadata[props.metadataKey(props.profileId, props.databaseName, props.tableName)] || {columns: [], indexes: []}
}

function columns() {
  return metadata().columns || []
}

function primaryColumns() {
  return columns().filter((column) => column.key === 'PRI')
}

function indexes() {
  return metadata().indexes || []
}

function indexCount() {
  return new Set(indexes().map((item) => item.indexName)).size
}

function isSelected(type) {
  return props.currentTab?.profileId === props.profileId &&
    props.currentTab?.kind === 'structure' &&
    props.currentTab.objectType === type &&
    props.currentTab.table === props.tableName &&
    props.currentTab.database === props.databaseName
}

function selectObject(type) {
  emit('selectTableObject', type, props.tableName, props.databaseName, props.profileId)
}

function toggleObject(type) {
  emit('toggleExpanded', type, props.profileId, props.databaseName, props.tableName)
}
</script>

<template>
  <div class="tree-children table-objects">
    <button
      class="tree-row object-folder"
      :class="{selected: isSelected('columns')}"
      @click="selectObject('columns')"
    >
      <span class="tree-expander" @click.stop="toggleObject('columns')">{{ isExpanded('columns', profileId, databaseName, tableName) ? '⌄' : '›' }}</span>
      <span class="tree-icon icon-folder"></span>
      <span class="tree-label">columns</span>
      <span class="tree-badge">{{ columns().length }}</span>
    </button>
    <div v-if="isExpanded('columns', profileId, databaseName, tableName)" class="tree-children leaf-list">
      <button
        v-for="column in columns()"
        :key="column.name"
        class="tree-row leaf-row"
        @click="selectObject('columns')"
      >
        <span class="tree-icon icon-column" :class="{primary: column.key === 'PRI'}"></span>
        <span class="tree-label">{{ column.name }}</span>
        <span class="tree-detail">{{ column.type }}</span>
      </button>
    </div>

    <button
      class="tree-row object-folder"
      :class="{selected: isSelected('keys')}"
      @click="selectObject('keys')"
    >
      <span class="tree-expander" @click.stop="toggleObject('keys')">{{ isExpanded('keys', profileId, databaseName, tableName) ? '⌄' : '›' }}</span>
      <span class="tree-icon icon-folder"></span>
      <span class="tree-label">keys</span>
      <span class="tree-badge">{{ primaryColumns().length }}</span>
    </button>
    <div v-if="isExpanded('keys', profileId, databaseName, tableName)" class="tree-children leaf-list">
      <button
        v-for="column in primaryColumns()"
        :key="column.name"
        class="tree-row leaf-row"
        @click="selectObject('keys')"
      >
        <span class="tree-icon icon-key"></span>
        <span class="tree-label">PRIMARY</span>
        <span class="tree-detail">{{ column.name }}</span>
      </button>
    </div>

    <button
      class="tree-row object-folder"
      :class="{selected: isSelected('indexes')}"
      @click="selectObject('indexes')"
    >
      <span class="tree-expander" @click.stop="toggleObject('indexes')">{{ isExpanded('indexes', profileId, databaseName, tableName) ? '⌄' : '›' }}</span>
      <span class="tree-icon icon-folder"></span>
      <span class="tree-label">indexes</span>
      <span class="tree-badge">{{ indexCount() }}</span>
    </button>
    <div v-if="isExpanded('indexes', profileId, databaseName, tableName)" class="tree-children leaf-list">
      <button
        v-for="index in indexes()"
        :key="`${index.indexName}.${index.seqInIndex}`"
        class="tree-row leaf-row"
        @click="selectObject('indexes')"
      >
        <span class="tree-icon icon-index"></span>
        <span class="tree-label">{{ index.indexName }}</span>
        <span class="tree-detail">{{ index.columnName }}</span>
      </button>
    </div>

    <button
      class="tree-row object-folder"
      :class="{selected: isSelected('ddl')}"
      @click="selectObject('ddl')"
    >
      <span class="tree-spacer"></span>
      <span class="tree-icon icon-index"></span>
      <span class="tree-label">DDL</span>
    </button>
  </div>
</template>
