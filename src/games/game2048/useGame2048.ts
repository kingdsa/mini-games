import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { POP_MS, SIZE, SLIDE_MS, SPAWN_MS, WIN_VALUE, type Direction } from './constants'
import { canMove, planMove, spawnTile, type Board, type Slide } from './engine'
import {
  decideMove,
  pickLocalBest,
  type Decision,
  type Game2048Snapshot,
  type RankedOption,
} from './jev'
import { getJevKey, JevAuthError, maskJevKey, setJevKey, verifyJevKey } from '@/lib/typesafe'
import { sfx } from '@/utils/sfx'

export interface Tile2048 {
  id: number
  value: number
  row: number
  col: number
  /** 新生成方块（入场动画） */
  isNew: boolean
  /** 刚合并出的方块（弹跳动画） */
  merged: boolean
  /** 正在滑动 */
  sliding: boolean
}

export interface Popup {
  id: number
  row: number
  col: number
  text: string
  tone: 'normal' | 'big'
}

export type Game2048Phase = 'playing' | 'paused' | 'won' | 'over'

export type Game2048AiStatus = 'off' | 'confirm' | 'waiting' | 'thinking' | 'acting' | 'gameEnd'

export interface Game2048AiState {
  enabled: boolean
  /** confirm 表示等待用户点击确认后才接管 */
  status: Game2048AiStatus
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
  decisions: number
  fallbacks: number
  totalGain: number
  inputTokens: number
  outputTokens: number
  avgLatency: number
}

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let uid = 1

