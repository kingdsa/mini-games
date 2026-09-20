<script setup lang="ts">
import { computed, ref } from 'vue'
import CandySprite from './CandySprite.vue'
import { CANDIES } from './constants'
import { JEV_KEYS_URL } from '@/lib/typesafe'
import type { Match3AiState } from './useMatch3'

const props = defineProps<{ ai: Match3AiState }>()
const emit = defineEmits<{ toggle: []; confirm: []; saveKey: [key: string] }>()

const keyDraft = ref('')

const statusLabel = computed(() => {
  if (!props.ai.enabled) return '未开启'
  switch (props.ai.status) {
    case 'confirm':
      return '已进入新关卡 · 等待确认'
    case 'waiting':
      return '待命 · 等待棋盘就绪'
    case 'thinking':
      return 'Jev 思考中…'
    case 'acting':
      return '执行交换'
    case 'levelEnd':
      return '本关结束 · 等待进入下一关'
    default:
      return '待命'
  }
})

const statusTone = computed(() => {
  if (!props.ai.enabled) return 'idle'
  if (props.ai.status === 'thinking') return 'busy'
  if (props.ai.status === 'acting') return 'active'
  if (props.ai.status === 'confirm') return 'confirm'
  if (props.ai.status === 'levelEnd') return 'restart'
  return 'ready'
})

const decision = computed(() => props.ai.decision)
const topOptions = computed(() => props.ai.ranked.slice(0, 12))
const history = computed(() => props.ai.history.slice(0, 7))

const confidencePct = computed(() =>
  decision.value
    ? Math.round(decision.value.confidence <= 1 ? decision.value.confidence * 100 : decision.value.confidence)
    : 0,
)

const tokens = computed(() =>
  decision.value ? decision.value.inputTokens + decision.value.outputTokens : 0,
)

function pct(value: number): string {
  const n = value * 100
  return `${n >= 99.5 ? 100 : n.toFixed(1)}%`
}

function barWidth(value: number): string {
  return `${Math.max(2, Math.min(100, value * 100))}%`
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('zh-CN', { hour12: false })
}

function candyGlow(type: number): string {
  return CANDIES[type]?.glow ?? '#fff'
}

function submitKey(): void {
  const value = keyDraft.value.trim()
  if (!value || props.ai.checkingKey) return
  emit('saveKey', value)
  keyDraft.value = ''
}
</script>

