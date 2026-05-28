<script setup>
import {computed} from 'vue'

const props = defineProps({
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
  columns: {
    type: Array,
    default: () => []
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
  isLongTextColumn: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['close', 'submit'])

const editableColumns = computed(() => props.columns.filter((item) => !String(item.extra || '').includes('auto_increment')))
</script>

<template>
  <div v-if="open" class="dialog-backdrop">
    <form class="dialog compact-dialog row-dialog" @submit.prevent="emit('submit')">
      <header>
        <div class="dialog-title">
          <h2>新增行</h2>
          <span>{{ database }}.{{ table }} · 自增字段已跳过</span>
        </div>
        <button type="button" class="icon-close" @click="emit('close')">×</button>
      </header>
      <div class="row-editor-summary">
        <span>{{ editableColumns.length }} 个可填写字段</span>
        <span>保存后会立即写入数据库</span>
      </div>
      <div class="dialog-body row-editor">
        <div
          v-for="column in editableColumns"
          :key="column.name"
          class="field row-field"
          :class="{'is-null': nulls[column.name], 'is-long': isLongTextColumn(column)}"
        >
          <span class="field-heading">
            <span class="field-name">{{ column.name }}</span>
            <span class="field-meta">
              <span v-if="column.default !== null && column.default !== undefined" class="field-badge">默认 {{ column.default }}</span>
              <span class="field-type">{{ column.type }}</span>
            </span>
          </span>
          <label v-if="isNullableColumn(column)" class="null-toggle" :class="{active: nulls[column.name]}">
            <input v-model="nulls[column.name]" type="checkbox" data-native-context>
            <span>NULL</span>
          </label>
          <textarea
            v-if="isLongTextColumn(column)"
            v-model="values[column.name]"
            :disabled="nulls[column.name]"
            :placeholder="column.type"
            wrap="off"
            rows="4"
            data-native-context
          ></textarea>
          <input v-else v-model="values[column.name]" :disabled="nulls[column.name]" :placeholder="column.type" data-native-context>
        </div>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('close')">取消</button>
        <button class="primary" type="submit">插入</button>
      </footer>
    </form>
  </div>
</template>
