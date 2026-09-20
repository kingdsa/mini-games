import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import {
  BASE_POINTS,
  CLEAR_MS,
  COLS,
  COMBO_PAUSE_MS,
  FALL_MS,
  LEVELS,
  ROWS,
  STAR_MULTIPLIERS,
  SWAP_MS,
  comboMultiplier,
  starsFor,
  type LevelConfig,
} from './constants'
import { decideMove, type Decision, type Match3Snapshot, type RankedOption } from './jev'
import { getJevKey, JevAuthError, maskJevKey, setJevKey, verifyJevKey } from '@/lib/typesafe'
import { sfx } from '@/utils/sfx'

export interface Tile {
  id: number
  type: number
  row: number
  col: number
  clearing: boolean
}

export interface Popup {
  id: number
  row: number
  col: number
  text: string
  tone: 'normal' | 'combo' | 'big'
}

export type Match3Phase = 'ready' | 'playing' | 'paused' | 'won' | 'over'

export type Match3AiStatus = 'off' | 'confirm' | 'waiting' | 'thinking' | 'acting' | 'levelEnd'

export interface Match3AiState {
  enabled: boolean
  /** confirm 表示已进入关卡但等待用户点击确认后才接管 */
  status: Match3AiStatus
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
  levels: number
  decisions: number
  fallbacks: number
  inputTokens: number
  outputTokens: number
  avgLatency: number
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function raf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

let uid = 1

export function useMatch3(options: { onLevelEnd?: (score: number, level: number, stars: number) => void } = {}) {
  const grid = reactive<(Tile | null)[][]>(
    Array.from({ length: ROWS }, () => Array<Tile | null>(COLS).fill(null)),
  )

  const phase = ref<Match3Phase>('ready')
  const levelIndex = ref(0)
  const score = ref(0)
  const moves = ref(0)
  const combo = ref(0)
  const bestCombo = ref(0)
  const selected = shallowRef<Tile | null>(null)
  const hint = shallowRef<Tile[]>([])
  const popups = ref<Popup[]>([])
  const toast = ref('')
  const busy = ref(false)
  const wrongPair = shallowRef<Tile[]>([])
  const stars = ref(0)

  const initialKey = getJevKey()
  const ai = reactive<Match3AiState>({
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
    levels: 0,
    decisions: 0,
    fallbacks: 0,
    inputTokens: 0,
    outputTokens: 0,
    avgLatency: 0,
  })

  let idleTimer: number | undefined
  let toastTimer: number | undefined
  let aiRunToken = 0

  const level = computed<LevelConfig>(() => LEVELS[Math.min(levelIndex.value, LEVELS.length - 1)])
  const typeCount = computed(() => level.value.types)
  const barMax = computed(() => level.value.target * STAR_MULTIPLIERS[2])
  const progress = computed(() => Math.min(1, score.value / barMax.value))
  const movesLeft = computed(() => Math.max(0, moves.value))

  const tiles = computed<Tile[]>(() => {
    const out: Tile[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = grid[r][c]
        if (tile) out.push(tile)
      }
    }
    return out
  })

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */

  function randType(): number {
    return Math.floor(Math.random() * typeCount.value)
  }

  function makeTile(row: number, col: number, type?: number, visualRow?: number): Tile {
    return reactive<Tile>({
      id: uid++,
      type: type ?? randType(),
      row: visualRow ?? row,
      col,
      clearing: false,
    })
  }

  function tileAt(r: number, c: number): Tile | null {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null
    return grid[r][c]
  }

