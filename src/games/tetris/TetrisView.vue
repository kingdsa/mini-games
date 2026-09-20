<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTetris } from './useTetris'
import PiecePreview from './PiecePreview.vue'
import StatTile from '@/components/StatTile.vue'
import { useScoreStore } from '@/stores/scores'
import { sfx } from '@/utils/sfx'

const store = useScoreStore()
const { canvas, state, restart, togglePause, move, rotate, softDrop, hardDrop, hold } =
  useTetris({
    onGameOver: (score, lines) => {
      store.submit('tetris', score, { lines })
      isNewRecord.value = score > 0 && score >= best.value
    },
  })

const best = computed(() => store.best('tetris'))
const isNewRecord = ref(false)
const soundOn = ref(sfx.enabled)

watch(soundOn, (v) => sfx.setEnabled(v))

onMounted(() => {
  isNewRecord.value = false
})

const overlay = computed(() => {
  if (state.phase === 'ready') {
    return { title: '准备好了吗？', desc: '消除每一行，别让方块堆到顶', cta: '开始游戏', action: restart }
  }
  if (state.phase === 'paused') {
    return { title: '已暂停', desc: '按 P 或点击继续', cta: '继续游戏', action: togglePause }
  }
  if (state.phase === 'over') {
    return {
      title: isNewRecord.value ? '🎉 新纪录！' : '游戏结束',
      desc: `本局 ${state.score.toLocaleString('zh-CN')} 分 · 消除 ${state.lines} 行`,
      cta: '再来一局',
      action: restart,
    }
  }
  return null
})

const grade = computed(() => {
  const s = state.score
  if (s >= 60000) return 'S+'
  if (s >= 40000) return 'S'
  if (s >= 25000) return 'A'
  if (s >= 12000) return 'B'
  if (s >= 5000) return 'C'
  return '—'
})

const banners = computed(() =>
  state.combo > 1 ? `COMBO ×${state.combo}` : state.clearingRows.length > 1 ? `+${state.clearingRows.length} 行` : '',
)

function repeat(fn: () => void) {
  let timer: number | undefined
  let interval: number | undefined
  const clear = () => {
    window.clearTimeout(timer)
    window.clearInterval(interval)
  }
  const down = (e: PointerEvent) => {
    e.preventDefault()
    fn()
    timer = window.setTimeout(() => {
      interval = window.setInterval(fn, 55)
    }, 220)
  }
  const up = () => clear()
  return { onPointerdown: down, onPointerup: up, onPointerleave: up, onPointercancel: up }
}

const leftRepeat = repeat(() => move(-1))
const rightRepeat = repeat(() => move(1))
const downRepeat = repeat(() => softDrop())
</script>

