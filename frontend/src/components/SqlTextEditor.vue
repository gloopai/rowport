<script setup>
import {computed, ref} from 'vue'
import {highlightSql} from '../composables/sqlHighlight'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'keydown', 'selectionChange'])
const editorRef = ref(null)
const gutterRef = ref(null)
const highlightRef = ref(null)

const lineNumbers = computed(() => {
  const count = Math.max(1, props.modelValue.split('\n').length)
  return Array.from({length: count}, (_, index) => index + 1)
})

const highlightedHtml = computed(() => highlightSql(props.modelValue))

function getElement() {
  return editorRef.value
}

function handleInput(event) {
  emit('update:modelValue', event.target.value)
  emit('selectionChange')
}

function syncScroll() {
  const editor = editorRef.value
  if (!editor) return
  if (gutterRef.value) gutterRef.value.scrollTop = editor.scrollTop
  if (highlightRef.value) {
    highlightRef.value.scrollTop = editor.scrollTop
    highlightRef.value.scrollLeft = editor.scrollLeft
  }
}

defineExpose({getElement})
</script>

<template>
  <div class="sql-surface">
    <div ref="gutterRef" class="line-gutter">
      <span v-for="line in lineNumbers" :key="line">{{ line }}</span>
    </div>
    <div class="editor-stack">
      <pre ref="highlightRef" class="sql-highlight" aria-hidden="true"><code v-html="highlightedHtml"></code></pre>
      <textarea
        ref="editorRef"
        :value="modelValue"
        spellcheck="false"
        data-native-context
        @keydown="emit('keydown', $event)"
        @select="emit('selectionChange')"
        @keyup="emit('selectionChange')"
        @mouseup="emit('selectionChange')"
        @scroll="syncScroll"
        @input="handleInput"
      ></textarea>
    </div>
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
  overflow: hidden;
  color: #5f646d;
  font-family: 'SFMono-Regular', Consolas, monospace;
  line-height: 24px;
  border-right: 1px solid var(--line-soft);
}

.editor-stack {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(transparent 23px, rgba(255, 255, 255, 0.025) 24px) 0 0 / 100% 24px,
    #1f2023;
}

.sql-highlight {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 8px 16px;
  overflow: hidden;
  pointer-events: none;
  color: #c9ccd2;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  line-height: 24px;
  white-space: pre-wrap;
  word-break: break-word;
}

.sql-highlight code {
  font: inherit;
}

:deep(.sql-kw) {
  color: #79b8ff;
}

:deep(.sql-str) {
  color: #98c379;
}

:deep(.sql-id) {
  color: #e5c07b;
}

:deep(.sql-num) {
  color: #d19a66;
}

:deep(.sql-cmt) {
  color: #6a737d;
  font-style: italic;
}

textarea {
  position: relative;
  z-index: 1;
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 8px 16px;
  color: transparent;
  caret-color: #c9ccd2;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  line-height: 24px;
  resize: none;
  border: 0;
  border-radius: 0;
  outline: none;
  box-shadow: none;
  background: transparent;
  appearance: none;
}

textarea::selection {
  color: transparent;
  background: rgba(56, 139, 253, 0.35);
}
</style>
