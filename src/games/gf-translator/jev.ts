import {
  askJev,
  JevAuthError,
  type ChoiceAnswer,
  type JevQuestion,
  type NoulAnswer,
} from '@/lib/typesafe'
import {
  ANGER_LEVELS,
  EMOTION_MAP,
  EMOTIONS,
  INTENTS,
  INTENT_MAP,
  LOCAL_HINTS,
  MAX_HISTORY_TURNS,
  TRAP_HINTS,
  type EmotionId,
} from './constants'

export interface ChatTurn {
  role: 'her' | 'me'
  text: string
}

export interface RankedEmotion {
  id: EmotionId
  label: string
  emoji: string
  probability: number
  chosen: boolean
}

export interface MoodAnalysis {
  emotion: EmotionId
  anger: number
  trap: boolean
  intent: string
  confidence: number
  rankedEmotions: RankedEmotion[]
  source: 'jev' | 'fallback'
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  error: string
  at: number
}

export interface ReplyCandidate {
  id: string
  tone: string
  text: string
  probability: number
  chosen: boolean
}

export interface ReplyDecision {
  reply: ReplyCandidate
  ranked: ReplyCandidate[]
  confidence: number
  source: 'jev' | 'fallback'
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  error: string
  at: number
}

const TONE_STRATEGY: Record<string, string> = {
  共情: 'mirror her feeling first and invite her to share more',
  夸夸: 'praise her warmly and keep the joyful mood going',
  贴贴: 'affectionate and clingy in a sweet way',
  宠溺: 'indulgent and affectionate, let her have her way',
  玩梗: 'playful and joking while still being sweet',
  直球: 'direct confession of affection, no games',
  接话: 'normal friendly continuation of the conversation',
  关心: 'caring check-in about her day and health',
  延伸: 'curious follow-up question to keep her talking',
  陪伴: 'practical care and company instead of advice',
  倾听: 'listen first, comfort her before solving anything',
  安抚: 'soothe and calm her down with warmth',
  道歉: 'sincere apology without excuses',
  共情道歉: 'empathy plus apology',
  补救: 'offer a concrete way to make it up to her',
  认错: 'admit the mistake immediately and stop defending',
  降火: 'lower the temperature first, apologize seriously',
  表态: 'give a clear commitment and attitude',
  沟通: 'calm honest communication about the issue',
  承诺: 'promise a concrete change and prove it with action',
  追问: 'ask which specific thing disappointed her, to fix it',
  行动: 'reassure her with a concrete boundary/action',
  甜: 'sweet reassurance',
  服软: 'stop arguing and soften immediately',
  破冰: 'acknowledge the cold war and invite her to vent',
  求生: 'diplomatic answer for a trap question, buy time first',
  真诚: 'sincere answer that focuses on her as a person',
  试探: 'gently probe whether something is wrong',
  主动: 'reach out first and express that you miss her',
  空间: 'give her space while promising to stay available',
}

const LOCAL_INTENT: Record<EmotionId, string> = {
  happy: 'share',
  sweet: 'attention',
  calm: 'share',
  tired: 'comfort',
  upset: 'apology',
  angry: 'apology',
  disappointed: 'solve',
  jealous: 'attention',
  passive: 'apology',
  testing: 'test',
  distant: 'attention',
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.min(1, Math.max(0, normalized))
}

function clampAnger(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(10, Math.max(0, Math.round(value)))
}

/** 11 档 choice 的概率加权期望，得到 0-10 的生气值 */
function expectedAnger(answer: ChoiceAnswer | undefined): number {
  if (!answer || answer.type !== 'choice') return 0
  const entries = Object.entries(answer.probabilities ?? {}).filter(
    ([id, value]) => /^\d+$/.test(id) && typeof value === 'number',
  )
  if (entries.length > 0) {
    return entries.reduce((acc, [id, value]) => acc + Number(id) * value, 0)
  }
  const parsed = Number(answer.choice)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildState(herMessage: string, history: ChatTurn[]) {
  return {
    scenario:
      'A Chinese romantic couple chatting on a messaging app. The girlfriend just sent a message; you judge her mood and choose the boyfriend reply.',
    her_latest_message: herMessage,
    conversation_so_far: history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
      speaker: turn.role === 'her' ? 'girlfriend' : 'boyfriend',
      text: turn.text,
    })),
    notes: [
      'Judge the subtext, not only the literal words: in Chinese, "我没事" / "你玩吧" usually means the opposite.',
      'Short and cold replies often hide anger or disappointment, not indifference.',
      'The boyfriend reply must never be defensive, never lecture her, and never answer a trap question literally.',
      'A good reply acknowledges her feeling first, then shows a concrete attitude or action.',
      'Conversation is in Chinese: the chosen reply will be sent as-is by the boyfriend.',
    ],
  }
}