<template>
  <div class="page tetris">
    <div class="container">
      <header class="game-head">
        <div>
          <span class="tag tag-cyan">🧱 经典</span>
          <h1 class="game-head__title">俄罗斯方块</h1>
          <p class="game-head__sub">
            标准 SRS 旋转 + 7-bag 随机器 · 支持 Hold 暂存、幽灵落点与连击加成
          </p>
        </div>
        <div class="game-head__actions">
          <button class="btn btn-ghost btn-icon" :title="soundOn ? '关闭音效' : '开启音效'" @click="soundOn = !soundOn">
            {{ soundOn ? '🔊' : '🔇' }}
          </button>
          <button class="btn btn-ghost" @click="togglePause" :disabled="state.phase === 'ready' || state.phase === 'over'">
            {{ state.phase === 'paused' ? '继续' : '暂停' }}
          </button>
          <button class="btn btn-primary" @click="restart">重新开始</button>
        </div>
      </header>

      <div class="layout">
        <!-- 左栏 -->
        <aside class="col col--left">
          <section class="panel glass">
            <h2 class="panel__title">暂存 <kbd>C</kbd></h2>
            <div class="preview-box" :class="{ 'is-locked': !state.canHold }">
              <PiecePreview :type="state.hold" :cell="18" />
              <span v-if="!state.hold" class="preview-box__empty">空</span>
            </div>
          </section>

          <section class="panel glass panel--stats">
            <StatTile label="分数" :value="state.score.toLocaleString('zh-CN')" accent="#22d3ee" highlight />
            <StatTile label="最高分" :value="best.toLocaleString('zh-CN')" accent="#7c5cff" :hint="`评级 ${grade}`" />
            <StatTile label="等级" :value="state.level" accent="#fbbf24" />
            <StatTile label="消除行" :value="state.lines" accent="#34d399" />
          </section>
        </aside>

        <!-- 棋盘 -->
        <div class="board-wrap">
          <div class="board glass" :class="{ 'is-danger': state.grid.slice(0, 4).some((r) => r.some(Boolean)) }">
            <canvas ref="canvas" class="board__canvas"></canvas>

            <Transition name="overlay">
              <div v-if="overlay" class="overlay">
                <div class="overlay__card">
                  <h2 class="overlay__title">{{ overlay.title }}</h2>
                  <p class="overlay__desc">{{ overlay.desc }}</p>
                  <button class="btn btn-primary overlay__btn" @click="overlay.action()">
                    {{ overlay.cta }}
                  </button>
                  <p class="overlay__hint">键盘：← → 移动 · ↑ 旋转 · 空格 硬降</p>
                </div>
              </div>
            </Transition>

            <Transition name="banner">
              <div v-if="banners && state.phase === 'playing'" class="banner">{{ banners }}</div>
            </Transition>
          </div>

          <!-- 触屏控制 -->
          <div class="touch">
            <button class="touch__btn" v-bind="leftRepeat" aria-label="左移">◀</button>
            <button class="touch__btn" v-bind="downRepeat" aria-label="软降">▼</button>
            <button class="touch__btn" v-bind="rightRepeat" aria-label="右移">▶</button>
            <button class="touch__btn" @click="rotate(-1)" aria-label="逆时针旋转">↺</button>
            <button class="touch__btn" @click="rotate(1)" aria-label="顺时针旋转">↻</button>
            <button class="touch__btn touch__btn--accent" @click="hardDrop" aria-label="硬降">⤓</button>
            <button class="touch__btn touch__btn--ghost" @click="hold" aria-label="暂存">H</button>
          </div>
        </div>

        <!-- 右栏 -->
        <aside class="col col--right">
          <section class="panel glass">
            <h2 class="panel__title">下一个</h2>
            <div class="next-list">
              <div v-for="(type, i) in state.queue" :key="`${type}-${i}`" class="preview-box" :class="{ 'is-main': i === 0 }">
                <PiecePreview :type="type" :cell="i === 0 ? 18 : 14" />
              </div>
            </div>
          </section>

          <section class="panel glass panel--help">
            <h2 class="panel__title">操作说明</h2>
            <ul class="keys">
              <li><kbd>←</kbd><kbd>→</kbd><span>左右移动</span></li>
              <li><kbd>↓</kbd><span>软降 (+1)</span></li>
              <li><kbd>空格</kbd><span>硬降 (+2/格)</span></li>
              <li><kbd>↑</kbd><kbd>X</kbd><span>顺时针旋转</span></li>
              <li><kbd>Z</kbd><span>逆时针旋转</span></li>
              <li><kbd>C</kbd><kbd>Shift</kbd><span>暂存方块</span></li>
              <li><kbd>P</kbd><span>暂停 / 继续</span></li>
              <li><kbd>Enter</kbd><span>重新开始</span></li>
            </ul>
          </section>

          <section class="panel glass panel--score">
            <h2 class="panel__title">计分规则</h2>
            <ul class="rules">
              <li><span>1 行</span><b>100 × 等级</b></li>
              <li><span>2 行</span><b>300 × 等级</b></li>
              <li><span>3 行</span><b>500 × 等级</b></li>
              <li><span>4 行</span><b>800 × 等级</b></li>
              <li><span>连击</span><b>+50 × 连击 × 等级</b></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tetris {
  padding-top: 28px;
}

.game-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.game-head__title {
  margin-top: 10px;
  font-size: clamp(26px, 4vw, 36px);
}

.game-head__sub {
  margin-top: 6px;
  color: var(--text-2);
  font-size: 13.5px;
}

.game-head__actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.layout {
  display: grid;
  grid-template-columns: minmax(160px, 200px) minmax(0, 1fr) minmax(170px, 220px);
  gap: 20px;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  padding: 16px;
}

.panel__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 12px;
}

.panel--stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.panel--stats .panel__title {
  grid-column: 1 / -1;
}

