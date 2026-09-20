import { askJev, JevAuthError, type ChoiceAnswer, type JevQuestion } from '@/lib/typesafe'
import { COLS, ROWS, SHAPES, type PieceType } from './constants'
import type { Cell, Snapshot } from './engine'

export interface Placement {
  /** r<rotation>c<column>，作为 Choice 的 option id */
  id: string
  piece: PieceType
  /** 相对出生姿态顺时针旋转次数 0-3 */
  rotation: number
  /** 目标列（0 起，方块最左侧单元的列） */
  x: number
  /** 模拟落点的最上方行 */
  y: number
  matrix: number[][]
  minRow: number
  maxRow: number
  width: number
  linesCleared: number
  holes: number
  maxHeight: number
  bumpiness: number
  /** 面板展示用中文标签 */
  label: string
  /** 提交给 Jev 的英文选项说明 */
  description: string
}

export interface RankedOption {
  id: string
  label: string
  probability: number
  chosen: boolean
  linesCleared: number
}

export interface Decision {
  piece: PieceType
  placement: Placement
  confidence: number
  ranked: RankedOption[]
  source: 'jev' | 'fallback'
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  error: string
  at: number
}

export interface BoardStats {
  holes: number
  maxHeight: number
  bumpiness: number
}

function rotateMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  const out: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[c][n - 1 - r] = matrix[r][c]
    }
  }
  return out
}

function collidesOn(grid: Cell[][], matrix: number[][], x: number, y: number): boolean {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue
      const px = x + c
      const py = y + r
      if (px < 0 || px >= COLS || py >= ROWS) return true
      if (py >= 0 && grid[py][px]) return true
    }
  }
  return false
}

function analyze(grid: Cell[][]): BoardStats {
  const heights: number[] = []
  let holes = 0

  for (let x = 0; x < COLS; x++) {
    let top = ROWS
    for (let y = 0; y < ROWS; y++) {
      if (grid[y][x]) {
        top = y
        break
      }
    }
    heights.push(ROWS - top)
    let seen = false
    for (let y = top; y < ROWS; y++) {
      if (grid[y][x]) seen = true
      else if (seen) holes++
    }
  }

  let bumpiness = 0
  for (let x = 0; x < COLS - 1; x++) {
    bumpiness += Math.abs(heights[x + 1] - heights[x])
  }

  return { holes, maxHeight: Math.max(...heights), bumpiness }
}

function clearFullRows(grid: Cell[][]): number {
  let cleared = 0
  for (let y = 0; y < ROWS; y++) {
    if (grid[y].every((cell) => cell !== null)) cleared++
  }
  return cleared
}

function settle(grid: Cell[][]): Cell[][] {
  const remaining = grid.filter((row) => !row.every((cell) => cell !== null))
  while (remaining.length < ROWS) remaining.unshift(Array<Cell>(COLS).fill(null))
  return remaining
}

function matrixText(matrix: number[][]): string[] {
  return matrix.map((row) => row.map((value) => (value ? '#' : '.')).join(''))
}

function rotationMatrices(type: PieceType): number[][][] {
  const rotations: number[][][] = []
  let matrix = SHAPES[type].map((row) => [...row])
  for (let i = 0; i < 4; i++) {
    const key = JSON.stringify(matrix)
    if (!rotations.some((m) => JSON.stringify(m) === key)) rotations.push(matrix)
    matrix = rotateMatrix(matrix)
  }
  return rotations
}

function boardAscii(grid: Cell[][]): string[] {
  return grid.map((row, y) => `${String(y).padStart(2, '0')} |${row.map((cell) => (cell ? '#' : '.')).join('')}|`)
}

/** 枚举当前方块所有可达的最终落点（去重后） */
export function enumeratePlacements(snapshot: Snapshot): Placement[] {
  const active = snapshot.active
  if (!active) return []

  const seen = new Set<string>()
  const placements: Placement[] = []
  let matrix = SHAPES[active.type].map((row) => [...row])

  for (let rotation = 0; rotation < 4; rotation++) {
    if (rotation > 0) matrix = rotateMatrix(matrix)

    const cells: Array<[number, number]> = []
    let minC = COLS
    let maxC = -1
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue
        cells.push([r, c])
        minC = Math.min(minC, c)
        maxC = Math.max(maxC, c)
      }
    }
    if (cells.length === 0) continue

    for (let x = -minC; x <= COLS - 1 - maxC; x++) {
      let y = -matrix.length
      while (!collidesOn(snapshot.grid, matrix, x, y + 1)) y++
      if (collidesOn(snapshot.grid, matrix, x, y)) continue

      const result = snapshot.grid.map((row) => [...row])
      let above = false
      let minRow = ROWS
      let maxRow = -1
      for (const [r, c] of cells) {
        const py = y + r
        if (py < 0) {
          above = true
          break
        }
        result[py][x + c] = active.type
        minRow = Math.min(minRow, py)
        maxRow = Math.max(maxRow, py)
      }
      if (above) continue

      const key = result.map((row) => row.map((cell) => (cell ? '1' : '0')).join('')).join('')
      if (seen.has(key)) continue
      seen.add(key)

      const linesCleared = clearFullRows(result)
      const stats = analyze(settle(result))
      const width = maxC - minC + 1
      const firstCol = x + minC
      const colText = width > 1 ? `${x + 1}-${x + width} 列` : `${x + 1} 列`

      placements.push({
        id: `r${rotation}c${x}`,
        piece: active.type,
        rotation,
        x,
        y,
        matrix,
        minRow,
        maxRow,
        width,
        linesCleared,
        holes: stats.holes,
        maxHeight: stats.maxHeight,
        bumpiness: stats.bumpiness,
        label: `旋转 ${rotation}× · ${colText}`,
        description:
          `Rotate ${rotation} turn(s) clockwise, drop into column ${firstCol} (0-indexed, leftmost = 0): ` +
          `occupies rows ${minRow}-${maxRow}; clears ${linesCleared} line(s); ` +
          `after clearing → holes ${stats.holes}, max stack height ${stats.maxHeight}, surface bumpiness ${stats.bumpiness}.`,
      })
    }
  }

  return placements
}

