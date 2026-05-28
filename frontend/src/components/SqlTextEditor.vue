<script setup>
import {ref} from 'vue'

defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'keydown', 'selectionChange'])
const editorRef = ref(null)

function getElement() {
  return editorRef.value
}

function handleInput(event) {
  emit('update:modelValue', event.target.value)
  emit('selectionChange')
}

defineExpose({getElement})
</script>

<template>
  <div class="sql-surface">
    <div class="line-gutter">
      <span v-for="line in 24" :key="line">{{ line }}</span>
    </div>
    <textarea
      ref="editorRef"
      :value="modelValue"
      spellcheck="false"
      data-native-context
      @keydown="emit('keydown', $event)"
      @select="emit('selectionChange')"
      @keyup="emit('selectionChange')"
      @mouseup="emit('selectionChange')"
      @input="handleInput"
    ></textarea>
  </div>
</template>

<style scoped>
.sql-surface {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #1f2023;
}

.line-gutter {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 8px 12px 0 0;
  color: #5f646d;
  font-family: "SFMono-Regular", Consolas, monospace;
  line-height: 24px;
  border-right: 1px solid var(--line-soft);
}

textarea {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 8px 16px;
  color: #c9ccd2;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  line-height: 24px;
  resize: none;
  border: 0;
  border-radius: 0;
  outline: none;
  box-shadow: none;
  background:
    linear-gradient(transparent 23px, rgba(255, 255, 255, 0.025) 24px) 0 0 / 100% 24px,
  #1f2023;
  appearance: none;
}
</style>
