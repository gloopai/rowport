<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  detail: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])
</script>

<template>
  <div v-if="open" class="dialog-backdrop">
    <section class="dialog result-detail-dialog">
      <header>
        <div class="dialog-title">
          <h2>结果行详情</h2>
          <span>{{ detail.title }}</span>
        </div>
        <button type="button" class="icon-close" @click="emit('close')">×</button>
      </header>
      <div class="dialog-body result-detail-body">
        <div v-for="field in detail.fields" :key="field.column" class="detail-field">
          <span>{{ field.column }}</span>
          <pre data-native-context>{{ field.value }}</pre>
        </div>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('close')">关闭</button>
      </footer>
    </section>
  </div>
</template>