<template>
  <section class="panel glass jev">
    <header class="jev__head">
      <div class="jev__brand">
        <span class="jev__pulse" :class="`is-${statusTone}`" />
        <div>
          <h2 class="jev__title">JEV 外挂</h2>
          <p class="jev__model">
            {{ decision ? `${decision.model} · ${decision.source === 'jev' ? 'TypeSafe 决策' : '本地兜底'}` : 'TypeSafe System One' }}
          </p>
        </div>
      </div>
      <button
        class="jev__switch"
        :class="{ 'is-on': ai.enabled, 'is-locked': !ai.enabled && (!ai.hasKey || ai.keyInvalid) }"
        role="switch"
        :aria-checked="ai.enabled"
        :title="ai.enabled ? '关闭外挂' : ai.hasKey && !ai.keyInvalid ? '开启外挂' : '需先填写有效的 API Key'"
        @click="$emit('toggle')"
      >
        <span class="jev__knob" />
      </button>
    </header>

    <p class="jev__status">{{ statusLabel }}</p>

    <div v-if="!ai.hasKey || ai.keyInvalid" class="jev__key" :class="{ 'is-invalid': ai.keyInvalid }">
      <p class="jev__key-tip">
        <template v-if="ai.keyInvalid">API Key 无效，请重新输入后再开启外挂。</template>
        <template v-else>开启 JEV 外挂需要 TypeSafe API Key，只保存在本机浏览器。</template>
        <a class="jev__key-link" :href="JEV_KEYS_URL" target="_blank" rel="noopener noreferrer">获取 API Key ↗</a>
      </p>
      <div class="jev__key-row">
        <input
          v-model="keyDraft"
          type="password"
          placeholder="apikey_..."
          autocomplete="off"
          spellcheck="false"
          :disabled="ai.checkingKey"
          @keyup.enter="submitKey"
        />
        <button class="btn btn-ghost" :disabled="ai.checkingKey || !keyDraft.trim()" @click="submitKey">
          {{ ai.checkingKey ? '校验中…' : '保存并校验' }}
        </button>
      </div>
    </div>
    <p v-else class="jev__key-hint">KEY {{ ai.maskedKey }} · 仅存本地</p>

    <button v-if="ai.enabled && ai.status === 'confirm'" class="jev__confirm" @click="$emit('confirm')">
      ⚡ 点击确认，开启 JEV 外挂
      <small>确认后 Jev 才会接管本关</small>
    </button>

    <p v-if="ai.error" class="jev__error">{{ ai.error }}</p>

    <template v-if="decision">
      <div class="jev__choice">
        <span class="jev__candy"><CandySprite :type="decision.move.typeA" /></span>
        <span class="jev__swap">↔</span>
        <span class="jev__candy"><CandySprite :type="decision.move.typeB" /></span>
        <div class="jev__choice-main">
          <span class="jev__choice-label">{{ decision.move.label }}</span>
          <span class="jev__choice-sub">
            预估 +{{ decision.move.avgScore }} · 连锁 ×{{ decision.move.maxChain }} · 消
            {{ decision.move.avgCleared }} 颗
          </span>
        </div>
        <span class="jev__badge" :class="decision.source === 'jev' ? 'is-jev' : 'is-fallback'">
          {{ decision.source === 'jev' ? 'JEV' : '兜底' }}
        </span>
      </div>

      <div class="jev__meter">
        <div class="jev__meter-head">
          <span>置信度</span>
          <b>{{ confidencePct }}%</b>
        </div>
        <div class="jev__meter-track">
          <span class="jev__meter-fill" :style="{ width: `${confidencePct}%` }" />
        </div>
        <p class="jev__meta">{{ decision.latencyMs }}ms · {{ tokens }} tokens · {{ formatTime(decision.at) }}</p>
      </div>

      <div class="jev__rank">
        <h3 class="jev__subtitle">候选交换概率</h3>
        <ul>
          <li v-for="option in topOptions" :key="option.id" :class="{ 'is-chosen': option.chosen }">
            <span class="jev__rank-label">{{ option.label }}</span>
            <span class="jev__rank-bar"><i :style="{ width: barWidth(option.probability) }" /></span>
            <span class="jev__rank-num">{{ pct(option.probability) }}</span>
          </li>
        </ul>
      </div>
    </template>
    <p v-else class="jev__empty">开启后 Jev 将接管每一步交换，自动冲击高分与连锁。</p>

    <div v-if="history.length" class="jev__history">
      <h3 class="jev__subtitle">决策历史</h3>
      <ul>
        <li v-for="(item, i) in history" :key="`${item.at}-${i}`">
          <span class="jev__history-dot" :style="{ background: candyGlow(item.move.typeA) }" />
          <span class="jev__history-label">{{ item.move.label }}</span>
          <span class="jev__history-score">+{{ item.move.avgScore }}</span>
          <span class="jev__history-conf">{{ Math.round(item.confidence * 100) }}%</span>
        </li>
      </ul>
    </div>

    <div class="jev__stats">
      <div><span>过关</span><b>{{ ai.levels }}</b></div>
      <div><span>决策</span><b>{{ ai.decisions }}</b></div>
      <div><span>平均</span><b>{{ ai.avgLatency }}ms</b></div>
      <div><span>兜底</span><b>{{ ai.fallbacks }}</b></div>
      <div><span>输入</span><b>{{ ai.inputTokens }}</b></div>
      <div><span>输出</span><b>{{ ai.outputTokens }}</b></div>
    </div>
  </section>
</template>

<style scoped>
.jev {
  padding: 16px;
}

.jev__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.jev__brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.jev__pulse {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  background: var(--text-3);
  box-shadow: 0 0 0 0 rgba(124, 92, 255, 0.5);
}

.jev__pulse.is-ready {
  background: var(--brand-2);
  animation: pulseGlow 1.6s ease-out infinite;
}

.jev__pulse.is-busy {
  background: var(--warn);
  animation: pulseGlow 0.9s ease-out infinite;
}

.jev__pulse.is-active {
  background: var(--success);
}

.jev__pulse.is-confirm {
  background: #ff4d8d;
  animation: pulseGlow 1.1s ease-out infinite;
}

.jev__pulse.is-restart {
  background: var(--brand-3);
  animation: pulseGlow 1.1s ease-out infinite;
}

.jev__title {
  font-size: 13px;
  letter-spacing: 0.16em;
}

