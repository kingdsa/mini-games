export const COLS = 10
export const ROWS = 20

export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z'

export const PIECE_TYPES: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z']

export interface PieceSkin {
  /** 主体渐变起始色（高光） */
  light: string
  /** 主体渐变结束色（暗部） */
  dark: string
  /** 发光线 / 边框色 */
  glow: string
}

export const PIECE_SKINS: Record<PieceType, PieceSkin> = {
  I: { light: '#7df9ff', dark: '#0891b2', glow: '#22d3ee' },
  J: { light: '#8ab6ff', dark: '#1d4ed8', glow: '#3b82f6' },
  L: { light: '#ffc078', dark: '#d97706', glow: '#fb923c' },
  O: { light: '#ffe680', dark: '#d1a300', glow: '#facc15' },
  S: { light: '#96f5b4', dark: '#15803d', glow: '#22c55e' },
  T: { light: '#d3acff', dark: '#7e22ce', glow: '#a855f7' },
  Z: { light: '#ff9db4', dark: '#be123c', glow: '#f43f5e' },
}

/** 每个方块的形状矩阵（旋转以矩阵顺时针旋转实现） */
export const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
}

/** 生成时的水平偏移（让方块尽量居中出生） */
export const SPAWN_X: Record<PieceType, number> = {
  I: 3,
  J: 3,
  L: 3,
  O: 4,
  S: 3,
  T: 3,
  Z: 3,
}

/** SRS 旋转踢墙表，坐标系为 y 向下为正（已从标准 y-up 表翻转） */
type KickTable = Record<string, Array<[number, number]>>

export const KICKS_JLSTZ: KickTable = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
}

export const KICKS_I: KickTable = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
}

/** 每级下落间隔（毫秒） */
export function gravityForLevel(level: number): number {
  const table = [1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7]
  return table[Math.min(level - 1, table.length - 1)] ?? 7
}

export const LINE_SCORES = [0, 100, 300, 500, 800]
export const LOCK_DELAY = 500
export const MAX_LOCK_RESETS = 15
export const CLEAR_ANIMATION_MS = 340
export const ENTRY_DELAY_MS = 110