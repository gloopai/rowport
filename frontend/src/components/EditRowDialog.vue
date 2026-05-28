<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  database: {
    type: String,
    default: ''
  },
  table: {
    type: String,
    default: ''
  },
  tableData: {
    type: Object,
    required: true
  },
  values: {
    type: Object,
    required: true
  },
  nulls: {
    type: Object,
    required: true
  },
  isNullableColumn: {
    type: Function,
    required: true
  },
  isPrimaryKeyColumn: {
    type: Function,
    required: true
  },
  isLongTextColumn: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['close', 'submit'])
</script>

<template>
  <div v-if="open" class="dialog-backdrop">
    <form class="dialog compact-dialog row-dialog" @submit.prevent="emit('submit')">
      <header>
        <div class="dialog-title">
          <h2>编辑行</h2>
          <span>{{ database }}.{{ table }} · 主键字段只读</span>
        </div>
        <button type="button" class="icon-close" @click="emit('close')">×</button>
      </header>
      <div class="row-editor-summary">
        <span>{{ tableData.columns.length }} 个字段</span>
        <span>{{ tableData.primaryKeys.length }} 个主键</span>
        <span>保存后会立即写入数据库</span>
      </div>
      <div class="dialog-body row-editor">
        <div
          v-for="column in tableData.columns"
          :key="column.name"
          class="field row-field"
          :class="{'is-primary': isPrimaryKeyColumn(column), 'is-null': nulls[column.name], 'is-long': isLongTextColumn(column)}"
        >
          <span class="field-heading">
            <span class="field-name">{{ column.name }}</span>
            <span class="field-meta">
              <span v-if="isPrimaryKeyColumn(column)" class="field-badge key-badge">PRIMARY</span>
              <span class="field-type">{{ column.type }}</span>
            </span>
          </span>
          <label v-if="isNullableColumn(column)" class="null-toggle" :class="{active: nulls[column.name], disabled: isPrimaryKeyColumn(column)}">
            <input v-model="nulls[column.name]" type="checkbox" :disabled="isPrimaryKeyColumn(column)" data-native-context>
            <span>NULL</span>
          </label>
          <textarea
            v-if="isLongTextColumn(column)"
            v-model="values[column.name]"
            :disabled="isPrimaryKeyColumn(column) || nulls[column.name]"
            rows="4"
            data-native-context
          ></textarea>
          <input v-else v-model="values[column.name]" :disabled="isPrimaryKeyColumn(column) || nulls[column.name]" data-native-context>
        </div>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('close')">取消</button>
        <button class="primary" type="submit">保存修改</button>
      </footer>
    </form>
  </div>
</template>
