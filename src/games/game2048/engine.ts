import { SIZE, SPAWN_FOUR_CHANCE, type Direction } from './constants'

export type Board = number[][]

export interface Slide {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  value: number
  /** 该方块滑向的目标格发生了合并 */
  merge: boolean
}

export interface MergeEvent {
  row: number
  col: number
  value: number
}

export interface MoveResult {
  board: Board
  slides: Slide[]
  merges: MergeEvent[]
  gained: number
  moved: boolean
}

export interface SpawnResult {
  board: Board
  row: number
  col: number
  value: number
}

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

export function emptyCells(board: Board): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) cells.push({ row: r, col: c })
    }
  }
  return cells
}

export function maxTile(board: Board): number {
  let max = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) max = Math.max(max, board[r][c])
  }
  return max
}

export function countEmpty(board: Board): number {
  let count = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) count++
    }
  }
  return count
}

/** 每行/列按移动方向从边缘到内部的遍历顺序 */
function lineCoords(dir: Direction): Array<Array<[number, number]>> {
  const lines: Array<Array<[number, number]>> = []
  for (let i = 0; i < SIZE; i++) {
    const line: Array<[number, number]> = []
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') line.push([i, j])
      else if (dir === 'right') line.push([i, SIZE - 1 - j])
      else if (dir === 'up') line.push([j, i])
      else line.push([SIZE - 1 - j, i])
    }
    lines.push(line)
  }
  return lines
}

/** 纯函数：计算一次滑动后的棋盘、每个方块的位移、合并事件与得分 */
export function planMove(board: Board, dir: Direction): MoveResult {
  const next = emptyBoard()
  const slides: Slide[] = []
  const merges: MergeEvent[] = []
  let gained = 0
  let moved = false

  for (const line of lineCoords(dir)) {
    const entries = line
      .map(([row, col]) => ({ row, col, value: board[row][col] }))
      .filter((entry) => entry.value !== 0)

    let write = 0
    let index = 0
    while (index < entries.length) {
      const first = entries[index]
      const second = entries[index + 1]
      const [toRow, toCol] = line[write]

      if (second && second.value === first.value) {
        const value = first.value * 2
        next[toRow][toCol] = value
        slides.push({
          fromRow: first.row,
          fromCol: first.col,
          toRow,
          toCol,
          value: first.value,
          merge: true,
        })
        slides.push({
          fromRow: second.row,
          fromCol: second.col,
          toRow,
          toCol,
          value: second.value,
          merge: true,
        })
        merges.push({ row: toRow, col: toCol, value })
        gained += value
        moved = true
        index += 2
      } else {
        next[toRow][toCol] = first.value
        slides.push({
          fromRow: first.row,
          fromCol: first.col,
          toRow,
          toCol,
          value: first.value,
          merge: false,
        })
        if (first.row !== toRow || first.col !== toCol) moved = true
        index += 1
      }
      write++
    }
  }

  return { board: next, slides, merges, gained, moved }
}

/** 在随机空格生成 2（90%）或 4（10%），棋盘已满时返回 null */
export function spawnTile(board: Board, random: () => number = Math.random): SpawnResult | null {
  const cells = emptyCells(board)
  if (cells.length === 0) return null
  const cell = cells[Math.floor(random() * cells.length)]
  const value = random() < SPAWN_FOUR_CHANCE ? 4 : 2
  const next = cloneBoard(board)
  next[cell.row][cell.col] = value
  return { board: next, row: cell.row, col: cell.col, value }
}

/** 滑动 + 随机生成，AI 模拟用 */
export function applyMove(
  board: Board,
  dir: Direction,
  random: () => number = Math.random,
): MoveResult & { spawn: SpawnResult | null } {
  const result = planMove(board, dir)
  if (!result.moved) return { ...result, spawn: null }
  return { ...result, spawn: spawnTile(result.board, random) }
}

/** 是否还有任何方向可以移动 */
export function canMove(board: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = board[r][c]
      if (value === 0) return true
      if (c + 1 < SIZE && board[r][c + 1] === value) return true
      if (r + 1 < SIZE && board[r + 1][c] === value) return true
    }
  }
  return false
}

/** 可行方向数量（0 ~ 4） */
export function legalMoveCount(board: Board): number {
  let count = 0
  for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
    if (planMove(board, dir).moved) count++
  }
  return count
}

function log2(value: number): number {
  return Math.log2(value)
}

/** 单调性：行/列越有序越接近 0（负分） */
function monotonicity(board: Board): number {
  let total = 0

  for (let r = 0; r < SIZE; r++) {
    let inc = 0
    let dec = 0
    for (let c = 1; c < SIZE; c++) {
      const a = board[r][c - 1]
      const b = board[r][c]
      if (a === 0 || b === 0) continue
      const diff = log2(b) - log2(a)
      if (diff > 0) inc += diff
      else dec -= diff
    }
    total -= Math.min(inc, dec)
  }

  for (let c = 0; c < SIZE; c++) {
    let inc = 0
    let dec = 0
    for (let r = 1; r < SIZE; r++) {
      const a = board[r - 1][c]
      const b = board[r][c]
      if (a === 0 || b === 0) continue
      const diff = log2(b) - log2(a)
      if (diff > 0) inc += diff
      else dec -= diff
    }
    total -= Math.min(inc, dec)
  }

  return total
}

/** 平滑度：相邻非空方块数值越接近越好（负分） */
function smoothness(board: Board): number {
  let total = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = board[r][c]
      if (value === 0) continue
      if (c + 1 < SIZE && board[r][c + 1] !== 0) {
        total -= Math.abs(log2(value) - log2(board[r][c + 1]))
      }
      if (r + 1 < SIZE && board[r + 1][c] !== 0) {
        total -= Math.abs(log2(value) - log2(board[r + 1][c]))
      }
    }
  }
  return total
}

/** 最大方块待在角落时给奖励 */
function cornerBonus(board: Board): number {
  const max = maxTile(board)
  if (max <= 2) return 0
  const corners = [board[0][0], board[0][SIZE - 1], board[SIZE - 1][0], board[SIZE - 1][SIZE - 1]]
  return corners.includes(max) ? log2(max) : 0
}

/** 局面评估：空格、单调性、平滑度与角落奖励的加权和 */
export function evaluateBoard(board: Board): number {
  return (
    countEmpty(board) * 24 +
    monotonicity(board) * 55 +
    smoothness(board) * 6 +
    cornerBonus(board) * 55
  )
}