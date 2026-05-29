<script setup>
import CustomSelect from './CustomSelect.vue'

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
  draft: {
    type: Object,
    required: true
  },
  columnOptions: {
    type: Array,
    default: () => []
  },
  operatorOptions: {
    type: Array,
    default: () => []
  },
  openSelectId: {
    type: String,
    default: ''
  },
  buildFilterCondition: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['close', 'submit', 'toggle-select', 'choose-column', 'choose-operator'])
</script>

<template>
  <div v-if="open" class="dialog-backdrop">
    <form class="dialog compact-dialog filter-dialog" @submit.prevent="emit('submit')">
      <header>
        <div class="dialog-title">
          <h2>构建筛选条件</h2>
          <span>{{ database }}.{{ table }}</span>
        </div>
        <button type="button" class="icon-close" @click="emit('close')">×</button>
      </header>
      <div class="dialog-body filter-builder">
        <label class="field">
          <span>字段</span>
          <CustomSelect
            field
            :options="columnOptions"
            :value="draft.column"
            fallback="选择字段"
            :open="openSelectId === 'filterColumn'"
            @toggle="emit('toggle-select', 'filterColumn')"
            @choose="emit('choose-column', $event)"
          />
        </label>
        <label class="field">
          <span>条件</span>
          <CustomSelect
            field
            :options="operatorOptions"
            :value="draft.operator"
            fallback="= equals"
            :open="openSelectId === 'filterOperator'"
            @toggle="emit('toggle-select', 'filterOperator')"
            @choose="emit('choose-operator', $event)"
          />
        </label>
        <label v-if="!['IS NULL', 'IS NOT NULL'].includes(draft.operator)" class="field wide">
          <span>{{ draft.operator === 'BETWEEN' ? '起始值' : '值' }}</span>
          <input v-model="draft.value" data-native-context />
        </label>
        <label v-if="draft.operator === 'BETWEEN'" class="field wide">
          <span>结束值</span>
          <input v-model="draft.value2" data-native-context />
        </label>
        <div class="filter-preview wide">
          <span>WHERE</span>
          <code>{{ buildFilterCondition(draft) || '条件未完成' }}</code>
        </div>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('close')">取消</button>
        <button class="primary" type="submit">应用筛选</button>
      </footer>
    </form>
  </div>
</template>
