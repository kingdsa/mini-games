/**
 * 轻量音效引擎：全部使用 WebAudio 实时合成，无需任何音频素材文件。
 * 支持多音层叠加、ADSR 包络与噪声。默认静音，用户可自行开启。
 */

type Wave = OscillatorType

interface ToneSpec {
  freq: number
  to?: number
  dur?: number
  type?: Wave
  gain?: number
  delay?: number
}

const STORAGE_KEY = 'mini-games:sfx'

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private _enabled = false

  constructor() {
    try {
      this._enabled = localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      this._enabled = false
    }
  }

  get enabled(): boolean {
    return this._enabled
  }

  setEnabled(value: boolean): void {
    this._enabled = value
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (value) void this.resume()
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled)
    return this._enabled
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null

    if (!this.ctx) {
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.24
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  async resume(): Promise<void> {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') await ctx.resume()
  }

  private tone(spec: ToneSpec): void {
    if (!this._enabled) return
    const ctx = this.ensure()
    if (!ctx || !this.master) return

    const { freq, to, dur = 0.16, type = 'triangle', gain = 0.5, delay = 0 } = spec
    const t0 = ctx.currentTime + delay

    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(24, to), t0 + dur)

    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    osc.connect(env)
    env.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.03)
  }

  private noise(dur = 0.18, gain = 0.32, freq = 1400, delay = 0): void {
    if (!this._enabled) return
    const ctx = this.ensure()
    if (!ctx || !this.master) return

    const frames = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = 0.9

    const env = ctx.createGain()
    env.gain.value = gain

    src.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    src.start(ctx.currentTime + delay)
  }

  /* ------------------------------ 音效库 ------------------------------ */

  move(): void {
    this.tone({ freq: 420, to: 300, dur: 0.06, type: 'square', gain: 0.16 })
  }

  rotate(): void {
    this.tone({ freq: 560, to: 760, dur: 0.08, type: 'triangle', gain: 0.2 })
  }

  drop(): void {
    this.tone({ freq: 320, to: 120, dur: 0.12, type: 'sawtooth', gain: 0.22 })
    this.noise(0.1, 0.14, 700)
  }

  lock(): void {
    this.tone({ freq: 220, to: 160, dur: 0.09, type: 'square', gain: 0.14 })
  }

  hold(): void {
    this.tone({ freq: 680, to: 980, dur: 0.09, type: 'sine', gain: 0.2 })
  }

  clear(lines: number): void {
    const base = [0, 523.25, 659.25, 783.99, 1046.5][Math.min(lines, 4)]
    for (let i = 0; i < Math.min(lines, 4); i++) {
      this.tone({ freq: base * (1 + i * 0.12), dur: 0.22, type: 'triangle', gain: 0.3, delay: i * 0.055 })
    }
    this.noise(0.24, 0.2, 2100)
  }

  gameOver(): void {
    const notes = [523.25, 440, 349.23, 261.63]
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.34, type: 'triangle', gain: 0.3, delay: i * 0.14 }))
  }

  swap(): void {
    this.tone({ freq: 520, to: 700, dur: 0.07, type: 'sine', gain: 0.22 })
  }

  invalid(): void {
    this.tone({ freq: 200, to: 150, dur: 0.14, type: 'square', gain: 0.18 })
  }

  match(combo: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]
    const note = scale[Math.min(combo, scale.length - 1)]
    this.tone({ freq: note, dur: 0.2, type: 'triangle', gain: 0.34 })
    this.tone({ freq: note * 2, dur: 0.14, type: 'sine', gain: 0.14, delay: 0.02 })
  }

  win(): void {
    ;[523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.28, delay: i * 0.1 }),
    )
  }
}

export const sfx = new SoundEngine()

let unlocked = false

/** 首次交互时解锁 WebAudio（浏览器自动播放策略） */
export function installAudioUnlock(): void {
  if (unlocked || typeof window === 'undefined') return
  unlocked = true
  const unlock = () => {
    void sfx.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}