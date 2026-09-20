import { askJev, type ChoiceAnswer, type JevQuestion } from '@/lib/typesafe'
import { BASE_POINTS, COLS, ROWS, comboMultiplier, type LevelConfig } from './constants'

export interface Cell {
  row: number
  col: number
}

export interface MoveCandidate {
  /** `r,c-r,c`，作为 Choice 的 option id */
  id: string
  a: Cell
  b: Cell
  typeA: number
  typeB: number
  immediateMatches: number
  avgScore: number
  avgCleared: number
  maxChain: number
  avgMovesLeft: number
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
  estimatedScore: number
}

export interface Match3Snapshot {
  grid: (number | null)[][]
  types: number
  level: LevelConfig
  score: number
  movesLeft: number
  bestCombo: number
}

export interface Decision {
  move: MoveCandidate
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

/** 每个候选落子随机补牌模拟次数（用于估计连锁收益） */
const ROLLOUTS = 3
/** 连锁深度上限，防御病态局面 */
const MAX_CHAIN = 24

function cloneGrid(grid: (number | null)[][]): (number | null)[][] {
  return grid.map((row) => [...row])
}

function findMatchesIn(grid: (number | null)[][]): Cell[] {
  const found: Cell[] = []
  const seen = new Set<number>()
  const push = (row: number, col: number) => {
    const key = row * COLS + col
    if (!seen.has(key)) {
      seen.add(key)
      found.push({ row, col })
    }
  }

  for (let r = 0; r < ROWS; r++) {
    let start = 0
    for (let c = 1; c <= COLS; c++) {
      const prev = grid[r][c - 1]
      const cur = c < COLS ? grid[r][c] : null
      const same = prev !== null && cur !== null && cur === prev
      if (!same) {
        if (c - start >= 3 && prev !== null) {
          for (let k = start; k < c; k++) push(r, k)
        }
        start = c
      }
    }
  }

  for (let c = 0; c < COLS; c++) {
    let start = 0
    for (let r = 1; r <= ROWS; r++) {
      const prev = grid[r - 1][c]
      const cur = r < ROWS ? grid[r][c] : null
      const same = prev !== null && cur !== null && cur === prev
      if (!same) {
        if (r - start >= 3 && prev !== null) {
          for (let k = start; k < r; k++) push(k, c)
        }
        start = r
      }
    }
  }

  return found
}

function collapseAndRefill(grid: (number | null)[][], types: number): void {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      const value = grid[r][c]
      if (value === null) continue
      if (r !== write) {
        grid[write][c] = value
        grid[r][c] = null
      }
      write--
    }
    for (let r = write; r >= 0; r--) grid[r][c] = Math.floor(Math.random() * types)
  }
}

/** 统计盘面仍有多少可消除的相邻交换 */
function countPossibleMoves(grid: (number | null)[][]): number {
  let count = 0
  const swap = (r1: number, c1: number, r2: number, c2: number) => {
    const tmp = grid[r1][c1]
    grid[r1][c1] = grid[r2][c2]
    grid[r2][c2] = tmp
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) {
        swap(r, c, r, c + 1)
        if (findMatchesIn(grid).length > 0) count++
        swap(r, c, r, c + 1)
      }
      if (r + 1 < ROWS) {
        swap(r, c, r + 1, c)
        if (findMatchesIn(grid).length > 0) count++
        swap(r, c, r + 1, c)
      }
    }
  }

  return count
}

interface SimulationResult {
  immediateMatches: number
  avgScore: number
  avgCleared: number
  maxChain: number
  avgMovesLeft: number
}

