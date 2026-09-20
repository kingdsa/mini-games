<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import JevPanel from './JevPanel.vue'
import {
  EMOTION_MAP,
  INTENT_MAP,
  MAX_MESSAGE_LENGTH,
  SAMPLE_MESSAGES,
  angerTone,
} from './constants'
import { useGfTranslator, type ChatMessage } from './useGfTranslator'

const {
  messages,
  draft,
  busy,
  ai,
  canSend,
  thinkingLabel,
  send,
  regenerateReply,
  useReply,
  toggleAi,
  saveApiKey,
  clearChat,
} = useGfTranslator()

const listEl = ref<HTMLElement | null>(null)
const copiedId = ref<number | null>(null)

function scrollToBottom(): void {
  void nextTick(() => {
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(() => [messages.value.length, busy.value] as const, scrollToBottom, { immediate: true })

function emotionOf(message: ChatMessage) {
  return message.analysis ? EMOTION_MAP[message.analysis.emotion] : null
}

function intentOf(message: ChatMessage): string {
  if (!message.analysis) return ''
  return INTENT_MAP[message.analysis.intent]?.label ?? message.analysis.intent
}

function angerColor(message: ChatMessage): string {
  return message.analysis ? angerTone(message.analysis.anger) : 'inherit'
}

function submit(): void {
  if (!canSend.value) return
  void send(draft.value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}

function fillSample(text: string): void {
  draft.value = text
}

async function copyText(text: string, id: number): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    window.setTimeout(() => {
      if (copiedId.value === id) copiedId.value = null
    }, 1200)
  } catch {
    copiedId.value = null
  }
}
</script>

<template>
  <div class="page gf">
    <div class="container">
      <header class="gf-head">
        <div>
          <span class="tag tag-pink">💬 AI 小工具</span>
          <h1 class="gf-head__title">女友翻译器</h1>
          <p class="gf-head__sub">
            你扮演女朋友输入她说的话，JEV 判断情绪与潜台词，再以你的身份写一条回复
          </p>
        </div>
        <div class="gf-head__actions">
          <button class="btn btn-ghost" :disabled="!messages.length" @click="clearChat">清空对话</button>
        </div>
      </header>

      <div class="layout">
        <!-- 聊天窗口 -->
        <section class="chat glass">
          <header class="chat__head">
            <span class="chat__avatar">💗</span>
            <div class="chat__peer">
              <b>女朋友 · 模拟对话</b>
              <span :class="{ 'is-busy': busy }">{{ busy ? thinkingLabel : '在线' }}</span>
            </div>
            <span class="chat__mode" :class="ai.enabled ? 'is-jev' : 'is-local'">
              {{ ai.enabled && ai.hasKey && !ai.keyInvalid ? 'JEV 模式' : '本地模式' }}
            </span>
          </header>

          <div ref="listEl" class="chat__list">
            <p v-if="!messages.length" class="chat__hint">
              下面输入框里写「她」刚发来的消息，回车发送。<br />
              聊天只保存在当前页面内存里，不会上传保存。
            </p>

            <template v-for="message in messages" :key="message.id">
              <div v-if="message.role === 'her'" class="msg msg--her">
                <span class="msg__avatar">👩</span>
                <div class="msg__body">
                  <div class="msg__bubble">{{ message.text }}</div>
                  <div v-if="message.analysis" class="msg__mood">
                    <span class="msg__chip" :style="{ color: emotionOf(message)?.accent }">
                      {{ emotionOf(message)?.emoji }} {{ emotionOf(message)?.label }}
                    </span>
                    <span class="msg__chip" :style="{ color: angerColor(message) }">
                      生气 {{ message.analysis.anger }}/10
                    </span>
                    <span class="msg__chip">诉求 · {{ intentOf(message) }}</span>
                    <span v-if="message.analysis.trap" class="msg__chip is-trap">🚨 送命题</span>
                    <span class="msg__chip is-source">
                      {{ message.analysis.source === 'jev' ? 'JEV 判定' : '本地兜底' }}
                    </span>
                  </div>
                </div>
              </div>

              <div v-else class="msg msg--me">
                <div class="msg__body">
                  <div class="msg__bubble">{{ message.text }}</div>
                  <div class="msg__mood msg__mood--me">
                    <span class="msg__chip is-source">
                      {{ message.source === 'jev' ? '⚡ JEV 代写' : '本地兜底' }}
                    </span>
                    <button class="msg__copy" @click="copyText(message.text, message.id)">
                      {{ copiedId === message.id ? '已复制 ✓' : '复制' }}
                    </button>
                  </div>
                </div>
                <span class="msg__avatar is-me">🙋</span>
              </div>
            </template>

            <div v-if="busy" class="msg msg--me">
              <div class="msg__body">
                <div class="msg__bubble msg__bubble--typing"><i /><i /><i /></div>
              </div>
              <span class="msg__avatar is-me">🙋</span>
            </div>
          </div>

          <footer class="chat__input">
            <div class="chat__samples">
              <span>示例</span>
              <button v-for="sample in SAMPLE_MESSAGES" :key="sample" @click="fillSample(sample)">
                {{ sample }}
              </button>
            </div>
            <div class="chat__box">
              <textarea
                v-model="draft"
                rows="2"
                :maxlength="MAX_MESSAGE_LENGTH"
                placeholder="输入她说的话（Enter 发送 / Shift+Enter 换行）"
                @keydown="onKeydown"
              />
              <button class="btn btn-primary chat__send" :disabled="!canSend" @click="submit">
                {{ busy ? '生成中…' : '发送' }}
              </button>
            </div>
            <p class="chat__tip">
              你输入 = 她说的话 · JEV 生成 = 你的回复
              <span>{{ draft.length }}/{{ MAX_MESSAGE_LENGTH }}</span>
            </p>
          </footer>
        </section>

        <!-- 右栏 -->
        <aside class="col">
          <JevPanel
            :ai="ai"
            @toggle="toggleAi"
            @save-key="saveApiKey"
            @use-reply="useReply"
            @regenerate="regenerateReply"
          />

          <section class="panel glass">
            <h2 class="panel__title">怎么用</h2>
            <ul class="steps">
              <li><b>1</b><span>在聊天框输入她刚发来的消息</span></li>
              <li><b>2</b><span>JEV 分析情绪 / 生气值 / 潜台词</span></li>
              <li><b>3</b><span>自动生成你的回复并附候选</span></li>
              <li><b>4</b><span>不满意点「换一条」或直接选候选</span></li>
            </ul>
            <p class="notice">
              回复文案来自本地话术模板，由 JEV 挑选最合适的一条；没有 Key 时全程走本地兜底。
            </p>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gf {
  padding-top: 28px;
}

.tag-pink {
  background: rgba(255, 77, 141, 0.14);
  border-color: rgba(255, 77, 141, 0.36);
  color: #ffb3cd;
}

.gf-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.gf-head__title {
  margin-top: 10px;
  font-size: clamp(26px, 4vw, 36px);
}

.gf-head__sub {
  margin-top: 6px;
  color: var(--text-2);
  font-size: 13.5px;
}

.gf-head__actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 330px);
  gap: 20px;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  padding: 16px;
}