export function useGame2048(
  options: { onGameEnd?: (score: number, maxTile: number, targetReached: boolean) => void } = {},
) {
  const tiles = reactive<Tile2048[]>([])
  const phase = ref<Game2048Phase>('playing')
  const score = ref(0)
  const moveCount = ref(0)
  const won = ref(false)
  const popups = ref<Popup[]>([])
  const busy = ref(false)
  const hintDirection = shallowRef<Direction | null>(null)
  const shakeDirection = shallowRef<Direction | null>(null)

  const initialKey = getJevKey()
  const ai = reactive<Game2048AiState>({
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
    decisions: 0,
    fallbacks: 0,
    totalGain: 0,
    inputTokens: 0,
    outputTokens: 0,
    avgLatency: 0,
  })

  let aiRunToken = 0
  let hintTimer: number | undefined
  let shakeTimer: number | undefined
  let resultSaved = false
  let savedScore = 0

  const maxTileValue = computed(() => tiles.reduce((max, tile) => Math.max(max, tile.value), 0))

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */

  function createTile(row: number, col: number, value: number, isNew = false): Tile2048 {
    return reactive<Tile2048>({
      id: uid++,
      value,
      row,
      col,
      isNew,
      merged: false,
      sliding: false,
    })
  }

  function matrix(): Board {
    const board: Board = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
    for (const tile of tiles) board[tile.row][tile.col] = tile.value
    return board
  }

  function addPopup(row: number, col: number, text: string, tone: Popup['tone']): void {
    const popup: Popup = { id: uid++, row, col, text, tone }
    popups.value.push(popup)
    window.setTimeout(() => {
      popups.value = popups.value.filter((p) => p.id !== popup.id)
    }, 900)
  }

  function flashHint(direction: Direction, ms = 1500): void {
    hintDirection.value = direction
    window.clearTimeout(hintTimer)
    hintTimer = window.setTimeout(() => {
      if (hintDirection.value === direction) hintDirection.value = null
    }, ms)
  }

  function flashShake(direction: Direction): void {
    shakeDirection.value = direction
    window.clearTimeout(shakeTimer)
    shakeTimer = window.setTimeout(() => {
      if (shakeDirection.value === direction) shakeDirection.value = null
    }, 300)
  }

  /* ------------------------------------------------------------------ */
  /* 对局生命周期                                                        */
  /* ------------------------------------------------------------------ */

  function saveResult(): void {
    if (score.value <= 0) return
    if (resultSaved && score.value <= savedScore) return
    options.onGameEnd?.(score.value, maxTileValue.value, won.value)
    resultSaved = true
    savedScore = score.value
  }

  function spawnInitial(): void {
    for (let i = 0; i < 2; i++) {
      const spawn = spawnTile(matrix())
      if (!spawn) break
      tiles.push(createTile(spawn.row, spawn.col, spawn.value, true))
    }
  }

  function startGame(): void {
    saveResult()
    aiRunToken += 1
    resultSaved = false
    savedScore = 0

    tiles.splice(0, tiles.length)
    score.value = 0
    moveCount.value = 0
    won.value = false
    popups.value = []
    busy.value = false
    hintDirection.value = null
    shakeDirection.value = null
    phase.value = 'playing'
    spawnInitial()

    if (ai.enabled) {
      ai.status = 'confirm'
      ai.decision = null
      ai.ranked = []
      ai.error = ''
    } else {
      ai.status = 'off'
    }
  }

  function continueGame(): void {
    if (phase.value !== 'won') return
    phase.value = 'playing'
    if (ai.enabled) {
      aiRunToken += 1
      ai.status = 'confirm'
      ai.decision = null
      ai.ranked = []
      ai.error = ''
    }
  }

  function togglePause(): void {
    if (phase.value === 'playing') phase.value = 'paused'
    else if (phase.value === 'paused') phase.value = 'playing'
  }

  function useHint(): void {
    if (busy.value || phase.value !== 'playing' || aiOwnsBoard()) return
    const best = pickLocalBest(matrix())
    if (best) flashHint(best.direction, 1800)
  }

  /* ------------------------------------------------------------------ */
  /* 移动与动画                                                          */
  /* ------------------------------------------------------------------ */

  async function doMove(direction: Direction, actor: 'player' | 'ai' = 'player'): Promise<boolean> {
    if (busy.value || phase.value !== 'playing') return false

    const plan = planMove(matrix(), direction)
    if (!plan.moved) {
      if (actor === 'player') {
        sfx.invalid()
        flashShake(direction)
      }
      return false
    }

    busy.value = true
    hintDirection.value = null

    const slidesByOrigin = new Map<string, Slide>()
    for (const slide of plan.slides) {
      slidesByOrigin.set(`${slide.fromRow},${slide.fromCol}`, slide)
    }

    const doomed = new Set<number>()
    for (const tile of tiles) {
      const slide = slidesByOrigin.get(`${tile.row},${tile.col}`)
      if (!slide) continue
      tile.isNew = false
      tile.merged = false
      tile.sliding = true
      if (slide.merge) doomed.add(tile.id)
      tile.row = slide.toRow
      tile.col = slide.toCol
    }

    sfx.slide()
    await delay(SLIDE_MS)

    if (plan.merges.length > 0) {
      if (doomed.size > 0) {
        for (let i = tiles.length - 1; i >= 0; i--) {
          if (doomed.has(tiles[i].id)) tiles.splice(i, 1)
        }
      }

      for (const merge of plan.merges) {
        const tile = createTile(merge.row, merge.col, merge.value)
        tile.merged = true
        tiles.push(tile)
        addPopup(merge.row, merge.col, `+${merge.value}`, merge.value >= 128 ? 'big' : 'normal')
      }

      score.value += plan.gained
      const top = Math.max(...plan.merges.map((merge) => merge.value))
      sfx.merge(Math.log2(top))
      await delay(POP_MS)
    }

    const spawn = spawnTile(matrix())
    if (spawn) {
      tiles.push(createTile(spawn.row, spawn.col, spawn.value, true))
      await delay(SPAWN_MS)
    }

    for (const tile of tiles) tile.sliding = false

    moveCount.value += 1
    busy.value = false

    if (maxTileValue.value >= WIN_VALUE && !won.value) {
      won.value = true
      phase.value = 'won'
      sfx.win()
      saveResult()
      if (ai.enabled) ai.status = 'gameEnd'
    } else if (!canMove(matrix())) {
      phase.value = 'over'
      sfx.gameOver()
      saveResult()
      if (ai.enabled) ai.status = 'gameEnd'
    }

    return true
  }

  /* ------------------------------------------------------------------ */
  /* 输入                                                                */
  /* ------------------------------------------------------------------ */

  const swipeStart = shallowRef<{ x: number; y: number; id: number } | null>(null)

  function onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return
    }
    const direction = KEY_MAP[event.key]
    if (!direction) return
    event.preventDefault()
    if (aiOwnsBoard()) return
    void doMove(direction, 'player')
  }

  function onBoardPointerDown(event: PointerEvent): void {
    if (busy.value || phase.value !== 'playing' || aiOwnsBoard()) return
    swipeStart.value = { x: event.clientX, y: event.clientY, id: event.pointerId }
    const target = event.currentTarget as HTMLElement | null
    target?.setPointerCapture?.(event.pointerId)
  }

  function onBoardPointerUp(event: PointerEvent): void {
    const start = swipeStart.value
    swipeStart.value = null
    if (!start || start.id !== event.pointerId) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return

    const direction: Direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    void doMove(direction, 'player')
  }

  function onBoardPointerCancel(): void {
    swipeStart.value = null
  }

  /* ------------------------------------------------------------------ */
  /* Jev 外挂                                                            */
  /* ------------------------------------------------------------------ */

  /** 外挂是否正控制棋盘（confirm 状态下允许玩家手动操作） */
  function aiOwnsBoard(): boolean {
    return ai.enabled && ai.status !== 'confirm'
  }

  function aiSnapshot(): Game2048Snapshot {
    return {
      board: matrix(),
      score: score.value,
      moveCount: moveCount.value,
      maxTile: maxTileValue.value,
      targetReached: won.value,
    }
  }

  function recordDecision(decision: Decision): void {
    ai.decision = decision
    ai.ranked = decision.ranked
    ai.history.unshift(decision)
    if (ai.history.length > 12) ai.history.length = 12
    ai.decisions += 1
    ai.totalGain += decision.move.gain
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

  /** API Key 失效：停止外挂并清空本地 Key，要求用户重新输入 */
  function invalidateKey(message: string): void {
    setJevKey('')
    ai.enabled = false
    ai.status = 'off'
    ai.hasKey = Boolean(getJevKey())
    ai.maskedKey = maskJevKey(getJevKey())
    ai.keyInvalid = true
    ai.error = message || 'API Key 无效，请重新输入'
    aiRunToken += 1
    hintDirection.value = null
  }

  /**
   * Jev 外挂主循环：思考 → 高亮方向 → 执行滑动。
   * 对局结束后停下；重新开始由 startGame 置为 confirm，需用户确认后再开新循环。
   */
  async function aiLoop(token: number): Promise<void> {
    while (ai.enabled && token === aiRunToken) {
      if (phase.value === 'won' || phase.value === 'over') {
        ai.status = 'gameEnd'
        return
      }

      if (phase.value !== 'playing') {
        ai.status = 'waiting'
        await delay(120)
        continue
      }

      if (busy.value || ai.status === 'confirm') {
        await delay(80)
        continue
      }

      try {
        ai.status = 'thinking'
        const snapshot = aiSnapshot()

        let decision: Decision
        try {
          decision = await decideMove(snapshot)
        } catch (error) {
          if (error instanceof JevAuthError) {
            invalidateKey(error.message)
            return
          }
          ai.error = error instanceof Error ? error.message : '决策失败'
          ai.status = 'waiting'
          await delay(320)
          continue
        }

        if (!ai.enabled || token !== aiRunToken) return

        recordDecision(decision)
        ai.status = 'acting'
        flashHint(decision.move.direction, 900)
        await delay(340)

        if (!ai.enabled || token !== aiRunToken) {
          hintDirection.value = null
          return
        }

        await doMove(decision.move.direction, 'ai')
        hintDirection.value = null
        await delay(140)
      } catch (error) {
        ai.error = error instanceof Error ? error.message : '外挂循环异常'
        hintDirection.value = null
        ai.status = 'waiting'
        await delay(420)
      }
    }

    hintDirection.value = null
  }

  function toggleAi(): void {
    if (ai.checkingKey) return

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
      if (phase.value === 'playing') {
        ai.status = 'waiting'
        void aiLoop(aiRunToken)
      } else {
        ai.status = 'confirm'
      }
    } else {
      ai.status = 'off'
      hintDirection.value = null
    }
  }

  /** 用户点击确认后，外挂才接管棋盘 */
  function confirmAi(): void {
    if (!ai.enabled) return
    if (phase.value !== 'playing') {
      ai.status = 'confirm'
      return
    }
    aiRunToken += 1
    ai.error = ''
    ai.status = 'waiting'
    void aiLoop(aiRunToken)
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
    window.addEventListener('keydown', onKeyDown)
    startGame()
  })

  onBeforeUnmount(() => {
    aiRunToken += 1
    window.removeEventListener('keydown', onKeyDown)
    window.clearTimeout(hintTimer)
    window.clearTimeout(shakeTimer)
  })

  return {
    tiles,
    phase,
    score,
    moveCount,
    won,
    popups,
    busy,
    hintDirection,
    shakeDirection,
    maxTileValue,
    ai,
    startGame,
    continueGame,
    togglePause,
    useHint,
    doMove,
    toggleAi,
    confirmAi,
    saveApiKey,
    aiOwnsBoard,
    onBoardPointerDown,
    onBoardPointerUp,
    onBoardPointerCancel,
  }
}