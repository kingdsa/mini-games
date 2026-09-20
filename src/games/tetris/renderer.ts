import { COLS, PIECE_SKINS, ROWS, type PieceType } from './constants'
import type { Snapshot } from './engine'

interface DrawOptions {
  ghost?: boolean
  alpha?: number
  scale?: number
  glow?: number
}

export interface TargetOverlay {
  matrix: number[][]
  x: number
  y: number
  type: PieceType
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function shade(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (num & 255) + amount))
  return `rgb(${r}, ${g}, ${b})`
}

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  type: PieceType,
  options: DrawOptions,
): void {
  const skin = PIECE_SKINS[type]
  const { ghost = false, alpha = 1, scale = 1, glow = 0 } = options

  const inset = size * 0.055
  const w = (size - inset * 2) * scale
  const h = (size - inset * 2) * scale
  const x = px + (size - w) / 2
  const y = py + (size - h) / 2
  const radius = size * 0.22 * scale

  ctx.save()
  ctx.globalAlpha = alpha

  if (ghost) {
    ctx.globalAlpha = alpha * 0.34
    roundRect(ctx, x, y, w, h, radius)
    ctx.strokeStyle = skin.glow
    ctx.lineWidth = Math.max(1.4, size * 0.075)
    ctx.setLineDash([size * 0.22, size * 0.16])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = skin.glow
    ctx.globalAlpha = alpha * 0.09
    ctx.fill()
    ctx.restore()
    return
  }

  if (glow > 0) {
    ctx.shadowColor = skin.glow
    ctx.shadowBlur = size * glow
  }

  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, skin.light)
  grad.addColorStop(0.45, shade(skin.glow, 10))
  grad.addColorStop(1, skin.dark)

  roundRect(ctx, x, y, w, h, radius)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.shadowBlur = 0

  // 顶部玻璃高光
  const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.55)
  gloss.addColorStop(0, 'rgba(255,255,255,0.72)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  roundRect(ctx, x + w * 0.1, y + h * 0.08, w * 0.8, h * 0.42, radius * 0.62)
  ctx.fillStyle = gloss
  ctx.fill()

  // 底部阴影
  const foot = ctx.createLinearGradient(x, y + h * 0.6, x, y + h)
  foot.addColorStop(0, 'rgba(0,0,0,0)')
  foot.addColorStop(1, 'rgba(0,0,0,0.34)')
  roundRect(ctx, x, y + h * 0.55, w, h * 0.45, radius * 0.7)
  ctx.fillStyle = foot
  ctx.fill()

  // 描边
  roundRect(ctx, x, y, w, h, radius)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = Math.max(1, size * 0.045)
  ctx.stroke()

  ctx.restore()
}

