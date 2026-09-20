<script setup lang="ts">
import { computed, ref } from 'vue'
import { JEV_KEYS_URL } from '@/lib/typesafe'
import { EMOTION_MAP, INTENT_MAP, angerLabel, angerTone } from './constants'
import type { GfAiState } from './useGfTranslator'

const props = defineProps<{ ai: GfAiState }>()
const emit = defineEmits<{
  toggle: []
  saveKey: [key: string]
  useReply: [id: string]
  regenerate: []
}>()

const keyDraft = ref('')

const statusLabel = computed(() => {
  if (!props.ai.enabled) return '未开启 · 本地兜底模式'
  switch (props.ai.status) {
    case 'analyzing':
      return 'JEV 正在解析她的情绪…'
    case 'replying':
      return 'JEV 正在斟酌回复…'
    case 'idle':
      return '待命 · 输入她说的话'
    default:
      return '待命'
  }
})

const statusTone = computed(() => {
  if (!props.ai.enabled) return 'idle'
  if (props.ai.status === 'analyzing' || props.ai.status === 'replying') return 'busy'
  return 'ready'
})

const analysis = computed(() => props.ai.analysis)
const emotionDef = computed(() => (analysis.value ? EMOTION_MAP[analysis.value.emotion] : null))
const intentLabel = computed(() =>
  analysis.value ? (INTENT_MAP[analysis.value.intent]?.label ?? analysis.value.intent) : '—',
)
const topEmotions = computed(() => analysis.value?.rankedEmotions.slice(0, 4) ?? [])
const reply = computed(() => props.ai.reply)
const confidencePct = computed(() =>
  analysis.value ? Math.round(analysis.value.confidence * 100) : 0,
)
const replyConfidencePct = computed(() => (reply.value ? Math.round(reply.value.probability * 100) : 0))
const tokens = computed(() =>
  analysis.value ? analysis.value.inputTokens + analysis.value.outputTokens : 0,
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

function submitKey(): void {
  const value = keyDraft.value.trim()
  if (!value || props.ai.checkingKey) return
  emit('saveKey', value)
  keyDraft.value = ''
}
</script>

<template>
  <section class="panel glass gfp">
    <header class="gfp__head">
      <div class="gfp__brand">
        <span class="gfp__pulse" :class="`is-${statusTone}`" />
        <div>
          <h2 class="gfp__title">JEV 情感分析</h2>
          <p class="gfp__model">
            {{ analysis ? `${analysis.model} · ${analysis.source === 'jev' ? 'TypeSafe 判定' : '本地兜底'}` : 'TypeSafe System One' }}
          </p>
        </div>
      </div>
      <button
        class="gfp__switch"
        :class="{ 'is-on': ai.enabled, 'is-locked': !ai.enabled && (!ai.hasKey || ai.keyInvalid) }"
        role="switch"
        :aria-checked="ai.enabled"
        :title="ai.enabled ? '关闭 JEV' : ai.hasKey && !ai.keyInvalid ? '开启 JEV' : '需先填写有效的 API Key'"
        @click="$emit('toggle')"
      >
        <span class="gfp__knob" />
      </button>
    </header>

    <p class="gfp__status">{{ statusLabel }}</p>

    <div v-if="!ai.hasKey || ai.keyInvalid" class="gfp__key" :class="{ 'is-invalid': ai.keyInvalid }">
      <p class="gfp__key-tip">
        <template v-if="ai.keyInvalid">API Key 无效，请重新输入后再开启 JEV。</template>
        <template v-else>开启 JEV 需要 TypeSafe API Key，只保存在本机浏览器。</template>
        <a class="gfp__key-link" :href="JEV_KEYS_URL" target="_blank" rel="noopener noreferrer">获取 API Key ↗</a>
      </p>
      <div class="gfp__key-row">
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
    <p v-else class="gfp__key-hint">KEY {{ ai.maskedKey }} · 仅存本地</p>

    <p v-if="ai.error" class="gfp__error">{{ ai.error }}</p>

    <template v-if="analysis && emotionDef">
      <div class="gfp__mood">
        <span class="gfp__emoji">{{ emotionDef.emoji }}</span>
        <div class="gfp__mood-main">
          <span class="gfp__mood-label" :style="{ color: emotionDef.accent }">{{ emotionDef.label }}</span>
          <span class="gfp__mood-sub">诉求 · {{ intentLabel }}</span>
        </div>
        <span class="gfp__badge" :class="analysis.source === 'jev' ? 'is-jev' : 'is-fallback'">
          {{ analysis.source === 'jev' ? 'JEV' : '兜底' }}
        </span>
      </div>

      <div class="gfp__meter">
        <div class="gfp__meter-head">
          <span>生气指数</span>
          <b :style="{ color: angerTone(analysis.anger) }">
            {{ analysis.anger }}/10 · {{ angerLabel(analysis.anger) }}
          </b>
        </div>
        <div class="gfp__meter-track">
          <span
            class="gfp__meter-fill"
            :style="{ width: `${analysis.anger * 10}%`, background: angerTone(analysis.anger) }"
          />
        </div>
      </div>

      <p v-if="analysis.trap" class="gfp__trap">🚨 送命题预警：别按字面意思回答</p>

      <p class="gfp__advice">建议：{{ emotionDef.advice }}</p>

      <div class="gfp__rank">
        <h3 class="gfp__subtitle">情绪概率分布</h3>
        <ul>
          <li v-for="item in topEmotions" :key="item.id" :class="{ 'is-chosen': item.chosen }">
            <span class="gfp__rank-label">{{ item.emoji }} {{ item.label }}</span>
            <span class="gfp__rank-bar"><i :style="{ width: barWidth(item.probability) }" /></span>
            <span class="gfp__rank-num">{{ pct(item.probability) }}</span>
          </li>
        </ul>
      </div>

      <p class="gfp__meta">
        情绪置信 {{ confidencePct }}% · {{ analysis.latencyMs }}ms · {{ tokens }} tokens ·
        {{ formatTime(analysis.at) }}
      </p>
    </template>

    <template v-if="reply">
      <div class="gfp__reply">
        <div class="gfp__reply-head">
          <span class="gfp__reply-tone">{{ reply.tone }}</span>
          <span class="gfp__badge" :class="ai.replySource === 'jev' ? 'is-jev' : 'is-fallback'">
            {{ ai.replySource === 'jev' ? 'JEV 选稿' : '本地兜底' }}
          </span>
        </div>
        <p class="gfp__reply-text">{{ reply.text }}</p>
        <div class="gfp__reply-actions">
          <button class="btn btn-ghost gfp__regen" :disabled="ai.status === 'replying'" @click="$emit('regenerate')">
            🔄 换一条
          </button>
          <span v-if="ai.replySource === 'jev'" class="gfp__reply-conf">选中概率 {{ replyConfidencePct }}%</span>
        </div>
      </div>

      <p v-if="ai.replyError" class="gfp__error">{{ ai.replyError }}</p>

      <div v-if="ai.rankedReplies.length > 1" class="gfp__rank">
        <h3 class="gfp__subtitle">候选回复（点击切换）</h3>
        <ul class="gfp__replies">
          <li
            v-for="item in ai.rankedReplies"
            :key="item.id"
            :class="{ 'is-chosen': item.chosen }"
            @click="$emit('useReply', item.id)"
          >
            <span class="gfp__reply-item-tone">{{ item.tone }}</span>
            <span class="gfp__reply-item-text">{{ item.text }}</span>
            <span v-if="ai.replySource === 'jev'" class="gfp__rank-num">{{ pct(item.probability) }}</span>
          </li>
        </ul>
      </div>
    </template>

    <p v-else-if="!analysis" class="gfp__empty">
      在下方输入框里输入「她」说的话，JEV 会判断情绪、潜台词，并替你写一条回复。
    </p>

    <div class="gfp__stats">
      <div><span>回合</span><b>{{ ai.turns }}</b></div>
      <div><span>决策</span><b>{{ ai.decisions }}</b></div>
      <div><span>平均</span><b>{{ ai.avgLatency }}ms</b></div>
      <div><span>兜底</span><b>{{ ai.fallbacks }}</b></div>
      <div><span>输入</span><b>{{ ai.inputTokens }}</b></div>
      <div><span>输出</span><b>{{ ai.outputTokens }}</b></div>
    </div>
  </section>
</template>

<style scoped>
.gfp {
  padding: 16px;
}

.gfp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.gfp__brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.gfp__pulse {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  background: var(--text-3);
}

.gfp__pulse.is-ready {
  background: var(--brand-3);
  animation: pulseGlow 1.6s ease-out infinite;
}

.gfp__pulse.is-busy {
  background: var(--warn);
  animation: pulseGlow 0.9s ease-out infinite;
}

.gfp__title {
  font-size: 13px;
  letter-spacing: 0.16em;
}

.gfp__model {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.gfp__switch {
  position: relative;
  width: 46px;
  height: 26px;
  flex: none;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: rgba(255, 255, 255, 0.08);
  transition: background 0.24s var(--ease-out), border-color 0.24s;
}

.gfp__switch.is-on {
  background: linear-gradient(120deg, var(--brand-3), var(--brand));
  border-color: transparent;
  box-shadow: 0 0 18px -4px rgba(255, 77, 141, 0.9);
}

.gfp__switch.is-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.gfp__knob {
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

.gfp__switch.is-on .gfp__knob {
  transform: translateX(20px);
}

.gfp__status {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-2);
}

.gfp__key {
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.28);
}

.gfp__key.is-invalid {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.4);
}

