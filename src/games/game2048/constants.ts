export const SIZE = 4

/** 达成该数值即胜利（仍可继续挑战更大数字） */
export const WIN_VALUE = 2048

/** 方块滑动动画时长 */
export const SLIDE_MS = 130
/** 合并弹跳动画时长 */
export const POP_MS = 150
/** 新方块入场动画时长 */
export const SPAWN_MS = 140

/** 每次移动后生成 4 的概率，其余生成 2 */
export const SPAWN_FOUR_CHANCE = 0.1

export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

export interface DirectionMeta {
  label: string
  short: string
  arrow: string
}

export const DIRECTION_META: Record<Direction, DirectionMeta> = {
  up: { label: '向上滑动', short: '↑ 向上', arrow: '↑' },
  down: { label: '向下滑动', short: '↓ 向下', arrow: '↓' },
  left: { label: '向左滑动', short: '← 向左', arrow: '←' },
  right: { label: '向右滑动', short: '→ 向右', arrow: '→' },
}

export interface TileSkin {
  bg: string
  color: string
  glow: string
  border: string
}

const SKINS: Record<number, TileSkin> = {
  2: {
    bg: 'linear-gradient(150deg, #f6efe4, #e6d9c8)',
    color: '#6d5b4b',
    glow: 'rgba(238, 228, 218, 0.35)',
    border: 'rgba(255, 255, 255, 0.45)',
  },
  4: {
    bg: 'linear-gradient(150deg, #f5e9cd, #e2d0ae)',
    color: '#6d5b4b',
    glow: 'rgba(237, 224, 200, 0.35)',
    border: 'rgba(255, 255, 255, 0.45)',
  },
  8: {
    bg: 'linear-gradient(150deg, #f9c08c, #ef9a5c)',
    color: '#fff8f0',
    glow: 'rgba(242, 177, 121, 0.55)',
    border: 'rgba(255, 224, 190, 0.55)',
  },
  16: {
    bg: 'linear-gradient(150deg, #fba06d, #ef7a45)',
    color: '#fff8f0',
    glow: 'rgba(245, 149, 99, 0.6)',
    border: 'rgba(255, 214, 180, 0.55)',
  },
  32: {
    bg: 'linear-gradient(150deg, #fa8768, #ec6242)',
    color: '#fff8f0',
    glow: 'rgba(246, 124, 95, 0.65)',
    border: 'rgba(255, 200, 175, 0.55)',
  },
  64: {
    bg: 'linear-gradient(150deg, #f96b45, #e5452a)',
    color: '#fff8f0',
    glow: 'rgba(246, 94, 59, 0.7)',
    border: 'rgba(255, 186, 160, 0.55)',
  },
  128: {
    bg: 'linear-gradient(150deg, #f3dc8b, #e8c657)',
    color: '#5c4716',
    glow: 'rgba(237, 207, 114, 0.75)',
    border: 'rgba(255, 246, 200, 0.6)',
  },
  256: {
    bg: 'linear-gradient(150deg, #f2d778, #e8c34a)',
    color: '#5c4716',
    glow: 'rgba(237, 204, 97, 0.8)',
    border: 'rgba(255, 246, 190, 0.65)',
  },
  512: {
    bg: 'linear-gradient(150deg, #f1d264, #e7bd35)',
    color: '#5c4716',
    glow: 'rgba(237, 200, 80, 0.85)',
    border: 'rgba(255, 244, 180, 0.7)',
  },
  1024: {
    bg: 'linear-gradient(150deg, #f0cd51, #e7b724)',
    color: '#54400f',
    glow: 'rgba(237, 197, 63, 0.9)',
    border: 'rgba(255, 240, 165, 0.75)',
  },
  2048: {
    bg: 'linear-gradient(150deg, #ffd94a, #f0a90f)',
    color: '#4a3300',
    glow: 'rgba(255, 199, 40, 1)',
    border: 'rgba(255, 245, 200, 0.85)',
  },
  4096: {
    bg: 'linear-gradient(150deg, #b78cff, #8b5cf6)',
    color: '#fff6ff',
    glow: 'rgba(168, 85, 247, 0.95)',
    border: 'rgba(230, 200, 255, 0.7)',
  },
  8192: {
    bg: 'linear-gradient(150deg, #67e8f9, #22d3ee)',
    color: '#083344',
    glow: 'rgba(34, 211, 238, 0.95)',
    border: 'rgba(200, 250, 255, 0.75)',
  },
}

const SUPER_SKIN: TileSkin = {
  bg: 'linear-gradient(150deg, #2a2140, #17122b)',
  color: '#f2d9ff',
  glow: 'rgba(255, 77, 141, 0.95)',
  border: 'rgba(255, 77, 141, 0.65)',
}

export function tileSkin(value: number): TileSkin {
  return SKINS[value] ?? SUPER_SKIN
}

/** 里程碑进度表 */
export const MILESTONES = [128, 256, 512, 1024, 2048]

/** 方块图鉴展示用数值 */
export const SHOWCASE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]