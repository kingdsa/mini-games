import { askJev, JevAuthError, type ChoiceAnswer, type JevQuestion } from '@/lib/typesafe'
import { DIRECTION_META, SIZE, WIN_VALUE, DIRECTIONS, type Direction } from './constants'
import {
  applyMove,
  countEmpty,
  evaluateBoard,
  legalMoveCount,
  maxTile,
  type Board,
} from './engine'

export interface MoveCandidate {
  /** 方向即选项 id */
  id: Direction
  direction: Direction
  /** 面板展示用中文标签 */
  label: string
  /** 提交给 Jev 的英文选项说明 */
  description: string
  /** 本次滑动的合并得分 */
  gain: number
  /** 随机生成后平均空格数 */
  avgEmpty: number
  /** 随机生成后出现的最大方块 */
  maxTile: number
  /** 随机生成后平均剩余可行方向数 */
  avgMoves: number
  /** 综合评估分（合并得分 + 局面评估） */
  avgScore: number
}

export interface RankedOption {
  id: string
  label: string
  probability: number
  chosen: boolean
  estimatedScore: number
}

export interface Game2048Snapshot {
  board: Board
  score: number
  moveCount: number
  maxTile: number
  targetReached: boolean
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

/** 每个方向的随机补牌模拟次数 */
const ROLLOUTS = 4

/** 枚举所有能改变棋盘的滑动方向，并用蒙特卡洛估计收益 */
export function enumerateMoves(board: Board): MoveCandidate[] {
  const candidates: MoveCandidate[] = []

  for (const direction of DIRECTIONS) {
    const first = applyMove(board, direction)
    if (!first.moved) continue

    let totalScore = 0
    let totalEmpty = 0
    let totalMoves = 0
    let peak = 0

    for (let run = 0; run < ROLLOUTS; run++) {
      const moved = applyMove(board, direction)
      const next = moved.spawn ? moved.spawn.board : moved.board
      totalScore += moved.gained + evaluateBoard(next)
      totalEmpty += countEmpty(next)
      totalMoves += legalMoveCount(next)
      peak = Math.max(peak, maxTile(next))
    }

    const meta = DIRECTION_META[direction]
    const avgEmpty = Math.round(totalEmpty / ROLLOUTS)
    const avgMoves = Math.round((totalMoves / ROLLOUTS) * 10) / 10

    candidates.push({
      id: direction,
      direction,
      label: meta.label,
      description:
        `Slide all tiles ${direction.toUpperCase()}. ` +
        `Immediate merge gain ${first.gained} points. ` +
        `Monte-Carlo over ${ROLLOUTS} random spawns: about ${avgEmpty} empty cell(s), ` +
        `largest tile ${peak}, ${avgMoves} of 4 directions still playable, ` +
        `combined evaluation ${Math.round(totalScore / ROLLOUTS)}.`,
      gain: first.gained,
      avgEmpty,
      maxTile: peak,
      avgMoves,
      avgScore: Math.round(totalScore / ROLLOUTS),
    })
  }

  return candidates
}

function gridAscii(board: Board): string[] {
  return board.map((row, r) => `${String(r).padStart(2, '0')} |${row.map((v) => String(v).padStart(4, ' ')).join(' ')}|`)
}

function buildState(snapshot: Game2048Snapshot) {
  return {
    game: `2048 (${SIZE}x${SIZE} sliding tile puzzle)`,
    objective: [
      'Merge equal tiles by sliding the whole board in one direction.',
      'Maximize score while keeping the board playable for as long as possible.',
      'Keep empty space, keep rows and columns monotonic, and park the largest tile in a corner.',
    ],
    scoring: 'Every merge awards points equal to the value of the newly created tile.',
    notes: [
      'Rows are 0-indexed from the top, columns are 0-indexed from the left.',
      'After every legal move the game spawns a random tile: 2 (90%) or 4 (10%).',
      'Each option is a legal slide; its statistics come from Monte-Carlo rollouts with random spawns, treat them as expectations.',
      `The run is already won once the ${WIN_VALUE} tile exists; the game only ends when no direction can move a single tile.`,
    ],
    board: {
      rows: SIZE,
      cols: SIZE,
      grid: snapshot.board,
      grid_ascii: gridAscii(snapshot.board),
      score: snapshot.score,
      moves: snapshot.moveCount,
      max_tile: snapshot.maxTile,
      empty_cells: countEmpty(snapshot.board),
      target: WIN_VALUE,
      already_reached_target: snapshot.targetReached,
    },
  }
}

/** 本地启发式评分，用于兜底决策与提示 */
export function heuristicScore(candidate: MoveCandidate): number {
  const mobility = candidate.avgMoves * 26
  const suffocating = candidate.avgMoves < 2 ? 220 : 0
  return candidate.avgScore + candidate.gain * 0.6 + mobility - suffocating
}

function softmax(values: number[], temperature = 120): number[] {
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

function fallbackDecision(moves: MoveCandidate[], error: string, startedAt: number): Decision {
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

/** 本地启发式选出的最佳方向（玩家提示用） */
export function pickLocalBest(board: Board): MoveCandidate | null {
  const moves = enumerateMoves(board)
  if (moves.length === 0) return null
  return moves.reduce((best, move) => (heuristicScore(move) > heuristicScore(best) ? move : best))
}

/** 让 Jev 选择当前最佳滑动方向；任何失败都会退化为本地启发式并继续游戏 */
export async function decideMove(snapshot: Game2048Snapshot): Promise<Decision> {
  const startedAt = performance.now()
  const moves = enumerateMoves(snapshot.board)
  if (moves.length === 0) throw new Error('棋盘已没有任何方向可以移动')

  const criteria: Record<string, string> = {}
  for (const move of moves) criteria[move.id] = move.description

  const questions: Record<string, JevQuestion> = {
    direction: {
      type: 'choice',
      instructions: {
        question:
          'Which direction should the tiles slide now? Weigh immediate merge score, empty space after the random spawn, row/column monotonicity, keeping the largest tile in a corner, and how many directions stay playable.',
        state_hint:
          'The board and run context are described in `board`; each option is one legal slide with its Monte-Carlo expected outcome.',
      },
      criteria,
    },
  }

  try {
    const response = await askJev(buildState(snapshot), questions)
    const answer = response.answers.direction as ChoiceAnswer | undefined
    if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') {
      throw new Error('Jev 未返回 Choice 答案')
    }

    const probabilities = answer.probabilities ?? {}
    const chosen =
      moves.find((move) => move.id === answer.choice) ??
      moves.find(
        (move) =>
          probabilities[move.id] === Math.max(...moves.map((item) => probabilities[item.id] ?? 0)),
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
    if (error instanceof JevAuthError) throw error
    const message = error instanceof Error ? error.message : '未知错误'
    return fallbackDecision(moves, message, startedAt)
  }
}