.jev__model {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.jev__switch {
  position: relative;
  width: 46px;
  height: 26px;
  flex: none;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: rgba(255, 255, 255, 0.08);
  transition: background 0.24s var(--ease-out), border-color 0.24s;
}

.jev__switch.is-on {
  background: linear-gradient(120deg, #ff4d8d, #a855f7);
  border-color: transparent;
  box-shadow: 0 0 18px -4px rgba(255, 77, 141, 0.9);
}

.jev__switch.is-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.jev__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition: transform 0.24s var(--ease-bounce);
}

.jev__switch.is-on .jev__knob {
  transform: translateX(20px);
}

.jev__status {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-2);
}

.jev__confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  margin-top: 10px;
  padding: 11px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
  color: #1b0a13;
  background: linear-gradient(100deg, #ffe259, #ff4d8d);
  border: none;
  box-shadow: 0 10px 26px -12px rgba(255, 77, 141, 0.95);
  animation: pulseGlow 1.8s ease-out infinite;
}

.jev__confirm small {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.7;
}

.jev__key {
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.28);
}

.jev__key.is-invalid {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.4);
}

.jev__key-tip {
  font-size: 11px;
  line-height: 1.5;
  color: #f3d08a;
}

.jev__key.is-invalid .jev__key-tip {
  color: #ffc9c9;
}

.jev__key-link {
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}

.jev__key-row input:disabled {
  opacity: 0.6;
}

.jev__key-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.jev__key-row input {
  flex: 1;
  min-width: 0;
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text-1);
  font-size: 11.5px;
  font-family: inherit;
}

.jev__key-row input:focus {
  outline: none;
  border-color: rgba(255, 77, 141, 0.6);
}

.jev__key-row .btn {
  padding: 6px 12px;
  font-size: 12px;
}

.jev__key-hint {
  margin-top: 8px;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.jev__error {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  line-height: 1.45;
  color: #ffc9c9;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.35);
  word-break: break-all;
}

.jev__choice {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: linear-gradient(140deg, rgba(251, 191, 36, 0.16), rgba(255, 77, 141, 0.12));
  border: 1px solid rgba(251, 191, 36, 0.4);
}

.jev__candy {
  width: 26px;
  height: 26px;
  flex: none;
}

.jev__swap {
  flex: none;
  font-size: 11px;
  color: var(--text-3);
}

.jev__choice-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.jev__choice-label {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.jev__choice-sub {
  font-size: 10.5px;
  color: var(--text-3);
}

.jev__badge {
  margin-left: auto;
  flex: none;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.jev__badge.is-jev {
  color: #1b0a13;
  background: linear-gradient(100deg, #ffe259, #ff8fb8);
}

.jev__badge.is-fallback {
  color: #402000;
  background: linear-gradient(100deg, #fbbf24, #fb923c);
}

.jev__meter {
  margin-top: 12px;
}

.jev__meter-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-3);
}

.jev__meter-head b {
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.jev__meter-track {
  margin-top: 5px;
  height: 7px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.09);
  overflow: hidden;
}

.jev__meter-fill {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #ff4d8d, #a855f7);
  box-shadow: 0 0 12px rgba(255, 77, 141, 0.7);
  transition: width 0.4s var(--ease-out);
}

.jev__meta {
  margin-top: 5px;
  font-size: 10px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.jev__subtitle {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin: 14px 0 7px;
}

.jev__rank ul,
.jev__history ul {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 158px;
  overflow-y: auto;
}

.jev__rank li {
  display: grid;
  grid-template-columns: minmax(0, auto) 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 3px 6px;
  border-radius: 7px;
  font-size: 10.5px;
  color: var(--text-2);
}

.jev__rank li.is-chosen {
  background: rgba(251, 191, 36, 0.12);
  color: var(--text-1);
  font-weight: 700;
}

.jev__rank-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 104px;
}

.jev__rank-bar {
  height: 5px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.jev__rank-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, rgba(168, 85, 247, 0.9), rgba(255, 77, 141, 0.9));
  transition: width 0.35s var(--ease-out);
}

.jev__rank li.is-chosen .jev__rank-bar i {
  background: linear-gradient(90deg, #fbbf24, #fb923c);
}

.jev__rank-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.jev__history li {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 6px;
  border-radius: 7px;
  font-size: 10.5px;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.03);
}

.jev__history-dot {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.jev__history-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.jev__history-score {
  color: var(--success);
  font-variant-numeric: tabular-nums;
}

.jev__history-conf {
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
}

.jev__empty {
  margin-top: 12px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-3);
}

.jev__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 14px;
}

.jev__stats div {
  display: flex;
  flex-direction: column;
  padding: 7px 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--border);
}

.jev__stats span {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}

.jev__stats b {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
</style>