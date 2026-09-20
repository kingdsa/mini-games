import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { getJevKey, JevAuthError, maskJevKey, setJevKey, verifyJevKey } from '@/lib/typesafe'
import { MAX_MESSAGE_LENGTH } from './constants'
import {
  analyzeMood,
  chooseReply,
  fallbackReplyDecision,
  localAnalyze,
  type ChatTurn,
  type MoodAnalysis,
  type ReplyCandidate,
  type ReplyDecision,
} from './jev'

export interface ChatMessage {
  id: number
  role: 'her' | 'me'
  text: string
  at: number
  analysis?: MoodAnalysis
  reply?: ReplyCandidate
  source?: 'jev' | 'fallback'
}

export interface GfAiState {
  enabled: boolean
  status: 'off' | 'idle' | 'analyzing' | 'replying'
  hasKey: boolean
  keyInvalid: boolean
  maskedKey: string
  checkingKey: boolean
  error: string
  turns: number
  decisions: number
  fallbacks: number
  avgLatency: number
  inputTokens: number
  outputTokens: number
  analysis: MoodAnalysis | null
  reply: ReplyCandidate | null
  replySource: 'jev' | 'fallback'
  rankedReplies: ReplyCandidate[]
  replyError: string
}

export function useGfTranslator() {
  const messages = ref<ChatMessage[]>([])
  const draft = ref('')
  const busy = ref(false)

  const ai = reactive<GfAiState>({
    enabled: false,
    status: 'off',
    hasKey: false,
    keyInvalid: false,
    maskedKey: '',
    checkingKey: false,
    error: '',
    turns: 0,
    decisions: 0,
    fallbacks: 0,
    avgLatency: 0,
    inputTokens: 0,
    outputTokens: 0,
    analysis: null,
    reply: null,
    replySource: 'jev',
    rankedReplies: [],
    replyError: '',
  })

  let nextId = 1
  let runToken = 0
  let latencySum = 0
  let latencyCount = 0

  const canSend = computed(
    () => !busy.value && draft.value.trim().length > 0 && draft.value.length <= MAX_MESSAGE_LENGTH,
  )

  const jevActive = computed(() => ai.enabled && ai.hasKey && !ai.keyInvalid)

  const thinkingLabel = computed(() => {
    if (!busy.value) return ''
    return ai.status === 'replying' ? 'JEV 正在斟酌回复…' : 'JEV 正在解析她的情绪…'
  })

  function history(): ChatTurn[] {
    return messages.value.map((message) => ({ role: message.role, text: message.text }))
  }

  function trackLatency(ms: number): void {
    latencySum += ms
    latencyCount += 1
    ai.avgLatency = Math.round(latencySum / latencyCount)
  }

  function recordAnalysis(analysis: MoodAnalysis): void {
    ai.analysis = analysis
    if (analysis.source === 'fallback') ai.fallbacks += 1
    ai.inputTokens += analysis.inputTokens
    ai.outputTokens += analysis.outputTokens
    trackLatency(analysis.latencyMs)
  }

  function recordReply(decision: ReplyDecision): void {
    ai.reply = decision.reply
    ai.replySource = decision.source
    ai.rankedReplies = decision.ranked
    ai.replyError = decision.source === 'fallback' ? decision.error : ''
    ai.decisions += 1
    if (decision.source === 'fallback') ai.fallbacks += 1
    ai.inputTokens += decision.inputTokens
    ai.outputTokens += decision.outputTokens
    trackLatency(decision.latencyMs)
  }

  function invalidateKey(message: string): void {
    setJevKey('')
    ai.enabled = false
    ai.status = 'off'
    ai.hasKey = Boolean(getJevKey())
    ai.maskedKey = maskJevKey(getJevKey())
    ai.keyInvalid = true
    ai.error = message || 'API Key 无效，请重新输入'
  }

  function pushMeMessage(decision: ReplyDecision): void {
    messages.value.push({
      id: nextId++,
      role: 'me',
      text: decision.reply.text,
      at: Date.now(),
      reply: decision.reply,
      source: decision.source,
    })
  }

  async function send(raw: string): Promise<void> {
    if (busy.value) return
    const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!text) return

    const past = history()
    messages.value.push({ id: nextId++, role: 'her', text, at: Date.now() })
    ai.turns += 1
    draft.value = ''
    busy.value = true
    const token = ++runToken

    try {
      let analysis: MoodAnalysis
      let decision: ReplyDecision

      if (jevActive.value) {
        ai.error = ''
        ai.status = 'analyzing'
        try {
          analysis = await analyzeMood(text, past)
        } catch (error) {
          if (error instanceof JevAuthError) {
            invalidateKey(error.message)
            analysis = localAnalyze(text, error.message)
          } else {
            analysis = localAnalyze(text, error instanceof Error ? error.message : '未知错误')
          }
        }
        if (token !== runToken) return
        recordAnalysis(analysis)

        const herMessage = messages.value[messages.value.length - 1]
        if (herMessage && herMessage.role === 'her') herMessage.analysis = analysis

        ai.status = 'replying'
        try {
          decision = await chooseReply(text, past, analysis)
        } catch (error) {
          if (error instanceof JevAuthError) {
            invalidateKey(error.message)
            decision = fallbackReplyDecision(analysis, error.message)
          } else {
            decision = fallbackReplyDecision(
              analysis,
              error instanceof Error ? error.message : '未知错误',
            )
          }
        }
      } else {
        analysis = localAnalyze(text)
        decision = fallbackReplyDecision(analysis)
        recordAnalysis(analysis)
        const herMessage = messages.value[messages.value.length - 1]
        if (herMessage && herMessage.role === 'her') herMessage.analysis = analysis
      }

      if (token !== runToken) return
      recordReply(decision)
      pushMeMessage(decision)
    } finally {
      if (token === runToken) {
        busy.value = false
        ai.status = ai.enabled ? 'idle' : 'off'
      }
    }
  }

  function lastMeIndex(): number {
    for (let index = messages.value.length - 1; index >= 0; index--) {
      if (messages.value[index].role === 'me') return index
    }
    return -1
  }

  /** 换一条：保留她的消息与情绪判断，只重新选择回复 */
  async function regenerateReply(): Promise<void> {
    if (busy.value) return
    const analysis = ai.analysis
    const index = lastMeIndex()
    if (!analysis || index < 0) return

    const previous = messages.value[index].reply
    const lastHer = [...messages.value]
      .reverse()
      .find((message): message is ChatMessage & { analysis: MoodAnalysis } => message.role === 'her' && Boolean(message.analysis))
    if (!lastHer) return

    const past: ChatTurn[] = messages.value
      .slice(0, messages.value.indexOf(lastHer))
      .map((message) => ({ role: message.role, text: message.text }))

    busy.value = true
    const token = ++runToken
    try {
      let decision: ReplyDecision
      if (jevActive.value) {
        ai.status = 'replying'
        try {
          decision = await chooseReply(lastHer.text, past, analysis, previous?.id ?? '')
        } catch (error) {
          if (error instanceof JevAuthError) {
            invalidateKey(error.message)
            decision = fallbackReplyDecision(analysis, error.message, previous?.id ?? '')
          } else {
            decision = fallbackReplyDecision(
              analysis,
              error instanceof Error ? error.message : '未知错误',
              previous?.id ?? '',
            )
          }
        }
      } else {
        decision = fallbackReplyDecision(analysis, '', previous?.id ?? '')
      }

      if (token !== runToken) return
      recordReply(decision)
      const target = messages.value[index]
      target.text = decision.reply.text
      target.reply = decision.reply
      target.source = decision.source
    } finally {
      if (token === runToken) {
        busy.value = false
        ai.status = ai.enabled ? 'idle' : 'off'
      }
    }
  }

  /** 直接选用某条候选回复 */
  function useReply(id: string): void {
    const candidate = ai.rankedReplies.find((item) => item.id === id)
    const index = lastMeIndex()
    if (!candidate || index < 0) return
    const chosen: ReplyCandidate = { ...candidate, chosen: true }
    const target = messages.value[index]
    target.text = chosen.text
    target.reply = chosen
    ai.reply = chosen
    ai.rankedReplies = ai.rankedReplies.map((item) => ({ ...item, chosen: item.id === id }))
  }

  function toggleAi(): void {
    if (ai.checkingKey) return
    if (!ai.enabled && (!ai.hasKey || ai.keyInvalid)) {
      ai.error = ai.keyInvalid
        ? 'API Key 无效，请重新输入后再开启 JEV'
        : '请先填写 TypeSafe API Key 再开启 JEV'
      return
    }
    ai.enabled = !ai.enabled
    ai.error = ''
    ai.status = ai.enabled ? 'idle' : 'off'
  }

  async function saveApiKey(key: string): Promise<void> {
    ai.checkingKey = true
    ai.keyInvalid = false
    ai.error = ''
    try {
      await verifyJevKey(key)
      setJevKey(key)
      ai.hasKey = true
      ai.maskedKey = maskJevKey(key)
    } catch (error) {
      if (error instanceof JevAuthError) {
        setJevKey('')
        ai.hasKey = Boolean(getJevKey())
        ai.maskedKey = maskJevKey(getJevKey())
        ai.keyInvalid = true
        ai.error = 'API Key 无效，请重新输入'
      } else {
        ai.error = error instanceof Error ? error.message : 'API Key 校验失败，请重试'
      }
    } finally {
      ai.checkingKey = false
    }
  }

  function clearChat(): void {
    runToken += 1
    messages.value = []
    draft.value = ''
    busy.value = false
    ai.status = ai.enabled ? 'idle' : 'off'
    ai.error = ''
    ai.turns = 0
    ai.decisions = 0
    ai.fallbacks = 0
    ai.avgLatency = 0
    ai.inputTokens = 0
    ai.outputTokens = 0
    ai.analysis = null
    ai.reply = null
    ai.rankedReplies = []
    ai.replyError = ''
    latencySum = 0
    latencyCount = 0
  }

  onMounted(() => {
    const key = getJevKey()
    ai.hasKey = Boolean(key)
    ai.maskedKey = maskJevKey(key)
  })

  onBeforeUnmount(() => {
    runToken += 1
  })

  return {
    messages,
    draft,
    busy,
    ai,
    canSend,
    jevActive,
    thinkingLabel,
    send,
    regenerateReply,
    useReply,
    toggleAi,
    saveApiKey,
    clearChat,
  }
}