.panel__title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 12px;
}

/* ------------------------------ 聊天窗口 ------------------------------ */
.chat {
  display: flex;
  flex-direction: column;
  min-height: min(72vh, 720px);
  overflow: hidden;
}

.chat__head {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
}

.chat__avatar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  background: linear-gradient(140deg, rgba(255, 77, 141, 0.35), rgba(124, 92, 255, 0.3));
  border: 1px solid rgba(255, 77, 141, 0.4);
}

.chat__peer {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.chat__peer b {
  font-size: 14.5px;
}

.chat__peer span {
  font-size: 11.5px;
  color: var(--text-3);
}

.chat__peer span.is-busy {
  color: var(--warn);
}

.chat__mode {
  margin-left: auto;
  padding: 3px 11px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.chat__mode.is-jev {
  color: #1b0a13;
  background: linear-gradient(100deg, #ff8fb8, #a58bff);
}

.chat__mode.is-local {
  color: var(--text-2);
  border: 1px solid var(--border-strong);
}

.chat__list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 16px;
  overflow-y: auto;
  max-height: 62vh;
  scroll-behavior: smooth;
}

.chat__hint {
  text-align: center;
  margin: auto;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text-3);
}

.msg {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  max-width: 86%;
  animation: popIn 0.24s var(--ease-bounce);
}

.msg--her {
  align-self: flex-start;
}

.msg--me {
  align-self: flex-end;
  flex-direction: row;
}

.msg__avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 50%;
  font-size: 17px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--border);
}

