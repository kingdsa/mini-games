import candyBlue from '@/assets/candies/candy-blue.svg'
import candyGreen from '@/assets/candies/candy-green.svg'
import candyOrange from '@/assets/candies/candy-orange.svg'
import candyPurple from '@/assets/candies/candy-purple.svg'
import candyRed from '@/assets/candies/candy-red.svg'
import candyYellow from '@/assets/candies/candy-yellow.svg'

export const COLS = 8
export const ROWS = 8

export interface CandySkin {
  key: string
  name: string
  src: string
  color: string
  glow: string
}

/** 六种糖果（原创 SVG 素材） */
export const CANDIES: CandySkin[] = [
  { key: 'red', name: '红宝石', src: candyRed, color: '#f01e46', glow: '#ff6b81' },
  { key: 'orange', name: '星星糖', src: candyOrange, color: '#fb7d0a', glow: '#ffb545' },
  { key: 'yellow', name: '柠檬方', src: candyYellow, color: '#f7bf0a', glow: '#ffe259' },
  { key: 'green', name: '青苹果', src: candyGreen, color: '#16a34a', glow: '#69e07a' },
  { key: 'blue', name: '蓝钻石', src: candyBlue, color: '#1d8ff0', glow: '#63d5ff' },
  { key: 'purple', name: '紫罗兰', src: candyPurple, color: '#8b31e6', glow: '#c084fc' },
]

/** 消除动画时长 */
export const CLEAR_MS = 260
/** 交换位移动画时长 */
export const SWAP_MS = 190
/** 下落动画时长 */
export const FALL_MS = 240
/** 连锁之间的停顿 */
export const COMBO_PAUSE_MS = 90

export const BASE_POINTS = 60

export interface LevelConfig {
  id: number
  name: string
  moves: number
  target: number
  types: number
  desc: string
}

export const LEVELS: LevelConfig[] = [
  { id: 1, name: '第 1 关 · 糖果初遇', moves: 20, target: 1500, types: 5, desc: '熟悉一下三消的感觉' },
  { id: 2, name: '第 2 关 · 甜蜜连锁', moves: 22, target: 2800, types: 6, desc: '解锁全部 6 种糖果' },
  { id: 3, name: '第 3 关 · 缤纷挑战', moves: 20, target: 4000, types: 6, desc: '步数变少了，注意连锁' },
  { id: 4, name: '第 4 关 · 极限糖分', moves: 18, target: 5200, types: 6, desc: '需要一次漂亮的连锁' },
  { id: 5, name: '第 5 关 · 甜蜜大师', moves: 16, target: 6400, types: 6, desc: '只有大师才能通过' },
]

export const STAR_MULTIPLIERS = [1, 1.45, 1.95]

export function comboMultiplier(combo: number): number {
  return 1 + Math.max(0, combo - 1) * 0.5
}

export function starsFor(score: number, target: number): number {
  if (score >= target * STAR_MULTIPLIERS[2]) return 3
  if (score >= target * STAR_MULTIPLIERS[1]) return 2
  if (score >= target) return 1
  return 0
}