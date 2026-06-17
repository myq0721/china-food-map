<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { Recommender } from '@/types/restaurant'
import { getRecommenderProfileUrl, PLATFORM_LABELS } from '@/utils/profileUrl'
import { useCreatorDisplayNames } from '@/composables/useCreatorDisplayNames'

const props = defineProps<{
  recommender: Recommender
  showPlatform?: boolean
}>()

const { ensureLoaded, getDisplayName } = useCreatorDisplayNames()
onMounted(ensureLoaded)

const profileUrl = computed(() => getRecommenderProfileUrl(props.recommender))
const label = computed(() =>
  getDisplayName(
    props.recommender.platform,
    props.recommender.authorId,
    props.recommender.displayName,
  ),
)
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <a
      v-if="profileUrl"
      :href="profileUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="font-medium text-brand hover:underline"
      @click.stop
    >{{ label }}</a>
    <span v-else class="font-medium">{{ label }}</span>
    <span
      v-if="showPlatform && recommender.platform !== 'github'"
      class="text-xs text-stone-400"
    >({{ PLATFORM_LABELS[recommender.platform] }})</span>
  </span>
</template>
