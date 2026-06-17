<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    rating: number
    max?: number
    size?: 'sm' | 'md'
    showValue?: boolean
    interactive?: boolean
  }>(),
  { max: 5, size: 'md', showValue: false, interactive: false },
)

const emit = defineEmits<{
  'update:rating': [value: number]
}>()

const starClass = computed(() => (props.size === 'sm' ? 'text-sm' : 'text-base'))

function starType(index: number): 'full' | 'half' | 'empty' {
  const v = props.rating
  if (v >= index) return 'full'
  if (v >= index - 0.5) return 'half'
  return 'empty'
}

function setRating(n: number) {
  emit('update:rating', n)
}
</script>

<template>
  <span class="inline-flex items-center gap-0.5" :class="starClass" role="img" :aria-label="`${rating} 星`">
    <button
      v-for="n in max"
      :key="n"
      type="button"
      class="leading-none"
      :class="props.interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'"
      :disabled="!props.interactive"
      @click="setRating(n)"
    >
      <span v-if="starType(n) === 'full'" class="text-amber-400">★</span>
      <span v-else-if="starType(n) === 'half'" class="text-amber-400">⯨</span>
      <span v-else class="text-stone-300">★</span>
    </button>
    <span v-if="showValue" class="ml-1 text-stone-500">{{ rating.toFixed(1) }}</span>
  </span>
</template>