/** 本地兜底分析：关键词权重 + 标点热度 */
export function localAnalyze(text: string, error = '', startedAt = performance.now()): MoodAnalysis {
  let matched: (typeof LOCAL_HINTS)[number] | null = null
  let matchedHits = 0

  for (const hint of LOCAL_HINTS) {
    const hits = hint.words.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0)
    if (hits > matchedHits) {
      matchedHits = hits
      matched = hint
    }
  }

  const emotion = matched?.emotion ?? 'calm'
  const exclamations = (text.match(/[!！]/g) ?? []).length
  const anger = clampAnger((matched?.anger ?? 0) + Math.min(2, exclamations))
  const trap = TRAP_HINTS.some((word) => text.includes(word))

  return {
    emotion,
    anger,
    trap,
    intent: LOCAL_INTENT[emotion],
    confidence: matchedHits > 0 ? Math.min(0.85, 0.45 + matchedHits * 0.15) : 0.4,
    rankedEmotions: EMOTIONS.map((item) => ({
      id: item.id,
      label: item.label,
      emoji: item.emoji,
      probability: item.id === emotion ? 1 : 0,
      chosen: item.id === emotion,
    })),
    source: 'fallback',
    model: 'local-heuristic',
    latencyMs: Math.round(performance.now() - startedAt),
    inputTokens: 0,
    outputTokens: 0,
    error,
    at: Date.now(),
  }
}

function buildMoodQuestions(): Record<string, JevQuestion> {
  const emotionCriteria: Record<string, string> = {}
  for (const emotion of EMOTIONS) emotionCriteria[emotion.id] = emotion.description

  const intentCriteria: Record<string, string> = {}
  for (const intent of INTENTS) intentCriteria[intent.id] = intent.description

  const angerCriteria: Record<string, string> = {}
  ANGER_LEVELS.forEach((label, level) => {
    angerCriteria[String(level)] = label
  })

  return {
    emotion: {
      type: 'choice',
      instructions: {
        question: 'Which emotion best matches what the girlfriend is feeling right now?',
        state_hint:
          'her_latest_message is what she just sent; conversation_so_far is the recent chat history. Weigh subtext, punctuation and message length.',
      },
      criteria: emotionCriteria,
    },
    anger: {
      type: 'choice',
      instructions: {
        question: 'How angry is she right now? Pick the closest anger level from 0 to 10.',
        state_hint:
          '0 means not angry at all, 10 means furious. Short cold messages can still be very angry. Prefer the level that matches her actual mood, not politeness.',
      },
      criteria: angerCriteria,
    },
    trap: {
      type: 'noul',
      instructions: {
        question:
          'Is this a trap / loaded question where a literal answer would backfire (e.g. "我没事", "你觉得呢", "今天是什么日子")?',
        state_hint: 'Consider Chinese conversational subtext and whether she is fishing for an attitude or memory.',
      },
      criteria: {
        true: 'Yes, it is a trap: do not answer literally, address the underlying feeling first.',
        false: 'No, it is not a trap and can be answered directly.',
      },
    },
    intent: {
      type: 'choice',
      instructions: {
        question: 'What does she actually want from the boyfriend right now?',
        state_hint: 'Pick the underlying need behind the message, not the literal request.',
      },
      criteria: intentCriteria,
    },
  }
}

/** 阶段一：让 Jev 判断她的情绪、生气值、是否为送命题、真实诉求 */
export async function analyzeMood(herMessage: string, history: ChatTurn[]): Promise<MoodAnalysis> {
  const startedAt = performance.now()

  try {
    const response = await askJev(buildState(herMessage, history), buildMoodQuestions())
    const answers = response.answers ?? {}

    const emotionAnswer = answers.emotion as ChoiceAnswer | undefined
    if (!emotionAnswer || emotionAnswer.type !== 'choice' || typeof emotionAnswer.choice !== 'string') {
      throw new Error('Jev 未返回情绪判断')
    }

    const emotion = (EMOTION_MAP as Record<string, unknown>)[emotionAnswer.choice]
      ? (emotionAnswer.choice as EmotionId)
      : localAnalyze(herMessage).emotion

    const angerAnswer = answers.anger as ChoiceAnswer | undefined
    const trapAnswer = answers.trap as NoulAnswer | undefined
    const intentAnswer = answers.intent as ChoiceAnswer | undefined

    const intent =
      intentAnswer && intentAnswer.type === 'choice' && INTENT_MAP[intentAnswer.choice]
        ? intentAnswer.choice
        : LOCAL_INTENT[emotion]

    const probabilities = emotionAnswer.probabilities ?? {}
    const rankedEmotions: RankedEmotion[] = EMOTIONS.map((item) => ({
      id: item.id,
      label: item.label,
      emoji: item.emoji,
      probability: probabilities[item.id] ?? 0,
      chosen: item.id === emotion,
    })).sort((a, b) => b.probability - a.probability)

    return {
      emotion,
      anger: clampAnger(expectedAnger(angerAnswer)),
      trap: (trapAnswer?.noul ?? 0) >= 0.5,
      intent,
      confidence: normalizeConfidence(emotionAnswer.confidence),
      rankedEmotions,
      source: 'jev',
      model: response.model,
      latencyMs: Math.round(performance.now() - startedAt),
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      error: '',
      at: Date.now(),
    }
  } catch (error) {
    if (error instanceof JevAuthError) throw error
    const message = error instanceof Error ? error.message : '未知错误'
    return localAnalyze(herMessage, message, startedAt)
  }
}

