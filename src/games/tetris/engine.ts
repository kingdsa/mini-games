import {
  CLEAR_ANIMATION_MS,
  COLS,
  ENTRY_DELAY_MS,
  KICKS_I,
  KICKS_JLSTZ,
  LINE_SCORES,
  LOCK_DELAY,
  MAX_LOCK_RESETS,
  PIECE_TYPES,
  ROWS,
  SHAPES,
  SPAWN_X,
  gravityForLevel,
  type PieceType,
} from './constants'

export type Cell = PieceType | null
export type Phase = 'ready' | 'playing' | 'clearing' | 'paused' | 'over'

export interface ActivePiece {
  type: PieceType
  matrix: number[][]
  x: number
  y: number
  rotation: number
}

export type GameEvent =
  | { type: 'move' }
  | { type: 'rotate' }
  | { type: 'drop' }
  | { type: 'lock' }
  | { type: 'hold' }
  | { type: 'clear'; lines: number; score: number }
  | { type: 'levelup'; level: number }
  | { type: 'gameover'; score: number }
  | { type: 'ready' }

export interface Snapshot {
  grid: Cell[][]
  active: ActivePiece | null
  ghostY: number
  queue: PieceType[]
  hold: PieceType | null
  score: number
  lines: number
  level: number
  combo: number
  phase: Phase
  clearingRows: number[]
  clearProgress: number
  canHold: boolean
}

function rotateMatrix(matrix: number[][], dir: 1 | -1): number[][] {
  const n = matrix.length
  const out: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dir === 1) out[c][n - 1 - r] = matrix[r][c]
      else out[n - 1 - c][r] = matrix[r][c]
    }
  }
  return out
}

export class TetrisEngine {
  grid: Cell[][] = []
  active: ActivePiece | null = null
  queue: PieceType[] = []
  hold: PieceType | null = null
  canHold = true

  score = 0
  lines = 0
  level = 1
  combo = 0

  phase: Phase = 'ready'
  clearingRows: number[] = []
  clearElapsed = 0
  entryElapsed = 0

  private fallAccumulator = 0
  private lockTimer = 0
  private lockResets = 0
  private bag: PieceType[] = []
  private onEvent: (event: GameEvent) => void
  private rng: () => number

  constructor(onEvent: (event: GameEvent) => void = () => {}, rng: () => number = Math.random) {
    this.onEvent = onEvent
    this.rng = rng
    this.reset()
  }

  /* ------------------------------------------------------------------ */
  /* 生命周期                                                            */
  /* ------------------------------------------------------------------ */

