import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { TetrisEngine, type GameEvent, type Snapshot } from './engine'
import { TetrisRenderer, type TargetOverlay } from './renderer'
import { decidePlacement, type Decision, type RankedOption } from './jev'
import { getJevKey, JevAuthError, maskJevKey, setJevKey, verifyJevKey } from '@/lib/typesafe'
import { sfx } from '@/utils/sfx'

export interface TetrisAiState {
  enabled: boolean
  status: 'off' | 'waiting' | 'thinking' | 'acting' | 'restarting'
  decision: Decision | null
  ranked: RankedOption[]
  history: Decision[]
  error: string
  hasKey: boolean
  maskedKey: string
  /** 正在校验 API Key */
  checkingKey: boolean
  /** 上一次输入的 API Key 无效，需要重新输入 */
  keyInvalid: boolean
  games: number
  decisions: number
  fallbacks: number
  inputTokens: number
  outputTokens: number
  avgLatency: number
}

function emptySnapshot(): Snapshot {
  return {
    grid: [],
    active: null,
    ghostY: 0,
    queue: [],
    hold: null,
    score: 0,
    lines: 0,
    level: 1,
    combo: 0,
    phase: 'ready',
    clearingRows: [],
    clearProgress: 0,
    canHold: true,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resumeIfPaused(engine: TetrisEngine): void {
  if (engine.phase === 'paused') engine.start()
}

export function useTetris(options: { onGameOver?: (score: number, lines: number) => void } = {}) {
  const canvas = ref<HTMLCanvasElement | null>(null)
  const state = reactive<Snapshot>(emptySnapshot())
  const engine = shallowRef<TetrisEngine | null>(null)

  const initialKey = getJevKey()
  const ai = reactive<TetrisAiState>({
    enabled: false,
    status: 'off',
    decision: null,
    ranked: [],
    history: [],
    error: '',
    hasKey: Boolean(initialKey),
    maskedKey: maskJevKey(initialKey),
    checkingKey: false,
    keyInvalid: false,
    games: 0,
    decisions: 0,
    fallbacks: 0,
    inputTokens: 0,
    outputTokens: 0,
    avgLatency: 0,
  })

  let renderer: TetrisRenderer | null = null
  let raf = 0
  let last = 0
  let aiTarget: TargetOverlay | null = null
  let aiRunToken = 0

  function sync(): void {
    const e = engine.value
    if (!e) return
    const snap = e.serialize()
    state.grid = snap.grid
    state.active = snap.active
    state.ghostY = snap.ghostY
    state.queue = snap.queue
    state.hold = snap.hold
    state.score = snap.score
    state.lines = snap.lines
    state.level = snap.level
    state.combo = snap.combo
    state.phase = snap.phase
    state.clearingRows = snap.clearingRows
    state.clearProgress = snap.clearProgress
    state.canHold = snap.canHold
  }

  function handleEvent(event: GameEvent): void {
    switch (event.type) {
      case 'move':
        sfx.move()
        break
      case 'rotate':
        sfx.rotate()
        break
      case 'drop':
        sfx.drop()
        break
      case 'lock':
        sfx.lock()
        break
      case 'hold':
        sfx.hold()
        break
      case 'clear':
        sfx.clear(event.lines)
        break
      case 'gameover':
        sfx.gameOver()
        options.onGameOver?.(event.score, engine.value?.lines ?? 0)
        break
      default:
        break
    }
  }

  function loop(now: number): void {
    raf = requestAnimationFrame(loop)
    const dt = last === 0 ? 16 : Math.min(now - last, 120)
    last = now

    const e = engine.value
    if (!e) return

    e.update(dt)
    renderer?.draw(e.serialize(), dt, aiTarget)
    sync()
  }

  function resize(): void {
    renderer?.resize()
  }

  function start(): void {
    engine.value?.start()
    sync()
  }

  function restart(): void {
    const e = engine.value
    if (!e) return
    e.reset()
    e.start()
    sync()
  }

  function togglePause(): void {
    if (ai.enabled) return
    engine.value?.togglePause()
    sync()
  }

  function move(dx: number): void {
    if (ai.enabled) return
    engine.value?.move(dx)
  }

  function rotate(dir: 1 | -1): void {
    if (ai.enabled) return
    engine.value?.rotate(dir)
  }

  function softDrop(): void {
    if (ai.enabled) return
    engine.value?.softDrop()
  }

  function hardDrop(): void {
    if (ai.enabled) return
    engine.value?.hardDrop()
    sync()
  }

  function hold(): void {
    if (ai.enabled) return
    engine.value?.holdPiece()
    sync()
  }

  function onKeyDown(event: KeyboardEvent): void {
    const e = engine.value
    if (!e) return

    const key = event.key
    const code = event.code

    if (ai.enabled) {
      if (code === 'Space' || key === 'p' || key === 'P' || key === 'Escape') event.preventDefault()
      return
    }

    if (key === 'Enter' && (e.phase === 'ready' || e.phase === 'over')) {
      event.preventDefault()
      restart()
      return
    }

    if (code === 'Space' || key === 'p' || key === 'P' || key === 'Escape') event.preventDefault()

    if (e.phase !== 'playing') {
      if (key === 'p' || key === 'P') togglePause()
      return
    }

    switch (true) {
      case key === 'ArrowLeft' || key === 'a' || key === 'A':
        move(-1)
        break
      case key === 'ArrowRight' || key === 'd' || key === 'D':
        move(1)
        break
      case key === 'ArrowDown' || key === 's' || key === 'S':
        softDrop()
        break
      case key === 'ArrowUp' || key === 'x' || key === 'X' || key === 'w' || key === 'W':
        rotate(1)
        break
      case key === 'z' || key === 'Z':
        rotate(-1)
        break
      case code === 'Space':
        hardDrop()
        break
      case key === 'c' || key === 'C' || key === 'Shift':
        hold()
        break
      case key === 'p' || key === 'P':
        togglePause()
        break
      default:
        return
    }

    event.preventDefault()
  }

  function recordDecision(decision: Decision): void {
    ai.decision = decision
    ai.ranked = decision.ranked
    ai.history.unshift(decision)
    if (ai.history.length > 12) ai.history.length = 12
    ai.decisions += 1
    if (decision.source === 'fallback') {
      ai.fallbacks += 1
      ai.error = decision.error
    } else {
      ai.error = ''
    }
    ai.inputTokens += decision.inputTokens
    ai.outputTokens += decision.outputTokens
    ai.avgLatency = Math.round(
      (ai.avgLatency * (ai.decisions - 1) + decision.latencyMs) / ai.decisions,
    )
  }

  /** 永不停歇的 Jev 外挂主循环：思考 → 高亮落点 → 执行 → 消行/结束自动重开 */
  async function aiLoop(token: number): Promise<void> {
    while (ai.enabled && token === aiRunToken) {
      const e = engine.value
      if (!e) {
        await sleep(120)
        continue
      }

      try {
        if (e.phase === 'over') {
          ai.status = 'restarting'
          aiTarget = null
          await sleep(1500)
          if (!ai.enabled || token !== aiRunToken) return
          ai.games += 1
          e.reset()
          e.start()
          sync()
          continue
        }

        if (e.phase !== 'playing' || !e.active) {
          await sleep(50)
          continue
        }
        if (e.entryElapsed > 60) {
          await sleep(40)
          continue
        }

        e.pause()
        ai.status = 'thinking'
        const snapshot = e.serialize()

        let decision: Decision
        try {
          decision = await decidePlacement(snapshot)
        } catch (error) {
          if (error instanceof JevAuthError) {
            invalidateKey(error.message)
            return
          }
          ai.error = error instanceof Error ? error.message : '决策失败'
          await sleep(260)
          resumeIfPaused(e)
          continue
        }

        if (!ai.enabled || token !== aiRunToken) {
          resumeIfPaused(e)
          return
        }

        recordDecision(decision)
        aiTarget = {
          matrix: decision.placement.matrix,
          x: decision.placement.x,
          y: decision.placement.y,
          type: decision.placement.piece,
        }
        ai.status = 'acting'
        await sleep(300)

        if (!ai.enabled || token !== aiRunToken) {
          aiTarget = null
          resumeIfPaused(e)
          return
        }

        e.start()
        const piece = e.active
        const rotations = (decision.placement.rotation - (piece?.rotation ?? 0) + 4) % 4

        for (let i = 0; i < rotations; i++) {
          if (!ai.enabled || token !== aiRunToken || e.active !== piece) break
          e.rotate(1)
          sync()
          await sleep(65)
        }

        let guard = 0
        while (piece && e.active === piece && e.active.x !== decision.placement.x && guard++ < 14) {
          if (!ai.enabled || token !== aiRunToken) break
          e.move(decision.placement.x > e.active.x ? 1 : -1)
          sync()
          await sleep(38)
        }

        if (ai.enabled && token === aiRunToken && piece && e.active === piece) {
          e.hardDrop()
          sync()
        }

        aiTarget = null
        await sleep(120)
      } catch (error) {
        ai.error = error instanceof Error ? error.message : '外挂循环异常'
        aiTarget = null
        await sleep(400)
      }
    }

    aiTarget = null
  }

  /** API Key 失效：停止外挂并清空本地 Key，要求用户重新输入 */
  function invalidateKey(message: string): void {
    setJevKey('')
    ai.enabled = false
    ai.status = 'off'
    ai.hasKey = Boolean(getJevKey())
    ai.maskedKey = maskJevKey(getJevKey())
    ai.keyInvalid = true
    ai.error = message || 'API Key 无效，请重新输入'
    aiTarget = null
    aiRunToken += 1

    const e = engine.value
    if (e && e.phase === 'paused') {
      e.start()
      sync()
    }
  }

  function toggleAi(): void {
    const e = engine.value
    if (!e || ai.checkingKey) return

    if (!ai.enabled && (!ai.hasKey || ai.keyInvalid)) {
      ai.error = ai.keyInvalid
        ? 'API Key 无效，请重新输入后再开启 JEV 外挂'
        : '请先填写 TypeSafe API Key 再开启 JEV 外挂'
      return
    }

    ai.enabled = !ai.enabled
    aiRunToken += 1

    if (ai.enabled) {
      ai.error = ''
      ai.status = 'waiting'
      if (e.phase === 'over') e.reset()
      e.start()
      sync()
      void aiLoop(aiRunToken)
    } else {
      ai.status = 'off'
      aiTarget = null
      if (e.phase === 'paused') {
        e.start()
        sync()
      }
    }
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

  onMounted(() => {
    if (canvas.value) {
      renderer = new TetrisRenderer(canvas.value)
      renderer.resize()
    }
    engine.value = new TetrisEngine(handleEvent)
    sync()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(loop)
  })

  onBeforeUnmount(() => {
    aiRunToken += 1
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', resize)
    renderer = null
    engine.value = null
  })

  return {
    canvas,
    state,
    ai,
    start,
    restart,
    togglePause,
    toggleAi,
    saveApiKey,
    move,
    rotate,
    softDrop,
    hardDrop,
    hold,
    resize,
  }
}