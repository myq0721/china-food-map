<script setup lang="ts">
import { computed } from 'vue'
import type { Recommender } from '@/types/restaurant'
import { getRecommenderProfileUrl, PLATFORM_LABELS } from '@/utils/profileUrl'

const props = defineProps<{
  recommender: Recommender
  showPlatform?: boolean
}>()

const profileUrl = computed(() => getRecommenderProfileUrl(props.recommender))
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <a
      v-if="profileUrl"
      :href="profileUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="text-brand hover:underline"
      @click.stop
    >{{ recommender.authorId }}</a>
    <span v-else>{{ recommender.authorId }}</span>
    <span
      v-if="showPlatform && recommender.platform !== 'github'"
      class="text-xs text-stone-400"
    >({{ PLATFORM_LABELS[recommender.platform] }})</span>
  </span>
</template>