  function showToast(text: string): void {
    toast.value = text
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.value = ''), 1800)
  }

  function addPopup(row: number, col: number, text: string, tone: Popup['tone']): void {
    const popup: Popup = { id: uid++, row, col, text, tone }
    popups.value.push(popup)
    window.setTimeout(() => {
      popups.value = popups.value.filter((p) => p.id !== popup.id)
    }, 1000)
  }

  /* ------------------------------------------------------------------ */
  /* 棋盘生成                                                            */
  /* ------------------------------------------------------------------ */

  function safeType(r: number, c: number): number {
    const banned = new Set<number>()
    const left1 = tileAt(r, c - 1)
    const left2 = tileAt(r, c - 2)
    if (left1 && left2 && left1.type === left2.type) banned.add(left1.type)
    const up1 = tileAt(r - 1, c)
    const up2 = tileAt(r - 2, c)
    if (up1 && up2 && up1.type === up2.type) banned.add(up1.type)

    const pool: number[] = []
    for (let t = 0; t < typeCount.value; t++) if (!banned.has(t)) pool.push(t)
    if (pool.length === 0) return randType()
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function buildBoard(): void {
    let attempts = 0
    do {
      attempts++
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          grid[r][c] = makeTile(r, c, safeType(r, c))
        }
      }
    } while (!hasPossibleMove() && attempts < 30)
  }

  /* ------------------------------------------------------------------ */
  /* 匹配检测                                                            */
  /* ------------------------------------------------------------------ */

  function findMatches(): Tile[] {
    const found = new Set<Tile>()

    const scan = (get: (i: number) => Tile | null, length: number) => {
      let start = 0
      for (let i = 1; i <= length; i++) {
        const prev = get(i - 1)
        const cur = i < length ? get(i) : null
        const same = !!prev && !!cur && cur.type === prev.type
        if (!same) {
          const runLength = i - start
          if (runLength >= 3) {
            for (let k = start; k < i; k++) {
              const t = get(k)
              if (t) found.add(t)
            }
          }
          start = i
        }
      }
    }

    for (let r = 0; r < ROWS; r++) scan((c) => grid[r][c], COLS)
    for (let c = 0; c < COLS; c++) scan((r) => grid[r][c], ROWS)

    return [...found]
  }

  function anyMatch(g: (number | null)[][]): boolean {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = g[r][c]
        if (v === null) continue
        if (c >= 2 && g[r][c - 1] === v && g[r][c - 2] === v) return true
        if (r >= 2 && g[r - 1][c] === v && g[r - 2][c] === v) return true
      }
    }
    return false
  }

  function typeMatrix(): (number | null)[][] {
    const out: (number | null)[][] = []
    for (let r = 0; r < ROWS; r++) {
      const row: (number | null)[] = []
      for (let c = 0; c < COLS; c++) row.push(grid[r][c]?.type ?? null)
      out.push(row)
    }
    return out
  }

  function findPossibleMove(): [Tile, Tile] | null {
    const g = typeMatrix()
    const swap = (r1: number, c1: number, r2: number, c2: number) => {
      const tmp = g[r1][c1]
      g[r1][c1] = g[r2][c2]
      g[r2][c2] = tmp
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c + 1 < COLS) {
          swap(r, c, r, c + 1)
          if (anyMatch(g)) {
            swap(r, c, r, c + 1)
            const a = tileAt(r, c)
            const b = tileAt(r, c + 1)
            if (a && b) return [a, b]
          }
          swap(r, c, r, c + 1)
        }
        if (r + 1 < ROWS) {
          swap(r, c, r + 1, c)
          if (anyMatch(g)) {
            swap(r, c, r + 1, c)
            const a = tileAt(r, c)
            const b = tileAt(r + 1, c)
            if (a && b) return [a, b]
          }
          swap(r, c, r + 1, c)
        }
      }
    }
    return null
  }

  function hasPossibleMove(): boolean {
    return findPossibleMove() !== null
  }

  /* ------------------------------------------------------------------ */
  /* 动画辅助                                                            */
  /* ------------------------------------------------------------------ */

  async function settle(): Promise<void> {
    await nextTick()
    await raf()
    await raf()
  }

  async function applyGravity(): Promise<void> {
    const spawns: Array<{ tile: Tile; target: number }> = []

    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1
      for (let r = ROWS - 1; r >= 0; r--) {
        const tile = grid[r][c]
        if (!tile) continue
        if (r !== write) {
          grid[write][c] = tile
          grid[r][c] = null
          tile.row = write
        }
        write--
      }

      let offset = 1
      for (let r = write; r >= 0; r--) {
        const tile = makeTile(r, c, undefined, -offset)
        grid[r][c] = tile
        spawns.push({ tile, target: r })
        offset++
      }
    }

    if (spawns.length > 0) {
      await settle()
      for (const item of spawns) item.tile.row = item.target
      await delay(FALL_MS)
    }
  }

  async function shuffleBoard(reason: string): Promise<void> {
    showToast(reason)
    const all = tiles.value
    for (const t of all) t.clearing = true
    await delay(220)
    for (const t of all) t.clearing = false

    for (let attempt = 0; attempt < 60; attempt++) {
      const pool = all.map((t) => t.type)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      all.forEach((t, i) => (t.type = pool[i]))
      if (!anyMatch(typeMatrix()) && hasPossibleMove()) break
    }

    all.forEach((t) => (t.clearing = true))
    await delay(160)
    all.forEach((t) => (t.clearing = false))
    await delay(120)
  }

  /* ------------------------------------------------------------------ */
  /* 消除与结算                                                          */
  /* ------------------------------------------------------------------ */

  async function resolve(): Promise<void> {
    let chain = 0

    for (;;) {
      const matches = findMatches()
      if (matches.length === 0) break

      chain++
      combo.value = chain
      bestCombo.value = Math.max(bestCombo.value, chain)

      const multiplier = comboMultiplier(chain)
      const gained = Math.round(matches.length * BASE_POINTS * multiplier)
      score.value += gained

      sfx.match(chain - 1)

      const rows = matches.map((t) => t.row)
      const cols = matches.map((t) => t.col)
      const centerRow = rows.reduce((a, b) => a + b, 0) / rows.length
      const centerCol = cols.reduce((a, b) => a + b, 0) / cols.length
      const tone: Popup['tone'] = chain >= 3 ? 'big' : chain === 2 ? 'combo' : 'normal'
      const label = chain > 1 ? `+${gained} ×${chain}` : `+${gained}`
      addPopup(centerRow, centerCol, label, tone)

      for (const t of matches) t.clearing = true
      await delay(CLEAR_MS)

      for (const t of matches) {
        if (grid[t.row][t.col] === t) grid[t.row][t.col] = null
      }

      await applyGravity()
      if (chain > 1) await delay(COMBO_PAUSE_MS)
    }

    combo.value = 0

    if (!hasPossibleMove()) {
      await shuffleBoard('没有可消除的组合，自动洗牌')
    }

    scheduleHint()
  }

  /* ------------------------------------------------------------------ */
  /* 玩家操作                                                            */
  /* ------------------------------------------------------------------ */

  function isAdjacent(a: Tile, b: Tile): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
  }

  function swapInGrid(a: Tile, b: Tile): void {
    const ar = a.row
    const ac = a.col
    grid[a.row][a.col] = b
    grid[b.row][b.col] = a
    a.row = b.row
    a.col = b.col
    b.row = ar
    b.col = ac
  }

  async function attemptSwap(a: Tile, b: Tile): Promise<void> {
    if (busy.value || phase.value !== 'playing') return
    if (!isAdjacent(a, b)) return

    busy.value = true
    clearHint()
    selected.value = null
    sfx.swap()

    swapInGrid(a, b)
    await delay(SWAP_MS)

    if (findMatches().length === 0) {
      sfx.invalid()
      wrongPair.value = [a, b]
      swapInGrid(a, b)
      await delay(SWAP_MS)
      window.setTimeout(() => (wrongPair.value = []), 260)
      busy.value = false
      scheduleHint()
      return
    }

    moves.value -= 1
    await resolve()

    if (score.value >= level.value.target) {
      stars.value = starsFor(score.value, level.value.target)
      phase.value = 'won'
      sfx.win()
      if (ai.enabled && ai.status !== 'confirm') ai.levels += 1
      options.onLevelEnd?.(score.value, level.value.id, stars.value)
    } else if (moves.value <= 0) {
      stars.value = starsFor(score.value, level.value.target)
      phase.value = 'over'
      sfx.gameOver()
      options.onLevelEnd?.(score.value, level.value.id, stars.value)
    }

    busy.value = false
  }

  function onTileClick(tile: Tile): void {
    if (busy.value || phase.value !== 'playing' || aiOwnsBoard()) return

    const current = selected.value
    if (!current) {
      selected.value = tile
      return
    }
    if (current.id === tile.id) {
      selected.value = null
      return
    }
    if (isAdjacent(current, tile)) {
      void attemptSwap(current, tile)
    } else {
      selected.value = tile
    }
  }

  const dragFrom = shallowRef<Tile | null>(null)
  const dragCurrent = shallowRef<{ x: number; y: number } | null>(null)

  function onTilePointerDown(tile: Tile, event: PointerEvent): void {
    if (busy.value || phase.value !== 'playing' || aiOwnsBoard()) return
    dragFrom.value = tile
    dragCurrent.value = { x: event.clientX, y: event.clientY }
  }

  function onPointerMove(event: PointerEvent): void {
    const from = dragFrom.value
    if (!from || busy.value || aiOwnsBoard()) return

    const current = dragCurrent.value
    if (!current) return

    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    const threshold = 22
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return

    let dr = 0
    let dc = 0
    if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1
    else dr = dy > 0 ? 1 : -1

    const target = tileAt(from.row + dr, from.col + dc)
    dragFrom.value = null
    dragCurrent.value = null
    if (target) void attemptSwap(from, target)
  }

  function onPointerUp(): void {
    dragFrom.value = null
    dragCurrent.value = null
  }

  /* ------------------------------------------------------------------ */
  /* 提示                                                                */
  /* ------------------------------------------------------------------ */

  function clearHint(): void {
    hint.value = []
    window.clearTimeout(idleTimer)
  }

  function showHint(): void {
    if (phase.value !== 'playing' || busy.value || aiOwnsBoard()) return
    const move = findPossibleMove()
    if (move) hint.value = move
  }

  function scheduleHint(): void {
    window.clearTimeout(idleTimer)
    idleTimer = window.setTimeout(showHint, 6500)
  }

  /* ------------------------------------------------------------------ */
  /* 关卡控制                                                            */
  /* ------------------------------------------------------------------ */

  function startLevel(index: number): void {
    levelIndex.value = Math.max(0, Math.min(index, LEVELS.length - 1))
    score.value = 0
    moves.value = level.value.moves
    combo.value = 0
    bestCombo.value = 0
    stars.value = 0
    selected.value = null
    popups.value = []
    wrongPair.value = []
    phase.value = 'playing'
    busy.value = false
    buildBoard()
    scheduleHint()

    // 进入（下一）关卡后不自动接管：等待用户点击确认
    if (ai.enabled) {
      aiRunToken += 1
      ai.status = 'confirm'
      ai.decision = null
      ai.ranked = []
      ai.error = ''
      hint.value = []
    }
  }

  function restart(): void {
    startLevel(levelIndex.value)
  }

  function nextLevel(): void {
    if (levelIndex.value >= LEVELS.length - 1) {
      startLevel(0)
      return
    }
    startLevel(levelIndex.value + 1)
  }

  function togglePause(): void {
    if (phase.value === 'playing') phase.value = 'paused'
    else if (phase.value === 'paused') phase.value = 'playing'
  }

  function useHint(): void {
    showHint()
    scheduleHint()
  }

  /* ------------------------------------------------------------------ */
  /* Jev 外挂                                                            */
  /* ------------------------------------------------------------------ */

  /** 外挂是否正控制棋盘（confirm 状态下允许玩家手动操作） */
  function aiOwnsBoard(): boolean {
    return ai.enabled && ai.status !== 'confirm'
  }

  function aiSnapshot(): Match3Snapshot {
    return {
      grid: typeMatrix(),
      types: typeCount.value,
      level: level.value,
      score: score.value,
      movesLeft: moves.value,
      bestCombo: bestCombo.value,
    }
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

  /**
   * Jev 外挂主循环：思考 → 高亮交换 → 执行 → 消除。
   * 关卡结束后停下；进入下一关由 startLevel 置为 confirm，需用户确认后再开新循环。
   */
  async function aiLoop(token: number): Promise<void> {
    while (ai.enabled && token === aiRunToken) {
      if (phase.value === 'won' || phase.value === 'over') {
        ai.status = 'levelEnd'
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

        const a = tileAt(decision.move.a.row, decision.move.a.col)
        const b = tileAt(decision.move.b.row, decision.move.b.col)
        if (!a || !b) {
          await delay(140)
          continue
        }

        hint.value = [a, b]
        ai.status = 'acting'
        await delay(360)

        if (!ai.enabled || token !== aiRunToken) {
          hint.value = []
          return
        }

        await attemptSwap(a, b)
        hint.value = []
        await delay(160)
      } catch (error) {
        ai.error = error instanceof Error ? error.message : '外挂循环异常'
        hint.value = []
        ai.status = 'waiting'
        await delay(420)
      }
    }

    hint.value = []
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
    hint.value = []
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
      hint.value = []
    }
  }

  /** 用户点击确认后，外挂才在新关卡接管 */
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
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    startLevel(0)
  })

  onBeforeUnmount(() => {
    aiRunToken += 1
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.clearTimeout(idleTimer)
    window.clearTimeout(toastTimer)
  })

  return {
    grid,
    tiles,
    phase,
    level,
    levelIndex,
    barMax,
    score,
    moves,
    movesLeft,
    combo,
    bestCombo,
    progress,
    selected,
    hint,
    popups,
    toast,
    wrongPair,
    stars,
    busy,
    ai,
    startLevel,
    restart,
    nextLevel,
    togglePause,
    useHint,
    toggleAi,
    confirmAi,
    saveApiKey,
    onTileClick,
    onTilePointerDown,
  }
}