/** 模拟一次交换后的完整连锁（补牌随机，取多次平均） */
function simulateMove(
  grid: (number | null)[][],
  a: Cell,
  b: Cell,
  types: number,
): SimulationResult {
  let score = 0
  let cleared = 0
  let maxChain = 0
  let movesLeftTotal = 0
  let immediate = 0

  for (let run = 0; run < ROLLOUTS; run++) {
    const board = cloneGrid(grid)
    const tmp = board[a.row][a.col]
    board[a.row][a.col] = board[b.row][b.col]
    board[b.row][b.col] = tmp

    let chain = 0
    let runScore = 0
    let runCleared = 0

    for (;;) {
      const matches = findMatchesIn(board)
      if (matches.length === 0) break

      chain++
      if (chain === 1) immediate = matches.length
      runScore += Math.round(matches.length * BASE_POINTS * comboMultiplier(chain))
      runCleared += matches.length

      for (const cell of matches) board[cell.row][cell.col] = null
      collapseAndRefill(board, types)

      if (chain >= MAX_CHAIN) break
    }

    score += runScore
    cleared += runCleared
    maxChain = Math.max(maxChain, chain)
    movesLeftTotal += countPossibleMoves(board)
  }

  return {
    immediateMatches: immediate,
    avgScore: Math.round(score / ROLLOUTS),
    avgCleared: Math.round(cleared / ROLLOUTS),
    maxChain,
    avgMovesLeft: Math.round((movesLeftTotal / ROLLOUTS) * 10) / 10,
  }
}

/** 枚举所有能立即产生消除的相邻交换 */
export function enumerateMoves(snapshot: Match3Snapshot): MoveCandidate[] {
  const grid = snapshot.grid
  const moves: MoveCandidate[] = []

  const consider = (a: Cell, b: Cell) => {
    const probe = cloneGrid(grid)
    const tmp = probe[a.row][a.col]
    probe[a.row][a.col] = probe[b.row][b.col]
    probe[b.row][b.col] = tmp
    if (findMatchesIn(probe).length === 0) return

    const stats = simulateMove(grid, a, b, snapshot.types)
    const horizontal = a.row === b.row

    moves.push({
      id: `${a.row},${a.col}-${b.row},${b.col}`,
      a,
      b,
      typeA: grid[a.row][a.col] ?? 0,
      typeB: grid[b.row][b.col] ?? 0,
      ...stats,
      label: horizontal
        ? `R${a.row + 1} · C${a.col + 1} ↔ C${b.col + 1}`
        : `C${a.col + 1} · R${a.row + 1} ↕ R${b.row + 1}`,
      description:
        `Swap cell (row ${a.row}, col ${a.col}) with (row ${b.row}, col ${b.col}) ` +
        `[0-indexed, row 0 = top, col 0 = left]. ` +
        `Creates a match of ${stats.immediateMatches} tile(s). ` +
        `Simulated cascade averages about ${stats.avgScore} points, clears ~${stats.avgCleared} tile(s), ` +
        `reaches chain x${stats.maxChain}, and leaves ~${stats.avgMovesLeft} possible move(s) on the settled board.`,
    })
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) consider({ row: r, col: c }, { row: r, col: c + 1 })
      if (r + 1 < ROWS) consider({ row: r, col: c }, { row: r + 1, col: c })
    }
  }

  return moves
}

function boardAscii(grid: (number | null)[][]): string[] {
  return grid.map(
    (row, r) => `${String(r).padStart(2, '0')} |${row.map((v) => (v === null ? '.' : String(v))).join('')}|`,
  )
}

function buildState(snapshot: Match3Snapshot) {
  return {
    game: `Match-3 (${ROWS}x${COLS} grid, ${snapshot.types} candy types, cascading matches)`,
    objective: [
      'Maximize total score while moves remain.',
      'Trigger cascades: each chain level increases the multiplier by 0.5.',
      'Preserve board mobility so future moves keep scoring.',
    ],
    scoring: `Each cleared tile scores ${BASE_POINTS} points before the chain multiplier (1 + 0.5 x (chain - 1)).`,
    notes: [
      'Cells are 0-indexed: row 0 is the top row, column 0 is the leftmost column.',
      'Each option is a legal adjacent swap that already creates at least one match.',
      'Option scores come from Monte-Carlo simulation with random refills; treat them as expectations.',
    ],
    board: {
      rows: ROWS,
      cols: COLS,
      grid_ascii: boardAscii(snapshot.grid),
      level: {
        id: snapshot.level.id,
        name: snapshot.level.name,
        target_score: snapshot.level.target,
        total_moves: snapshot.level.moves,
        candy_types: snapshot.types,
      },
      score: snapshot.score,
      moves_left: snapshot.movesLeft,
      best_combo: snapshot.bestCombo,
    },
  }
}

