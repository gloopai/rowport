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
  preview: {
    type: Object,
    required: true
  },
  busy: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <div v-if="open" class="dialog-backdrop">
    <section class="dialog import-dialog">
      <header>
        <div class="dialog-title">
          <h2>导入 CSV 预览</h2>
          <span>{{ database }}.{{ table }} · {{ preview.total }} rows</span>
        </div>
        <button type="button" class="icon-close" @click="emit('close')">×</button>
      </header>
      <div class="dialog-body">
        <p class="confirm-copy">将按 CSV 表头匹配当前表字段；未匹配字段会忽略。单次最多导入 1000 行。</p>
        <div class="grid-wrap import-preview-grid">
          <table v-if="preview.columns.length" class="data-grid">
            <thead>
              <tr>
                <th class="row-num"></th>
                <th v-for="column in preview.columns" :key="column">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in preview.previewRows" :key="rowIndex">
                <td class="row-num">{{ rowIndex + 1 }}</td>
                <td v-for="(value, cellIndex) in row" :key="cellIndex">{{ value || '<empty>' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state">没有解析到 CSV 数据。</div>
        </div>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('close')">关闭</button>
        <button class="primary" type="button" :disabled="busy || !preview.total" @click="emit('confirm')">导入</button>
      </footer>
    </section>
  </div>
</template>
