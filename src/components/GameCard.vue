<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useScoreStore } from '@/stores/scores'

const props = defineProps<{
  path: string
  title: string
  subtitle: string
  emoji: string
  tag: string
  accent: string
  accent2: string
  id: string
}>()

const store = useScoreStore()
const best = computed(() => store.best(props.id))
const plays = computed(() => store.record(props.id).plays)

const bestLabel = computed(() =>
  best.value > 0 ? best.value.toLocaleString('zh-CN') : '—',
)
</script>

<template>
  <RouterLink
    :to="path"
    class="card glass"
    :style="{ '--accent': accent, '--accent2': accent2 }"
  >
    <div class="card__glow" aria-hidden="true"></div>

    <header class="card__head">
      <span class="card__emoji" aria-hidden="true">{{ emoji }}</span>
      <span class="tag">{{ tag }}</span>
    </header>

    <h3 class="card__title">{{ title }}</h3>
    <p class="card__sub">{{ subtitle }}</p>

    <dl class="card__stats">
      <div>
        <dt>最高分</dt>
        <dd>{{ bestLabel }}</dd>
      </div>
      <div>
        <dt>游玩次数</dt>
        <dd>{{ plays }}</dd>
      </div>
    </dl>

    <span class="card__cta">
      开始挑战
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </span>
  </RouterLink>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  overflow: hidden;
  isolation: isolate;
  transition: transform 0.36s var(--ease-out), border-color 0.3s, box-shadow 0.36s var(--ease-out);
}

.card:hover {
  transform: translateY(-6px);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 26px 60px -24px color-mix(in srgb, var(--accent) 85%, transparent);
}

.card__glow {
  position: absolute;
  inset: -40% -30% auto -30%;
  height: 260px;
  background: radial-gradient(50% 60% at 30% 0%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%),
    radial-gradient(46% 60% at 82% 6%, color-mix(in srgb, var(--accent2) 42%, transparent), transparent 72%);
  filter: blur(6px);
  opacity: 0.5;
  z-index: -1;
  transition: opacity 0.36s var(--ease-out), transform 0.5s var(--ease-out);
}

.card:hover .card__glow {
  opacity: 0.9;
  transform: translateY(6px) scale(1.05);
}

.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card__emoji {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  font-size: 27px;
  border-radius: 17px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-1);
  transition: transform 0.4s var(--ease-bounce);
}

.card:hover .card__emoji {
  transform: rotate(-10deg) scale(1.08);
}

.card__title {
  margin-top: 6px;
  font-size: 22px;
}

.card__sub {
  font-size: 13.5px;
  color: var(--text-2);
  min-height: 42px;
}

.card__stats {
  display: flex;
  gap: 10px;
  margin: 6px 0 0;
}

.card__stats > div {
  flex: 1;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.24);
  border: 1px solid var(--border);
}

.card__stats dt {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.card__stats dd {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.card__cta {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 650;
  color: color-mix(in srgb, var(--accent) 78%, #fff);
}

.card__cta svg {
  transition: transform 0.3s var(--ease-out);
}

.card:hover .card__cta svg {
  transform: translateX(4px);
}
</style>