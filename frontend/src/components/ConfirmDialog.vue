<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  dialog: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['resolve'])
</script>

<template>
  <div v-if="open" class="dialog-backdrop">
    <section class="dialog confirm-dialog">
      <header>
        <h2>{{ dialog.title }}</h2>
        <button type="button" class="icon-close" @click="emit('resolve', false)">×</button>
      </header>
      <div class="dialog-body">
        <p class="confirm-copy">{{ dialog.body }}</p>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('resolve', false)">取消</button>
        <button type="button" class="danger-primary" @click="emit('resolve', true)">{{ dialog.action }}</button>
      </footer>
    </section>
  </div>
</template>
