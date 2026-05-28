<script setup>
const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  value: {
    type: [String, Number, Boolean],
    default: ''
  },
  fallback: {
    type: String,
    default: ''
  },
  open: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  },
  wide: {
    type: Boolean,
    default: false
  },
  field: {
    type: Boolean,
    default: false
  },
  alignRight: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['toggle', 'choose'])

function optionLabel() {
  return props.options.find((option) => String(option.value) === String(props.value))?.label || props.fallback
}
</script>

<template>
  <div
    class="custom-select"
    :class="{open, disabled, compact, wide, 'field-select': field}"
    @click.stop
  >
    <button
      class="custom-select-button"
      type="button"
      :title="title"
      :disabled="disabled"
      @click="emit('toggle')"
    >
      <span>{{ optionLabel() }}</span>
      <span class="select-caret">⌄</span>
    </button>
    <div v-if="open" class="custom-select-menu" :class="{'align-right': alignRight}">
      <button
        v-for="option in options"
        :key="String(option.value)"
        type="button"
        :class="{active: String(option.value) === String(value)}"
        @click="emit('choose', option.value)"
      >{{ option.label }}</button>
    </div>
  </div>
</template>

<style scoped>
.custom-select {
  position: relative;
  min-width: 140px;
}

.custom-select.compact {
  min-width: 92px;
}

.custom-select.wide {
  min-width: 260px;
}

.custom-select-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 25px;
  padding: 0 7px 0 9px;
  color: var(--text);
  background: #303338;
  border: 1px solid var(--line);
  border-radius: 5px;
  box-shadow: none;
  appearance: none;
}

.custom-select-button span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-select.open .custom-select-button {
  border-color: #4d8df7;
  box-shadow: 0 0 0 1px rgba(77, 141, 247, 0.25);
}

.custom-select.disabled {
  opacity: 0.48;
}

.select-caret {
  color: var(--muted);
  font-size: 12px;
}

.custom-select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  width: max(100%, 180px);
  max-height: 260px;
  overflow: auto;
  padding: 4px;
  background: #2b2d30;
  border: 1px solid #4a4e55;
  border-radius: 6px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.45);
}

.custom-select-menu.align-right {
  right: 0;
  left: auto;
}

.custom-select-menu button {
  display: block;
  width: 100%;
  min-height: 25px;
  padding: 0 8px;
  color: #cbd1db;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

.custom-select-menu button:hover {
  color: #ffffff;
  background: #343840;
}

.custom-select-menu button.active {
  color: #ffffff;
  background: #41506a;
}

.field-select .custom-select-menu {
  max-height: 220px;
}
</style>