  reset(): void {
    this.grid = Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null))
    this.queue = []
    this.bag = []
    this.hold = null
    this.canHold = true
    this.score = 0
    this.lines = 0
    this.level = 1
    this.combo = 0
    this.phase = 'ready'
    this.clearingRows = []
    this.clearElapsed = 0
    this.entryElapsed = 0
    this.fallAccumulator = 0
    this.lockTimer = 0
    this.lockResets = 0
    this.active = null
    this.refillQueue()
    this.onEvent({ type: 'ready' })
  }

  start(): void {
    if (this.phase === 'ready' || this.phase === 'over') {
      if (this.phase === 'over') this.reset()
      this.phase = 'playing'
      this.spawn()
    } else if (this.phase === 'paused') {
      this.phase = 'playing'
    }
  }

  pause(): void {
    if (this.phase === 'playing') this.phase = 'paused'
  }

  togglePause(): void {
    if (this.phase === 'playing') this.pause()
    else if (this.phase === 'paused') this.start()
  }

  /* ------------------------------------------------------------------ */
  /* 随机序列：7-bag                                                     */
  /* ------------------------------------------------------------------ */

  private refillQueue(): void {
    while (this.queue.length <= 6) {
      if (this.bag.length === 0) {
        this.bag = [...PIECE_TYPES]
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1))
          ;[this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]
        }
      }
      this.queue.push(this.bag.pop() as PieceType)
    }
  }

  private spawn(type?: PieceType): void {
    const nextType = type ?? (this.queue.shift() as PieceType)
    this.refillQueue()

    const matrix = SHAPES[nextType].map((row) => [...row])
    const piece: ActivePiece = {
      type: nextType,
      matrix,
      x: SPAWN_X[nextType],
      y: -1,
      rotation: 0,
    }

    if (this.collides(piece.matrix, piece.x, piece.y)) {
      this.active = piece
      this.phase = 'over'
      this.onEvent({ type: 'gameover', score: this.score })
      return
    }

    this.active = piece
    this.fallAccumulator = 0
    this.lockTimer = 0
    this.lockResets = 0
    this.entryElapsed = ENTRY_DELAY_MS
  }

  /* ------------------------------------------------------------------ */
  /* 碰撞与旋转                                                          */
  /* ------------------------------------------------------------------ */

  collides(matrix: number[][], px: number, py: number): boolean {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue
        const x = px + c
        const y = py + r
        if (x < 0 || x >= COLS) return true
        if (y >= ROWS) return true
        if (y >= 0 && this.grid[y][x]) return true
      }
    }
    return false
  }

  private resetLockTimer(): void {
    if (this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0
      this.lockResets++
    }
  }

  private isGrounded(): boolean {
    if (!this.active) return false
    return this.collides(this.active.matrix, this.active.x, this.active.y + 1)
  }

  private applyKick(target: ActivePiece, from: number, to: number): boolean {
    const table = target.type === 'I' ? KICKS_I : KICKS_JLSTZ
    if (target.type === 'O') {
      target.rotation = to
      return true
    }
    const kicks = table[`${from}>${to}`] ?? [[0, 0]]
    for (const [dx, dy] of kicks) {
      const nx = target.x + dx
      const ny = target.y + dy
      if (!this.collides(target.matrix, nx, ny)) {
        target.x = nx
        target.y = ny
        target.rotation = to
        return true
      }
    }
    return false
  }

  /* ------------------------------------------------------------------ */
  /* 操作                                                               */
  /* ------------------------------------------------------------------ */

  move(dx: number): boolean {
    if (this.phase !== 'playing' || !this.active) return false
    if (this.collides(this.active.matrix, this.active.x + dx, this.active.y)) return false
    this.active.x += dx
    if (this.isGrounded()) this.resetLockTimer()
    this.onEvent({ type: 'move' })
    return true
  }

  rotate(dir: 1 | -1): boolean {
    if (this.phase !== 'playing' || !this.active) return false
    const from = this.active.rotation
    const to = (from + (dir === 1 ? 1 : 3)) % 4

    const rotated = rotateMatrix(this.active.matrix, dir)
    const candidate: ActivePiece = { ...this.active, matrix: rotated }

    if (this.applyKick(candidate, from, to)) {
      this.active.matrix = candidate.matrix
      this.active.x = candidate.x
      this.active.y = candidate.y
      this.active.rotation = candidate.rotation
      if (this.isGrounded()) this.resetLockTimer()
      this.onEvent({ type: 'rotate' })
      return true
    }
    return false
  }

  softDrop(): boolean {
    if (this.phase !== 'playing' || !this.active) return false
    if (this.collides(this.active.matrix, this.active.x, this.active.y + 1)) {
      this.lockTimer = LOCK_DELAY
      return false
    }
    this.active.y++
    this.score += 1
    this.fallAccumulator = 0
    this.onEvent({ type: 'move' })
    return true
  }

  hardDrop(): void {
    if (this.phase !== 'playing' || !this.active) return
    let dropped = 0
    while (!this.collides(this.active.matrix, this.active.x, this.active.y + 1)) {
      this.active.y++
      dropped++
    }
    this.score += dropped * 2
    this.onEvent({ type: 'drop' })
    this.lock()
  }

  holdPiece(): void {
    if (this.phase !== 'playing' || !this.active || !this.canHold) return
    const current = this.active.type
    const swap = this.hold
    this.hold = current
    this.canHold = false
    this.active = null
    this.onEvent({ type: 'hold' })
    this.spawn(swap ?? undefined)
  }

  ghostY(): number {
    if (!this.active) return 0
    let y = this.active.y
    while (!this.collides(this.active.matrix, this.active.x, y + 1)) y++
    return y
  }

  /* ------------------------------------------------------------------ */
  /* 锁定与消行                                                          */
  /* ------------------------------------------------------------------ */

  private lock(): void {
    if (!this.active) return

    let aboveField = false
    for (let r = 0; r < this.active.matrix.length; r++) {
      for (let c = 0; c < this.active.matrix[r].length; c++) {
        if (!this.active.matrix[r][c]) continue
        const y = this.active.y + r
        const x = this.active.x + c
        if (y < 0) {
          aboveField = true
          continue
        }
        this.grid[y][x] = this.active.type
      }
    }

    this.onEvent({ type: 'lock' })
    this.active = null
    this.canHold = true
    this.lockTimer = 0
    this.lockResets = 0

    if (aboveField) {
      this.phase = 'over'
      this.onEvent({ type: 'gameover', score: this.score })
      return
    }

    const full: number[] = []
    for (let y = 0; y < ROWS; y++) {
      if (this.grid[y].every((cell) => cell !== null)) full.push(y)
    }

    if (full.length > 0) {
      this.clearingRows = full
      this.clearElapsed = 0
      this.phase = 'clearing'

      const prevLevel = this.level
      this.combo++
      let gained = LINE_SCORES[full.length] * this.level
      if (this.combo > 1) gained += 50 * (this.combo - 1) * this.level
      this.score += gained
      this.lines += full.length
      this.level = Math.floor(this.lines / 10) + 1

      this.onEvent({ type: 'clear', lines: full.length, score: gained })
      if (this.level > prevLevel) this.onEvent({ type: 'levelup', level: this.level })

      if (this.clearElapsed >= CLEAR_ANIMATION_MS) this.finishClear()
      return
    }

    this.combo = 0
    this.spawn()
  }

  private finishClear(): void {
    const rows = this.clearingRows
    if (rows.length === 0) return

    const remaining = this.grid.filter((_, y) => !rows.includes(y))
    while (remaining.length < ROWS) {
      remaining.unshift(Array<Cell>(COLS).fill(null))
    }
    this.grid = remaining
    this.clearingRows = []
    this.clearElapsed = 0
    this.phase = 'playing'
    this.spawn()
  }

  /* ------------------------------------------------------------------ */
  /* 主循环                                                              */
  /* ------------------------------------------------------------------ */

  update(dt: number): void {
    if (this.phase === 'clearing') {
      this.clearElapsed += dt
      if (this.clearElapsed >= CLEAR_ANIMATION_MS) this.finishClear()
      return
    }

    if (this.phase !== 'playing' || !this.active) return

    if (this.entryElapsed > 0) {
      const step = Math.min(dt, this.entryElapsed)
      this.entryElapsed -= step
      this.fallAccumulator += step * 2
    } else {
      this.fallAccumulator += dt
    }

    const interval = gravityForLevel(this.level)
    const grounded = this.isGrounded()

    if (!grounded) {
      while (this.fallAccumulator >= interval) {
        this.fallAccumulator -= interval
        if (this.collides(this.active.matrix, this.active.x, this.active.y + 1)) break
        this.active.y++
      }
    } else {
      this.fallAccumulator = 0
      this.lockTimer += dt
      if (this.lockTimer >= LOCK_DELAY) this.lock()
    }
  }

  serialize(): Snapshot {
    return {
      grid: this.grid,
      active: this.active,
      ghostY: this.ghostY(),
      queue: this.queue.slice(0, 5),
      hold: this.hold,
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: Math.max(0, this.combo - 1),
      phase: this.phase,
      clearingRows: this.clearingRows,
      clearProgress: Math.min(1, this.clearElapsed / CLEAR_ANIMATION_MS),
      canHold: this.canHold,
    }
  }
}

/** 裁剪掉空白行列，用于渲染迷你预览图 */
export function trimmedMatrix(type: PieceType): number[][] {
  const m = SHAPES[type]
  const rows: number[] = []
  const cols: number[] = []
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (m[r][c]) {
        rows.push(r)
        cols.push(c)
      }
    }
  }
  const minR = Math.min(...rows)
  const maxR = Math.max(...rows)
  const minC = Math.min(...cols)
  const maxC = Math.max(...cols)
  return m.slice(minR, maxR + 1).map((row) => row.slice(minC, maxC + 1))
}