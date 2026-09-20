<script setup lang="ts">
import { computed } from 'vue'
import { CANDIES } from './constants'

const props = defineProps<{ type: number }>()

const candy = computed(() => CANDIES[props.type] ?? CANDIES[0])
</script>

<template>
  <img
    class="candy"
    :src="candy.src"
    :alt="candy.name"
    draggable="false"
    :style="{ '--glow': candy.glow }"
  />
</template>

<style scoped>
.candy {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.45));
}
</style>