.gfp__key-tip {
  font-size: 11px;
  line-height: 1.5;
  color: #f3d08a;
}

.gfp__key.is-invalid .gfp__key-tip {
  color: #ffc9c9;
}

.gfp__key-link {
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}

.gfp__key-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.gfp__key-row input {
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

.gfp__key-row input:focus {
  outline: none;
  border-color: rgba(255, 77, 141, 0.6);
}

.gfp__key-row input:disabled {
  opacity: 0.6;
}

.gfp__key-row .btn {
  padding: 6px 12px;
  font-size: 12px;
}

.gfp__key-hint {
  margin-top: 8px;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.gfp__error {
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

.gfp__mood {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: linear-gradient(140deg, rgba(255, 77, 141, 0.16), rgba(124, 92, 255, 0.12));
  border: 1px solid rgba(255, 77, 141, 0.38);
}

.gfp__emoji {
  font-size: 22px;
  line-height: 1;
}

.gfp__mood-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.gfp__mood-label {
  font-size: 14px;
  font-weight: 800;
}

.gfp__mood-sub {
  font-size: 10.5px;
  color: var(--text-3);
}

.gfp__badge {
  margin-left: auto;
  flex: none;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.gfp__badge.is-jev {
  color: #04121c;
  background: linear-gradient(100deg, #7df9ff, #a58bff);
}

.gfp__badge.is-fallback {
  color: #402000;
  background: linear-gradient(100deg, #fbbf24, #fb923c);
}

.gfp__meter {
  margin-top: 12px;
}

.gfp__meter-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-3);
}

.gfp__meter-head b {
  font-variant-numeric: tabular-nums;
}

.gfp__meter-track {
  margin-top: 5px;
  height: 7px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.09);
  overflow: hidden;
}

.gfp__meter-fill {
  display: block;
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s var(--ease-out);
}

.gfp__trap {
  margin-top: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 11.5px;
  font-weight: 700;
  color: #ffd9d9;
  background: rgba(239, 68, 68, 0.16);
  border: 1px solid rgba(239, 68, 68, 0.42);
  animation: pulseGlow 1.6s ease-out infinite;
}

.gfp__advice {
  margin-top: 9px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-2);
}

.gfp__subtitle {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin: 14px 0 7px;
}

.gfp__rank ul {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 168px;
  overflow-y: auto;
}

.gfp__rank li {
  display: grid;
  grid-template-columns: minmax(0, auto) 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 3px 6px;
  border-radius: 7px;
  font-size: 10.5px;
  color: var(--text-2);
}

.gfp__rank li.is-chosen {
  background: rgba(255, 77, 141, 0.14);
  color: var(--text-1);
  font-weight: 700;
}

.gfp__rank-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 96px;
}

.gfp__rank-bar {
  height: 5px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.gfp__rank-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, rgba(255, 77, 141, 0.9), rgba(124, 92, 255, 0.9));
  transition: width 0.35s var(--ease-out);
}

.gfp__rank-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.gfp__meta {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.gfp__reply {
  margin-top: 12px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-strong);
}

.gfp__reply-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gfp__reply-tone {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #1b0a13;
  background: linear-gradient(100deg, #ff8fb8, #ff4d8d);
}

.gfp__reply-text {
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-1);
}

.gfp__reply-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 9px;
}

.gfp__regen {
  padding: 5px 12px;
  font-size: 11.5px;
}

.gfp__reply-conf {
  font-size: 10px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.gfp__rank .gfp__replies li {
  grid-template-columns: auto 1fr auto;
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.gfp__rank .gfp__replies li:hover {
  background: rgba(255, 255, 255, 0.08);
}

.gfp__reply-item-tone {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--text-2);
  border: 1px solid var(--border);
  white-space: nowrap;
}

.gfp__reply-item-text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gfp__empty {
  margin-top: 12px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-3);
}

.gfp__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 14px;
}

.gfp__stats div {
  display: flex;
  flex-direction: column;
  padding: 7px 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--border);
}

.gfp__stats span {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}

.gfp__stats b {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
</style>