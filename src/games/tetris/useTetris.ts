import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { TetrisEngine, type GameEvent, type Snapshot } from './engine'
import { TetrisRenderer } from './renderer'
import { sfx } from '@/utils/sfx'

function emptySnapshot(): Snapshot {
  return {
    grid: [],
    active: null,
    ghostY: 0,
    queue: [],
    hold: null,
    score: 0,
    lines: 0,
    level: 1,
    combo: 0,
    phase: 'ready',
    clearingRows: [],
    clearProgress: 0,
    canHold: true,
  }
}

export function useTetris(options: { onGameOver?: (score: number, lines: number) => void } = {}) {
  const canvas = ref<HTMLCanvasElement | null>(null)
  const state = reactive<Snapshot>(emptySnapshot())
  const engine = shallowRef<TetrisEngine | null>(null)

  let renderer: TetrisRenderer | null = null
  let raf = 0
  let last = 0

  function sync(): void {
    const e = engine.value
    if (!e) return
    const snap = e.serialize()
    state.grid = snap.grid
    state.active = snap.active
    state.ghostY = snap.ghostY
    state.queue = snap.queue
    state.hold = snap.hold
    state.score = snap.score
    state.lines = snap.lines
    state.level = snap.level
    state.combo = snap.combo
    state.phase = snap.phase
    state.clearingRows = snap.clearingRows
    state.clearProgress = snap.clearProgress
    state.canHold = snap.canHold
  }

  function handleEvent(event: GameEvent): void {
    switch (event.type) {
      case 'move':
        sfx.move()
        break
      case 'rotate':
        sfx.rotate()
        break
      case 'drop':
        sfx.drop()
        break
      case 'lock':
        sfx.lock()
        break
      case 'hold':
        sfx.hold()
        break
      case 'clear':
        sfx.clear(event.lines)
        break
      case 'gameover':
        sfx.gameOver()
        options.onGameOver?.(event.score, engine.value?.lines ?? 0)
        break
      default:
        break
    }
  }

  function loop(now: number): void {
    raf = requestAnimationFrame(loop)
    const dt = last === 0 ? 16 : Math.min(now - last, 120)
    last = now

    const e = engine.value
    if (!e) return

    e.update(dt)
    renderer?.draw(e.serialize(), dt)
    sync()
  }

  function resize(): void {
    renderer?.resize()
  }

  function start(): void {
    engine.value?.start()
    sync()
  }

  function restart(): void {
    const e = engine.value
    if (!e) return
    e.reset()
    e.start()
    sync()
  }

  function togglePause(): void {
    engine.value?.togglePause()
    sync()
  }

  function move(dx: number): void {
    engine.value?.move(dx)
  }

  function rotate(dir: 1 | -1): void {
    engine.value?.rotate(dir)
  }

  function softDrop(): void {
    engine.value?.softDrop()
  }

  function hardDrop(): void {
    engine.value?.hardDrop()
    sync()
  }

  function hold(): void {
    engine.value?.holdPiece()
    sync()
  }

  function onKeyDown(event: KeyboardEvent): void {
    const e = engine.value
    if (!e) return

    const key = event.key
    const code = event.code

    if (key === 'Enter' && (e.phase === 'ready' || e.phase === 'over')) {
      event.preventDefault()
      restart()
      return
    }

    if (code === 'Space' || key === 'p' || key === 'P' || key === 'Escape') event.preventDefault()

    if (e.phase !== 'playing') {
      if (key === 'p' || key === 'P') togglePause()
      return
    }

    switch (true) {
      case key === 'ArrowLeft' || key === 'a' || key === 'A':
        move(-1)
        break
      case key === 'ArrowRight' || key === 'd' || key === 'D':
        move(1)
        break
      case key === 'ArrowDown' || key === 's' || key === 'S':
        softDrop()
        break
      case key === 'ArrowUp' || key === 'x' || key === 'X' || key === 'w' || key === 'W':
        rotate(1)
        break
      case key === 'z' || key === 'Z':
        rotate(-1)
        break
      case code === 'Space':
        hardDrop()
        break
      case key === 'c' || key === 'C' || key === 'Shift':
        hold()
        break
      case key === 'p' || key === 'P':
        togglePause()
        break
      default:
        return
    }

    event.preventDefault()
  }

  onMounted(() => {
    if (canvas.value) {
      renderer = new TetrisRenderer(canvas.value)
      renderer.resize()
    }
    engine.value = new TetrisEngine(handleEvent)
    sync()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(loop)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', resize)
    renderer = null
    engine.value = null
  })

  return {
    canvas,
    state,
    start,
    restart,
    togglePause,
    move,
    rotate,
    softDrop,
    hardDrop,
    hold,
    resize,
  }
}