function replyCandidates(emotion: EmotionId): ReplyCandidate[] {
  return EMOTION_MAP[emotion].replies.map((template, index) => ({
    id: `r${index}`,
    tone: template.tone,
    text: template.text,
    probability: 0,
    chosen: false,
  }))
}

function describeCandidate(candidate: ReplyCandidate): string {
  const strategy = TONE_STRATEGY[candidate.tone] ?? 'warm, sincere and non-defensive'
  return `Style: ${candidate.tone} (${strategy}). Message to send: "${candidate.text}"`
}

export function fallbackReplyDecision(
  analysis: MoodAnalysis,
  error = '',
  excludeId = '',
): ReplyDecision {
  let candidates = replyCandidates(analysis.emotion)
  if (excludeId) {
    const filtered = candidates.filter((candidate) => candidate.id !== excludeId)
    if (filtered.length > 0) candidates = filtered
  }
  return localReply(candidates, error, performance.now())
}

function localReply(candidates: ReplyCandidate[], error: string, startedAt: number): ReplyDecision {
  const ranked = candidates.map((candidate, index) => ({
    ...candidate,
    probability: index === 0 ? 1 : 0,
    chosen: index === 0,
  }))
  return {
    reply: ranked[0],
    ranked,
    confidence: 0.4,
    source: 'fallback',
    model: 'local-heuristic',
    latencyMs: Math.round(performance.now() - startedAt),
    inputTokens: 0,
    outputTokens: 0,
    error,
    at: Date.now(),
  }
}

/** 阶段二：为她当前情绪准备候选回复，让 Jev 挑选最合适的一条 */
export async function chooseReply(
  herMessage: string,
  history: ChatTurn[],
  analysis: MoodAnalysis,
  excludeId = '',
): Promise<ReplyDecision> {
  const startedAt = performance.now()
  let candidates = replyCandidates(analysis.emotion)
  if (excludeId) {
    const filtered = candidates.filter((candidate) => candidate.id !== excludeId)
    if (filtered.length > 0) candidates = filtered
  }

  try {
    const criteria: Record<string, string> = {}
    for (const candidate of candidates) criteria[candidate.id] = describeCandidate(candidate)

    const intentLabel = INTENT_MAP[analysis.intent]?.label ?? analysis.intent
    const emotionLabel = EMOTION_MAP[analysis.emotion].label

    const state = {
      ...buildState(herMessage, history),
      mood_analysis: {
        emotion: emotionLabel,
        anger_0_to_10: analysis.anger,
        is_trap_question: analysis.trap,
        what_she_wants: intentLabel,
      },
    }

    const questions: Record<string, JevQuestion> = {
      reply: {
        type: 'choice',
        instructions: {
          question:
            'Which reply should the boyfriend send right now? Weigh her emotion, anger level, hidden intent and the chat context. Prefer sincere, warm, non-defensive replies that fit the exact situation.',
          state_hint:
            'mood_analysis summarizes her state. Each option is one candidate message with its style; the chosen message is sent as-is.',
        },
        criteria,
      },
    }

    const response = await askJev(state, questions)
    const answer = response.answers?.reply as ChoiceAnswer | undefined
    if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') {
      throw new Error('Jev 未返回回复选择')
    }

    const probabilities = answer.probabilities ?? {}
    const ranked = candidates
      .map((candidate) => ({
        ...candidate,
        probability: probabilities[candidate.id] ?? 0,
        chosen: candidate.id === answer.choice,
      }))
      .sort((a, b) => b.probability - a.probability)

    const chosen =
      ranked.find((candidate) => candidate.id === answer.choice) ??
      ranked.find(
        (candidate) =>
          candidate.probability === Math.max(...ranked.map((item) => item.probability)),
      ) ??
      ranked[0]

    return {
      reply: chosen,
      ranked: ranked.map((candidate) => ({ ...candidate, chosen: candidate.id === chosen.id })),
      confidence: normalizeConfidence(answer.confidence),
      source: 'jev',
      model: response.model,
      latencyMs: Math.round(performance.now() - startedAt),
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      error: '',
      at: Date.now(),
    }
  } catch (error) {
    if (error instanceof JevAuthError) throw error
    const message = error instanceof Error ? error.message : '未知错误'
    return localReply(candidates, message, startedAt)
  }
}