export class TetrisRenderer {
  private ctx: CanvasRenderingContext2D
  private cell = 30
  private cssWidth = 0
  private cssHeight = 0
  private offsetX = 0
  private offsetY = 0
  private time = 0

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context 不可用')
    this.ctx = ctx
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))

    this.cssWidth = width
    this.cssHeight = height
    this.cell = Math.min(width / COLS, height / ROWS)
    this.offsetX = (width - this.cell * COLS) / 2
    this.offsetY = (height - this.cell * ROWS) / 2

    this.canvas.width = Math.floor(width * dpr)
    this.canvas.height = Math.floor(height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  get cellSize(): number {
    return this.cell
  }

  private drawBackground(): void {
    const { ctx, cssWidth: w, cssHeight: h, cell, offsetX, offsetY } = this

    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, 'rgba(12, 18, 38, 0.96)')
    bg.addColorStop(0.5, 'rgba(8, 12, 26, 0.98)')
    bg.addColorStop(1, 'rgba(14, 12, 32, 0.96)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    const fieldW = cell * COLS
    const fieldH = cell * ROWS

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.beginPath()
    ctx.rect(0, 0, fieldW, fieldH)
    ctx.clip()

    // 棋盘格
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.022)'
          ctx.fillRect(x * cell, y * cell, cell, cell)
        }
      }
    }

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(Math.round(x * cell) + 0.5, 0)
      ctx.lineTo(Math.round(x * cell) + 0.5, fieldH)
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, Math.round(y * cell) + 0.5)
      ctx.lineTo(fieldW, Math.round(y * cell) + 0.5)
    }
    ctx.stroke()

    // 危险区提示
    const dangerY = 4 * cell
    const danger = ctx.createLinearGradient(0, 0, 0, dangerY)
    danger.addColorStop(0, 'rgba(248, 113, 113, 0.09)')
    danger.addColorStop(1, 'rgba(248, 113, 113, 0)')
    ctx.fillStyle = danger
    ctx.fillRect(0, 0, fieldW, dangerY)
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.22)'
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(0, dangerY + 0.5)
    ctx.lineTo(fieldW, dangerY + 0.5)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.restore()
  }

  /** 高亮 Jev 选择的落点 */
  private drawTarget(target: TargetOverlay): void {
    const { ctx, cell } = this

    let minC = target.matrix.length
    let maxC = -1
    for (const row of target.matrix) {
      for (let c = 0; c < row.length; c++) {
        if (!row[c]) continue
        minC = Math.min(minC, c)
        maxC = Math.max(maxC, c)
      }
    }

    const pulse = 0.5 + Math.sin(this.time / 170) * 0.2
    const fieldH = cell * ROWS
    const centerX = (target.x + (minC + maxC + 1) / 2) * cell
    const topY = Math.max(0, target.y * cell)

    ctx.save()
    ctx.setLineDash([cell * 0.3, cell * 0.34])
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.16 + pulse * 0.14})`
    ctx.lineWidth = Math.max(1, cell * 0.05)
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, topY)
    ctx.stroke()
    ctx.setLineDash([])

    for (let r = 0; r < target.matrix.length; r++) {
      for (let c = 0; c < target.matrix[r].length; c++) {
        if (!target.matrix[r][c]) continue
        const py = target.y + r
        if (py < 0 || py >= ROWS) continue
        const px = target.x + c
        const inset = cell * 0.08
        const x = px * cell + inset
        const y = py * cell + inset
        const size = cell - inset * 2

        ctx.globalAlpha = 0.12 + pulse * 0.12
        ctx.fillStyle = '#fbbf24'
        roundRect(ctx, x, y, size, size, cell * 0.22)
        ctx.fill()

        ctx.globalAlpha = 0.7 + pulse * 0.3
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = Math.max(1.5, cell * 0.065)
        ctx.shadowColor = '#fbbf24'
        ctx.shadowBlur = cell * (0.45 + pulse * 0.35)
        roundRect(ctx, x, y, size, size, cell * 0.22)
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }

    // 底部落点横线
    ctx.globalAlpha = 0.35 + pulse * 0.25
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = Math.max(1, cell * 0.05)
    ctx.beginPath()
    ctx.moveTo(0, Math.min(fieldH, (target.y + target.matrix.length) * cell) + 0.5)
    ctx.lineTo(cell * COLS, Math.min(fieldH, (target.y + target.matrix.length) * cell) + 0.5)
    ctx.stroke()

    ctx.restore()
  }

  draw(snapshot: Snapshot, dt: number, target: TargetOverlay | null = null): void {
    const { ctx, cell, offsetX, offsetY } = this
    this.time += dt

    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight)
    this.drawBackground()

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.beginPath()
    ctx.rect(0, 0, cell * COLS, cell * ROWS)
    ctx.clip()

    const clearing = new Set(snapshot.clearingRows)
    const progress = snapshot.clearProgress
    const easing = 1 - (1 - progress) ** 3

    // 已固定的方块
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const type = snapshot.grid[y][x]
        if (!type) continue

        if (clearing.has(y)) {
          const alpha = 1 - easing
          drawBlock(ctx, x * cell, y * cell, cell, type, {
            alpha,
            scale: 1 - easing * 0.7,
            glow: 0.9 * (1 - easing),
          })
        } else {
          drawBlock(ctx, x * cell, y * cell, cell, type, { alpha: 1 })
        }
      }
    }

    // 消行闪光
    if (snapshot.clearingRows.length > 0) {
      for (const row of snapshot.clearingRows) {
        const alpha = (1 - easing) * 0.85
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        const shrink = easing * cell * 0.5
        const fieldW = cell * COLS
        ctx.fillRect(shrink, row * cell, fieldW - shrink * 2, cell)
        const beam = ctx.createLinearGradient(0, row * cell, fieldW, row * cell)
        beam.addColorStop(0, 'rgba(34,211,238,0)')
        beam.addColorStop(0.5, `rgba(34,211,238,${alpha})`)
        beam.addColorStop(1, 'rgba(255,77,141,0)')
        ctx.fillStyle = beam
        ctx.fillRect(0, row * cell + cell * 0.42, fieldW, cell * 0.16)
      }
    }

    if (snapshot.active) {
      const piece = snapshot.active
      const ghostY = snapshot.ghostY

      // 幽灵落点
      if (ghostY !== piece.y || snapshot.phase === 'playing') {
        for (let r = 0; r < piece.matrix.length; r++) {
          for (let c = 0; c < piece.matrix[r].length; c++) {
            if (!piece.matrix[r][c]) continue
            const gy = ghostY + r
            if (gy < 0) continue
            drawBlock(ctx, (piece.x + c) * cell, gy * cell, cell, piece.type, { ghost: true })
          }
        }
      }

      // 活动方块
      const pulse = 0.42 + Math.sin(this.time / 190) * 0.12
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (!piece.matrix[r][c]) continue
          const y = piece.y + r
          if (y < 0) continue
          drawBlock(ctx, (piece.x + c) * cell, y * cell, cell, piece.type, {
            glow: pulse,
          })
        }
      }
    }

    if (target) this.drawTarget(target)

    ctx.restore()
  }
}