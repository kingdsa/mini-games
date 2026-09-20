/**
 * TypeSafe AI · Jev System One client
 *
 * 浏览器直连 https://api.typesafe.ai 会被 CORS 拦截，因此默认走 Vite 代理
 * （/jev-api → https://api.typesafe.ai）。可通过 VITE_TYPESAFE_BASE_URL 覆盖。
 */

const DEFAULT_MODEL = 'jev-latest'
const DEFAULT_BASE = '/jev-api'
const STORAGE_KEY = 'typesafe_api_key'
const TIMEOUT_MS = 20_000
const MAX_RETRIES = 2

/** 获取 TypeSafe API Key 的页面 */
export const JEV_KEYS_URL = 'https://console.typesafe.ai/keys'

/** API Key 无效 / 缺失时抛出，调用方应提示用户重新输入 */
export class JevAuthError extends Error {
  readonly status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = 'JevAuthError'
    this.status = status
  }
}

export interface ChoiceQuestion {
  type: 'choice'
  instructions: unknown
  criteria: Record<string, unknown>
}

export interface ScoreQuestion {
  type: 'score'
  instructions: unknown
  criteria: unknown[]
}

export interface NoulQuestion {
  type: 'noul'
  instructions: unknown
  criteria?: { true?: unknown; false?: unknown }
}

export type JevQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion

export interface ChoiceAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

export interface ScoreAnswer {
  type: 'score'
  score: number
  confidence: number
  legend: Record<string, string>
  probabilities: Record<string, number>
}

export interface NoulAnswer {
  type: 'noul'
  noul: number
}

export type JevAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer

export interface JevUsage {
  input_tokens: number
  output_tokens: number
}

export interface JevResponse {
  model: string
  answers: Record<string, JevAnswer>
  usage?: JevUsage
}

export function getJevKey(): string {
  const fromEnv = (import.meta.env.VITE_TYPESAFE_API_KEY ?? '').trim()
  if (fromEnv) return fromEnv
  try {
    return (localStorage.getItem(STORAGE_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

export function setJevKey(key: string): void {
  const trimmed = key.trim()
  try {
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

export function maskJevKey(key: string): string {
  if (key.length <= 12) return key ? '••••' : ''
  return `${key.slice(0, 8)}…${key.slice(-4)}`
}

function endpoint(path: string): string {
  const base = (import.meta.env.VITE_TYPESAFE_BASE_URL ?? DEFAULT_BASE).trim().replace(/\/+$/, '')
  return `${base || DEFAULT_BASE}${path}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAuthFailure(status: number, detail: string): boolean {
  return status === 401 || status === 403 || detail.includes('authentication_error')
}

async function send(
  state: unknown,
  questions: Record<string, JevQuestion>,
  key: string,
): Promise<JevResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(endpoint('/v1/systemone'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, model: DEFAULT_MODEL, questions }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (isAuthFailure(res.status, detail)) {
        throw new JevAuthError('API Key 无效或已失效，请重新输入', res.status)
      }
      throw new Error(`TypeSafe ${res.status}${detail ? ` · ${detail.slice(0, 160)}` : ''}`)
    }
    return (await res.json()) as JevResponse
  } finally {
    clearTimeout(timer)
  }
}

/** 校验 API Key 是否可用；无效时抛出 JevAuthError，网络异常抛出普通错误 */
export async function verifyJevKey(key: string): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(endpoint('/v1/models'), {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (isAuthFailure(res.status, detail)) {
        throw new JevAuthError('API Key 无效，请重新输入', res.status)
      }
      throw new Error(`TypeSafe ${res.status}${detail ? ` · ${detail.slice(0, 160)}` : ''}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('API Key 校验超时，请检查网络后重试')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** 向 Jev 提问；带超时与指数退避重试，失败时抛出可读错误 */
export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
  options: { retries?: number } = {},
): Promise<JevResponse> {
  const key = getJevKey()
  if (!key) throw new JevAuthError('缺少 TypeSafe API Key，请重新输入')

  const retries = options.retries ?? MAX_RETRIES
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await send(state, questions, key)
    } catch (error) {
      lastError = error
      if (error instanceof JevAuthError) throw error
      if (attempt < retries) await sleep(350 * (attempt + 1))
    }
  }

  if (lastError instanceof Error && lastError.name === 'AbortError') {
    throw new Error('TypeSafe 请求超时')
  }
  throw lastError instanceof Error ? lastError : new Error('TypeSafe 请求失败')
}