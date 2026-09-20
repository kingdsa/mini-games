<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    accent?: string
    highlight?: boolean
  }>(),
  { accent: '#7c5cff', hint: '', highlight: false },
)
</script>

<template>
  <div class="stat" :class="{ 'stat--hl': highlight }" :style="{ '--accent': accent }">
    <span class="stat__label">{{ label }}</span>
    <span class="stat__value">{{ value }}</span>
    <span v-if="hint" class="stat__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border);
  overflow: hidden;
  min-width: 0;
}

.stat::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), transparent);
  opacity: 0.85;
}

.stat--hl {
  background: linear-gradient(150deg, rgba(124, 92, 255, 0.24), rgba(34, 211, 238, 0.09));
  border-color: rgba(124, 92, 255, 0.4);
  box-shadow: 0 8px 26px -14px rgba(124, 92, 255, 0.9);
}

.stat__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.stat__value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat__hint {
  font-size: 11px;
  color: var(--text-3);
}
</style>