.board-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.board {
  position: relative;
  height: min(74vh, 660px);
  aspect-ratio: 1 / 2;
  max-width: 100%;
  padding: 8px;
  border-radius: var(--radius-lg);
  background: linear-gradient(160deg, rgba(124, 92, 255, 0.22), rgba(34, 211, 238, 0.1));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.9), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: box-shadow 0.4s var(--ease-out);
}

.board.is-danger {
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.5), 0 30px 70px -30px rgba(248, 113, 113, 0.6),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.board__canvas {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 18px;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: radial-gradient(80% 60% at 50% 40%, rgba(10, 14, 30, 0.72), rgba(6, 9, 20, 0.92));
  backdrop-filter: blur(7px);
}

.overlay__card {
  text-align: center;
}

.overlay__title {
  font-size: 24px;
}

.overlay__desc {
  margin-top: 8px;
  font-size: 13.5px;
  color: var(--text-2);
}

.overlay__btn {
  margin-top: 20px;
  padding: 12px 30px;
  font-size: 15px;
}

.overlay__hint {
  margin-top: 16px;
  font-size: 11.5px;
  color: var(--text-3);
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.28s var(--ease-out);
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.banner {
  position: absolute;
  top: 16%;
  left: 50%;
  transform: translateX(-50%);
  padding: 7px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #04121c;
  background: linear-gradient(100deg, #7df9ff, #ffe680);
  box-shadow: 0 10px 30px -10px rgba(34, 211, 238, 0.9);
  pointer-events: none;
  white-space: nowrap;
}

.banner-enter-active {
  transition: opacity 0.2s, transform 0.3s var(--ease-bounce);
}
.banner-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.banner-enter-from {
  opacity: 0;
  transform: translateX(-50%) scale(0.7);
}
.banner-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-14px) scale(0.9);
}

.preview-box {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 78px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid var(--border);
  transition: opacity 0.3s, border-color 0.3s;
}

.preview-box.is-main {
  min-height: 68px;
  border-color: rgba(34, 211, 238, 0.45);
  box-shadow: inset 0 0 24px -12px rgba(34, 211, 238, 0.9);
}

.preview-box.is-locked {
  opacity: 0.4;
}

.preview-box__empty {
  position: absolute;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-3);
}

.next-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.next-list .preview-box:not(.is-main) {
  min-height: 54px;
  padding: 6px;
}

.keys,
.rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12.5px;
}

.keys li {
  display: flex;
  align-items: center;
  gap: 5px;
}

.keys li span {
  margin-left: auto;
  color: var(--text-3);
  font-size: 12px;
}

.rules li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rules li span {
  color: var(--text-3);
}

.rules li b {
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 2px 6px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--border-strong);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}

.touch {
  display: none;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
  max-width: 420px;
}

.touch__btn {
  padding: 14px 0;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 700;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-strong);
  color: var(--text-1);
  user-select: none;
  touch-action: none;
  transition: transform 0.12s, background 0.2s;
}

.touch__btn:active {
  transform: scale(0.94);
  background: rgba(255, 255, 255, 0.2);
}

.touch__btn--accent {
  background: linear-gradient(140deg, rgba(34, 211, 238, 0.4), rgba(124, 92, 255, 0.4));
  border-color: rgba(34, 211, 238, 0.5);
}

.touch__btn--ghost {
  color: var(--text-2);
}

@media (max-width: 1080px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) minmax(150px, 190px);
  }
  .col--left {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .col--left .panel {
    flex: 1;
    min-width: 180px;
  }
  .panel--stats {
    grid-template-columns: repeat(4, 1fr);
  }
  .panel--stats .panel__title {
    grid-column: 1 / -1;
  }
  .col--right {
    grid-column: 2;
    grid-row: 1;
  }
  .board-wrap {
    grid-column: 1;
    grid-row: 1;
  }
  .touch {
    display: grid;
  }
}

@media (max-width: 720px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .col--right,
  .board-wrap {
    grid-column: 1;
  }
  .board-wrap {
    grid-row: 1;
  }
  .col--right {
    grid-row: 2;
  }
  .col--right {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .col--right .panel {
    flex: 1 1 200px;
  }
  .next-list {
    flex-direction: row;
  }
  .next-list .preview-box {
    flex: 1;
    min-height: 58px;
  }
  .panel--stats {
    grid-template-columns: 1fr 1fr;
  }
  .game-head__actions .btn-icon {
    display: none;
  }
  .panel--help,
  .overlay__hint {
    display: none;
  }
}
</style>