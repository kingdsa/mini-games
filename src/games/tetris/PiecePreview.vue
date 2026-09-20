<script setup lang="ts">
import { computed } from 'vue'
import { PIECE_SKINS, type PieceType } from './constants'
import { trimmedMatrix } from './engine'

const props = withDefaults(
  defineProps<{
    type: PieceType | null
    cell?: number
  }>(),
  { cell: 17 },
)

const matrix = computed(() => (props.type ? trimmedMatrix(props.type) : [[0]]))
const cols = computed(() => matrix.value[0]?.length ?? 1)
const skin = computed(() => (props.type ? PIECE_SKINS[props.type] : null))
</script>

<template>
  <div
    class="preview"
    :style="{
      '--cell': `${cell}px`,
      gridTemplateColumns: `repeat(${cols}, var(--cell))`,
    }"
  >
    <template v-for="(row, r) in matrix" :key="r">
      <span
        v-for="(value, c) in row"
        :key="`${r}-${c}`"
        class="preview__cell"
        :class="{ 'is-on': !!value && !!skin }"
        :style="
          value && skin
            ? {
                background: `linear-gradient(145deg, ${skin.light}, ${skin.glow} 45%, ${skin.dark})`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,.55), 0 0 10px -2px ${skin.glow}`,
              }
            : undefined
        "
      />
    </template>
  </div>
</template>

<style scoped>
.preview {
  display: grid;
  gap: 2px;
  justify-content: center;
  align-content: center;
}

.preview__cell {
  width: var(--cell);
  height: var(--cell);
  border-radius: calc(var(--cell) * 0.24);
  transition: background 0.2s;
}

.preview__cell.is-on {
  border: 1px solid rgba(255, 255, 255, 0.34);
}
</style>