function heuristicScore(move: MoveCandidate): number {
  const mobility = move.avgMovesLeft * 22
  const dead = move.avgMovesLeft < 1 ? 260 : 0
  return move.avgScore + move.maxChain * 60 + mobility - dead
}

function softmax(values: number[], temperature = 160): number[] {
  if (values.length === 0) return []
  const max = Math.max(...values)
  const exps = values.map((value) => Math.exp((value - max) / temperature))
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1
  return exps.map((value) => value / sum)
}

function rankOptions(
  moves: MoveCandidate[],
  probabilities: Map<string, number>,
  chosenId: string,
): RankedOption[] {
  return moves
    .map((move) => ({
      id: move.id,
      label: move.label,
      probability: probabilities.get(move.id) ?? 0,
      chosen: move.id === chosenId,
      estimatedScore: move.avgScore,
    }))
    .sort((a, b) => b.probability - a.probability)
}

function fallbackDecision(
  moves: MoveCandidate[],
  error: string,
  startedAt: number,
): Decision {
  const scores = moves.map(heuristicScore)
  const weights = softmax(scores)
  const probabilities = new Map<string, number>()
  moves.forEach((move, index) => probabilities.set(move.id, weights[index] ?? 0))

  const ranked = rankOptions(moves, probabilities, '')
  const chosen = moves.find((move) => move.id === ranked[0]?.id) ?? moves[0]

  return {
    move: chosen,
    confidence: ranked[0]?.probability ?? 0,
    ranked: rankOptions(moves, probabilities, chosen.id),
    source: 'fallback',
    model: 'local-heuristic',
    latencyMs: Math.round(performance.now() - startedAt),
    inputTokens: 0,
    outputTokens: 0,
    error,
    at: Date.now(),
  }
}

/** 让 Jev 选择当前最佳交换；任何失败都会退化为本地启发式并继续游戏 */
export async function decideMove(snapshot: Match3Snapshot): Promise<Decision> {
  const startedAt = performance.now()
  const moves = enumerateMoves(snapshot)
  if (moves.length === 0) throw new Error('没有可消除的交换')

  const criteria: Record<string, string> = {}
  for (const move of moves) criteria[move.id] = move.description

  const state = buildState(snapshot)

  const questions: Record<string, JevQuestion> = {
    move: {
      type: 'choice',
      instructions: {
        question:
          'Which adjacent swap is best now? Weigh estimated cascade score, chain depth, tiles cleared and how many moves stay available afterwards.',
        state_hint:
          'The board and level context are described in `board`; each option is one legal swap with its simulated outcome.',
      },
      criteria,
    },
  }

  try {
    const response = await askJev(state, questions)
    const answer = response.answers.move as ChoiceAnswer | undefined
    if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') {
      throw new Error('Jev 未返回 Choice 答案')
    }

    const probabilities = answer.probabilities ?? {}
    const chosen =
      moves.find((move) => move.id === answer.choice) ??
      moves.find(
        (move) =>
          probabilities[move.id] ===
          Math.max(...moves.map((item) => probabilities[item.id] ?? 0)),
      ) ??
      moves[0]

    return {
      move: chosen,
      confidence: typeof answer.confidence === 'number' ? answer.confidence : 0,
      ranked: rankOptions(moves, new Map(Object.entries(probabilities)), chosen.id),
      source: 'jev',
      model: response.model,
      latencyMs: Math.round(performance.now() - startedAt),
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      error: '',
      at: Date.now(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return fallbackDecision(moves, message, startedAt)
  }
}