function buildState(snapshot: Snapshot) {
  const active = snapshot.active
  return {
    game: 'Tetris (SRS rotation, 7-bag randomizer)',
    objective: [
      'Clear as many lines as possible.',
      'Avoid creating holes (empty cells covered by blocks).',
      'Keep the stack low and the surface flat.',
      'Keep future options open for the upcoming pieces.',
    ],
    notes: [
      'This is a placement decision for the current falling piece.',
      'Columns are 0-indexed from the left. Row 00 is the top, row 19 is the floor.',
      '"#" is a locked block, "." is empty.',
      'Option ids are r<rotation>c<target column>; rotation is the number of clockwise turns from spawn orientation.',
    ],
    board: {
      columns: COLS,
      rows: ROWS,
      grid_ascii: boardAscii(snapshot.grid),
      current_piece: active
        ? {
            type: active.type,
            shape_at_spawn: matrixText(SHAPES[active.type]),
            shapes_by_rotation: rotationMatrices(active.type).map(matrixText),
          }
        : null,
      next_pieces: snapshot.queue.slice(0, 5),
      hold: snapshot.hold,
      level: snapshot.level,
      lines_cleared: snapshot.lines,
      score: snapshot.score,
    },
  }
}

function heuristicScore(placement: Placement): number {
  return (
    placement.linesCleared * 120 -
    placement.holes * 26 -
    placement.maxHeight * 6 -
    placement.bumpiness * 3
  )
}

function softmax(values: number[], temperature = 14): number[] {
  if (values.length === 0) return []
  const max = Math.max(...values)
  const exps = values.map((value) => Math.exp((value - max) / temperature))
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1
  return exps.map((value) => value / sum)
}

function rankOptions(
  placements: Placement[],
  probabilities: Map<string, number>,
  chosenId: string,
): RankedOption[] {
  return placements
    .map((placement) => ({
      id: placement.id,
      label: placement.label,
      probability: probabilities.get(placement.id) ?? 0,
      chosen: placement.id === chosenId,
      linesCleared: placement.linesCleared,
    }))
    .sort((a, b) => b.probability - a.probability)
}

function fallbackDecision(
  snapshot: Snapshot,
  placements: Placement[],
  error: string,
  startedAt: number,
): Decision {
  const scores = placements.map(heuristicScore)
  const weights = softmax(scores)
  const probabilities = new Map<string, number>()
  placements.forEach((placement, index) => probabilities.set(placement.id, weights[index] ?? 0))

  const ranked = rankOptions(placements, probabilities, '')
  const chosen = placements.find((placement) => placement.id === ranked[0]?.id) ?? placements[0]

  return {
    piece: snapshot.active?.type ?? chosen.piece,
    placement: chosen,
    confidence: ranked[0]?.probability ?? 0,
    ranked: rankOptions(placements, probabilities, chosen.id),
    source: 'fallback',
    model: 'local-heuristic',
    latencyMs: Math.round(performance.now() - startedAt),
    inputTokens: 0,
    outputTokens: 0,
    error,
    at: Date.now(),
  }
}

/** 让 Jev 选择当前方块的最佳落点；任何失败都会退化为本地启发式并继续游戏 */
export async function decidePlacement(snapshot: Snapshot): Promise<Decision> {
  const startedAt = performance.now()
  const placements = enumeratePlacements(snapshot)
  if (placements.length === 0) throw new Error('没有可用的落点')

  const active = snapshot.active
  const criteria: Record<string, string> = {}
  for (const placement of placements) criteria[placement.id] = placement.description

  const state = buildState(snapshot)

  const questions: Record<string, JevQuestion> = {
    placement: {
      type: 'choice',
      instructions: {
        question:
          'Which final placement of the current piece is best? Weigh line clears, holes, stack height and surface flatness.',
        state_hint:
          'The board, the current piece and the upcoming pieces are described in `board`; each option is one reachable landing position with its outcome.',
      },
      criteria,
    },
  }

  try {
    const response = await askJev(state, questions)
    const answer = response.answers.placement as ChoiceAnswer | undefined
    if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') {
      throw new Error('Jev 未返回 Choice 答案')
    }

    const probabilities = answer.probabilities ?? {}
    const chosen =
      placements.find((placement) => placement.id === answer.choice) ??
      placements.find(
        (placement) =>
          probabilities[placement.id] ===
          Math.max(...placements.map((item) => probabilities[item.id] ?? 0)),
      ) ??
      placements[0]

    return {
      piece: active?.type ?? chosen.piece,
      placement: chosen,
      confidence: typeof answer.confidence === 'number' ? answer.confidence : 0,
      ranked: rankOptions(placements, new Map(Object.entries(probabilities)), chosen.id),
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
    return fallbackDecision(snapshot, placements, message, startedAt)
  }
}