.msg__avatar.is-me {
  background: linear-gradient(140deg, rgba(124, 92, 255, 0.4), rgba(34, 211, 238, 0.28));
  border-color: rgba(124, 92, 255, 0.45);
}

.msg__body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.msg--me .msg__body {
  align-items: flex-end;
}

.msg__bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.msg--her .msg__bubble {
  border-top-left-radius: 5px;
  background: rgba(255, 255, 255, 0.075);
  border: 1px solid var(--border);
}

.msg--me .msg__bubble {
  border-top-right-radius: 5px;
  background: linear-gradient(135deg, rgba(255, 77, 141, 0.85), rgba(124, 92, 255, 0.85));
  border: 1px solid rgba(255, 143, 184, 0.45);
  box-shadow: 0 10px 26px -14px rgba(255, 77, 141, 0.9);
}

.msg__bubble--typing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 13px 16px;
}

.msg__bubble--typing i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  animation: typingDot 1s ease-in-out infinite;
}

.msg__bubble--typing i:nth-child(2) {
  animation-delay: 0.16s;
}

.msg__bubble--typing i:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes typingDot {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.msg__mood {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  padding-left: 2px;
}

.msg__mood--me {
  align-self: flex-end;
}

.msg__chip {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid var(--border);
  white-space: nowrap;
}

.msg__chip.is-trap {
  color: #ffd9d9;
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.45);
  font-weight: 800;
}

.msg__chip.is-source {
  color: var(--text-3);
  letter-spacing: 0.04em;
}

.msg__copy {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  color: var(--text-2);
  background: transparent;
  border: 1px solid var(--border-strong);
  transition: all 0.2s var(--ease-out);
}

.msg__copy:hover {
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.1);
}

/* ------------------------------ 输入区 ------------------------------ */
.chat__input {
  padding: 12px 16px 14px;
  border-top: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
}

.chat__samples {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.chat__samples span {
  flex: none;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--text-3);
}

.chat__samples button {
  flex: none;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 11.5px;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  transition: all 0.2s var(--ease-out);
}

.chat__samples button:hover {
  color: var(--text-1);
  border-color: rgba(255, 77, 141, 0.5);
  transform: translateY(-1px);
}

.chat__box {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.chat__box textarea {
  flex: 1;
  min-width: 0;
  resize: none;
  padding: 11px 13px;
  border-radius: 14px;
  border: 1px solid var(--border-strong);
  background: rgba(0, 0, 0, 0.32);
  color: var(--text-1);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.55;
}

.chat__box textarea:focus {
  outline: none;
  border-color: rgba(255, 77, 141, 0.6);
  box-shadow: 0 0 0 3px rgba(255, 77, 141, 0.14);
}

.chat__box textarea::placeholder {
  color: var(--text-3);
}

.chat__send {
  flex: none;
  padding: 11px 22px;
}

.chat__tip {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  font-size: 10.5px;
  color: var(--text-3);
}

.chat__tip span {
  font-variant-numeric: tabular-nums;
}

/* ------------------------------ 右栏说明 ------------------------------ */
.steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12.5px;
}

.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.steps b {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: 50%;
  font-size: 11px;
  color: #1b0a13;
  background: linear-gradient(140deg, #ff8fb8, #ff4d8d);
}

.steps span {
  color: var(--text-2);
}

.notice {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-3);
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .chat__list {
    max-height: none;
    min-height: 300px;
  }
}
</style>