<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import JevPanel from './JevPanel.vue'
import StatTile from '@/components/StatTile.vue'
import { useGame2048, type Tile2048 } from './useGame2048'
import {
  DIRECTION_META,
  MILESTONES,
  SHOWCASE_VALUES,
  SIZE,
  tileSkin,
  type Direction,
} from './constants'
import { useScoreStore } from '@/stores/scores'
import { sfx } from '@/utils/sfx'

const store = useScoreStore()
const best = computed(() => store.best('2048'))

const {
  tiles,
  phase,
  score,
  moveCount,
  won,
  popups,
  busy,
  hintDirection,
  shakeDirection,
  maxTileValue,
  ai,
  startGame,
  continueGame,
  togglePause,
  useHint,
  doMove,
  toggleAi,
  confirmAi,
  saveApiKey,
  aiOwnsBoard,
  onBoardPointerDown,
  onBoardPointerUp,
  onBoardPointerCancel,
} = useGame2048({
  onGameEnd: (finalScore, tile, targetReached) => {
    store.submit('2048', finalScore, { maxTile: tile, target: targetReached ? 1 : 0 })
  },
})

const soundOn = ref(sfx.enabled)
watch(soundOn, (v) => sfx.setEnabled(v))

const padDisabled = computed(() => busy.value || phase.value !== 'playing' || aiOwnsBoard())

const aiButtonLabel = computed(() => {
  if (!ai.enabled) return 'JEV 外挂'
  if (ai.status === 'confirm') return '等待确认'
  if (ai.status === 'gameEnd') return '外挂待命'
  return '外挂运行中'
})

interface Overlay {
  title: string
  desc: string
  primaryLabel: string
  primaryAction: () => void
  secondaryLabel?: string
  secondaryAction?: () => void
}

const overlay = computed<Overlay | null>(() => {
  if (phase.value === 'won') {
    return {
      title: '达成 2048！',
      desc:
        `当前得分 ${score.value.toLocaleString('zh-CN')} · 最大方块 ${maxTileValue.value}` +
        (ai.enabled ? ' · 继续挑战需再次确认外挂' : ''),
      primaryLabel: '继续挑战',
      primaryAction: continueGame,
      secondaryLabel: '重新开始',
      secondaryAction: startGame,
    }
  }
  if (phase.value === 'over') {
    return {
      title: '无路可走了',
      desc:
        `最终得分 ${score.value.toLocaleString('zh-CN')} · 最大方块 ${maxTileValue.value}` +
        (ai.enabled ? ' · 新对局需再次确认外挂' : ''),
      primaryLabel: '再来一局',
      primaryAction: startGame,
    }
  }
  if (phase.value === 'paused') {
    return {
      title: '已暂停',
      desc: '数字们正在原地待命',
      primaryLabel: '继续游戏',
      primaryAction: togglePause,
    }
  }
  return null
})

const milestones = computed(() =>
  MILESTONES.map((value) => ({ value, reached: maxTileValue.value >= value })),
)

const showcase = computed(() =>
  SHOWCASE_VALUES.map((value) => ({ value, skin: tileSkin(value) })),
)

function tileStyle(tile: Tile2048) {
  const skin = tileSkin(tile.value)
  return {
    '--row': tile.row,
    '--col': tile.col,
    '--tile-bg': skin.bg,
    '--tile-color': skin.color,
    '--tile-glow': skin.glow,
    '--tile-border': skin.border,
  }
}

function tileClass(tile: Tile2048) {
  return [
    `tile--d${String(tile.value).length}`,
    {
      'is-new': tile.isNew,
      'is-merged': tile.merged,
      'is-sliding': tile.sliding,
    },
  ]
}

function popupStyle(popup: { row: number; col: number }) {
  return {
    left: `${(popup.col + 0.5) * (100 / SIZE)}%`,
    top: `${(popup.row + 0.5) * (100 / SIZE)}%`,
  }
}

function press(direction: Direction): void {
  void doMove(direction, 'player')
}
</script>

<template>
  <div class="page game2048">
    <div class="container">
      <header class="game-head">
        <div>
          <span class="tag tag-gold">🔢 益智</span>
          <h1 class="game-head__title">2048</h1>
          <p class="game-head__sub">滑动合并相同数字方块，凑出 2048，还能继续冲击更大数字</p>
        </div>
        <div class="game-head__actions">
          <button class="btn btn-ai" :class="{ 'is-on': ai.enabled }" @click="toggleAi">
            ⚡ {{ aiButtonLabel }}
          </button>
          <button class="btn btn-ghost btn-icon" :title="soundOn ? '关闭音效' : '开启音效'" @click="soundOn = !soundOn">
            {{ soundOn ? '🔊' : '🔇' }}
          </button>
          <button class="btn btn-ghost" :disabled="padDisabled" @click="useHint">💡 提示</button>
          <button class="btn btn-ghost" @click="togglePause" :disabled="phase === 'won' || phase === 'over'">
            {{ phase === 'paused' ? '继续' : '暂停' }}
          </button>
          <button class="btn btn-primary" @click="startGame">重新开始</button>
        </div>
      </header>

      <div class="layout">
        <!-- 左栏：数据 -->
        <aside class="col">
          <section class="panel glass panel--stats">
            <StatTile label="当前得分" :value="score.toLocaleString('zh-CN')" accent="#fbbf24" highlight />
            <StatTile label="最高分" :value="best.toLocaleString('zh-CN')" accent="#7c5cff" />
            <StatTile label="最大方块" :value="maxTileValue" accent="#f97316" :hint="`目标 2048`" />
            <StatTile label="移动步数" :value="moveCount" accent="#34d399" :hint="won ? '已达成 2048' : '继续加油'" />
          </section>

          <section class="panel glass">
            <h2 class="panel__title">目标进度</h2>
            <div class="milestones">
              <span
                v-for="m in milestones"
                :key="m.value"
                class="milestone"
                :class="{ 'is-reached': m.reached }"
              >
                {{ m.value }}
              </span>
            </div>
            <p class="milestone-tip">
              当前最大方块 <b>{{ maxTileValue }}</b>
            </p>
          </section>
        </aside>

        <!-- 棋盘 -->
        <div class="board-wrap">
          <div
            class="board glass"
            :style="{ '--size': SIZE }"
            @pointerdown="onBoardPointerDown"
            @pointerup="onBoardPointerUp"
            @pointercancel="onBoardPointerCancel"
          >
            <div class="board__inner">
              <div class="board__cells" aria-hidden="true">
                <span v-for="i in SIZE * SIZE" :key="i" />
              </div>

              <div
                v-for="tile in tiles"
                :key="tile.id"
                class="tile"
                :class="tileClass(tile)"
                :style="tileStyle(tile)"
              >
                <span class="tile__inner">{{ tile.value }}</span>
              </div>

              <span
                v-for="p in popups"
                :key="p.id"
                class="popup"
                :class="`popup--${p.tone}`"
                :style="popupStyle(p)"
              >
                {{ p.text }}
              </span>

              <Transition name="hintFade">
                <span v-if="hintDirection" class="direction-hint">
                  {{ DIRECTION_META[hintDirection].arrow }}
                </span>
              </Transition>
            </div>

            <Transition name="overlay">
              <div v-if="overlay" class="overlay">
                <div class="overlay__card">
                  <h2 class="overlay__title">{{ overlay.title }}</h2>
                  <p class="overlay__desc">{{ overlay.desc }}</p>
                  <div class="overlay__actions">
                    <button class="btn btn-primary overlay__btn" @click="overlay.primaryAction()">
                      {{ overlay.primaryLabel }}
                    </button>
                    <button
                      v-if="overlay.secondaryLabel"
                      class="btn btn-ghost overlay__btn"
                      @click="overlay.secondaryAction?.()"
                    >
                      {{ overlay.secondaryLabel }}
                    </button>
                  </div>
                </div>
              </div>
            </Transition>

            <Transition name="overlay">
              <div v-if="ai.enabled && ai.status === 'confirm'" class="ai-confirm">
                <div class="ai-confirm__card">
                  <p class="ai-confirm__flag">⚡ JEV 外挂</p>
                  <h3 class="ai-confirm__title">Jev 已就绪</h3>
                  <p class="ai-confirm__desc">确认后由 Jev 接管棋盘，也可以先手动滑动</p>
                  <button class="btn btn-ai is-on" @click="confirmAi">点击确认，开启 JEV 外挂</button>
                </div>
              </div>
            </Transition>
          </div>

          <p class="board-tip">
            <span v-if="hintDirection" class="hint-chip">
              Jev 建议 {{ DIRECTION_META[hintDirection].arrow }} {{ DIRECTION_META[hintDirection].label }}
            </span>
            <span>方向键 / WASD 或直接滑动棋盘</span>
          </p>

          <div class="dpad">
            <button
              class="dpad__btn dpad__btn--up"
              :class="{ 'is-hint': hintDirection === 'up', 'is-shake': shakeDirection === 'up' }"
              :disabled="padDisabled"
              aria-label="向上"
              @click="press('up')"
            >
              ↑
            </button>
            <button
              class="dpad__btn dpad__btn--left"
              :class="{ 'is-hint': hintDirection === 'left', 'is-shake': shakeDirection === 'left' }"
              :disabled="padDisabled"
              aria-label="向左"
              @click="press('left')"
            >
              ←
            </button>
            <button
              class="dpad__btn dpad__btn--down"
              :class="{ 'is-hint': hintDirection === 'down', 'is-shake': shakeDirection === 'down' }"
              :disabled="padDisabled"
              aria-label="向下"
              @click="press('down')"
            >
              ↓
            </button>
            <button
              class="dpad__btn dpad__btn--right"
              :class="{ 'is-hint': hintDirection === 'right', 'is-shake': shakeDirection === 'right' }"
              :disabled="padDisabled"
              aria-label="向右"
              @click="press('right')"
            >
              →
            </button>
          </div>
        </div>

        <!-- 右栏：玩法 -->
        <aside class="col">
          <JevPanel :ai="ai" @toggle="toggleAi" @confirm="confirmAi" @save-key="saveApiKey" />

          <section class="panel glass">
            <h2 class="panel__title">玩法规则</h2>
            <ul class="rules">
              <li><b>滑动一次</b><span>所有方块靠拢</span></li>
              <li><b>相同数字</b><span>相撞合成双倍</span></li>
              <li><b>每次移动后</b><span>随机出现 2 或 4</span></li>
              <li><b>无法移动</b><span>对局结束</span></li>
            </ul>
          </section>

          <section class="panel glass">
            <h2 class="panel__title">计分</h2>
            <ul class="rules">
              <li><b>合成方块</b><span>得该方块的分数</span></li>
              <li><b>一次移动</b><span>可触发多次合并</span></li>
              <li><b>达成 2048</b><span>胜利，可继续挑战</span></li>
              <li><b>最高分</b><span>自动保存在本地</span></li>
            </ul>
          </section>

          <section class="panel glass">
            <h2 class="panel__title">方块图鉴</h2>
            <div class="showcase">
              <span
                v-for="item in showcase"
                :key="item.value"
                class="showcase__tile"
                :style="{
                  background: item.skin.bg,
                  color: item.skin.color,
                  borderColor: item.skin.border,
                  boxShadow: `0 6px 16px -10px ${item.skin.glow}`,
                }"
              >
                {{ item.value }}
              </span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game2048 {
  padding-top: 28px;
}

.tag-gold {
  background: rgba(251, 191, 36, 0.14);
  border-color: rgba(251, 191, 36, 0.36);
  color: #ffe0a3;
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
  flex-wrap: wrap;
}

.btn-ai {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.26), rgba(255, 77, 141, 0.2));
  border-color: rgba(251, 191, 36, 0.42);
  color: #ffe6b8;
}

.btn-ai:hover {
  border-color: rgba(251, 191, 36, 0.7);
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(255, 77, 141, 0.3));
}

.btn-ai.is-on {
  background: linear-gradient(135deg, #ffe259, #ffb648 45%, #ff4d8d);
  border-color: transparent;
  color: #1b0a13;
  animation: pulseGlow 1.8s ease-out infinite;
}

.layout {
  display: grid;
  grid-template-columns: minmax(200px, 250px) minmax(0, 1fr) minmax(190px, 240px);
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

.panel--stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.panel__title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 12px;
}

.panel--stats .panel__title {
  grid-column: 1 / -1;
}

.milestones {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.milestone {
  display: grid;
  place-items: center;
  padding: 7px 0;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  transition: all 0.3s var(--ease-out);
}

.milestone.is-reached {
  color: #1b0a13;
  background: linear-gradient(140deg, #ffe259, #fbbf24);
  border-color: transparent;
  box-shadow: 0 8px 20px -12px rgba(251, 191, 36, 0.95);
  transform: translateY(-1px);
}

.milestone-tip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-3);
}

.milestone-tip b {
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

/* ------------------------------ 棋盘 ------------------------------ */
.board-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.board {
  position: relative;
  width: min(100%, 460px);
  aspect-ratio: 1;
  padding: 10px;
  border-radius: var(--radius-lg);
  background: linear-gradient(150deg, rgba(251, 191, 36, 0.2), rgba(249, 115, 22, 0.13) 50%, rgba(255, 77, 141, 0.13));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.9), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  touch-action: none;
  overflow: hidden;
  container-type: inline-size;
}

.board__inner {
  position: relative;
  width: 100%;
  height: 100%;
}

.board__cells {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(var(--size, 4), 1fr);
  grid-template-rows: repeat(var(--size, 4), 1fr);
}

.board__cells span {
  margin: 4%;
  border-radius: 14%;
  background: rgba(9, 13, 28, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.tile {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% / var(--size, 4));
  height: calc(100% / var(--size, 4));
  padding: 0;
  background: none;
  border: none;
  transform: translate3d(calc(var(--col) * 100%), calc(var(--row) * 100%), 0);
  transition: transform 130ms cubic-bezier(0.25, 0.8, 0.35, 1);
  will-change: transform;
  pointer-events: none;
  z-index: 2;
}

.tile.is-sliding {
  z-index: 3;
}

.tile__inner {
  position: absolute;
  inset: 4%;
  display: grid;
  place-items: center;
  border-radius: 12%;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  background: var(--tile-bg);
  color: var(--tile-color);
  border: 1px solid var(--tile-border);
  box-shadow: 0 8px 22px -12px var(--tile-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  user-select: none;
}

.tile--d1 .tile__inner,
.tile--d2 .tile__inner {
  font-size: 7.6cqw;
}

.tile--d3 .tile__inner {
  font-size: 6.2cqw;
}

.tile--d4 .tile__inner {
  font-size: 5.1cqw;
}

.tile--d5 .tile__inner {
  font-size: 4.1cqw;
}

.tile.is-new .tile__inner {
  animation: tileIn 160ms var(--ease-bounce) backwards;
}

@keyframes tileIn {
  from {
    opacity: 0;
    transform: scale(0.2);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.tile.is-merged .tile__inner {
  animation: tilePop 200ms var(--ease-bounce);
}

@keyframes tilePop {
  0% {
    transform: scale(0.62);
  }
  60% {
    transform: scale(1.16);
  }
  100% {
    transform: scale(1);
  }
}

.popup {
  position: absolute;
  transform: translate(-50%, -50%);
  font-weight: 800;
  font-size: 15px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 6;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
  animation: popupFloat 0.9s var(--ease-out) forwards;
}

.popup--big {
  color: #ffe259;
  font-size: 18px;
}

@keyframes popupFloat {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.6);
  }
  25% {
    opacity: 1;
    transform: translate(-50%, -80%) scale(1.12);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -190%) scale(1);
  }
}

.direction-hint {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 86px;
  font-weight: 800;
  line-height: 1;
  color: rgba(255, 255, 255, 0.24);
  text-shadow: 0 0 34px rgba(251, 191, 36, 0.6);
  pointer-events: none;
  z-index: 7;
  animation: hintPulse 0.9s ease-in-out infinite;
}

@keyframes hintPulse {
  50% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1.14);
  }
}

.hintFade-enter-active,
.hintFade-leave-active {
  transition: opacity 0.2s var(--ease-out);
}
.hintFade-enter-from,
.hintFade-leave-to {
  opacity: 0;
}

/* ------------------------------ 方向键 ------------------------------ */
.dpad {
  display: grid;
  grid-template-columns: repeat(3, 46px);
  grid-template-rows: repeat(3, 46px);
  gap: 6px;
}

.dpad__btn {
  display: grid;
  place-items: center;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  transition: all 0.2s var(--ease-out);
}

.dpad__btn:hover:not(:disabled) {
  color: var(--text-1);
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.dpad__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dpad__btn--up {
  grid-area: 1 / 2;
}
.dpad__btn--left {
  grid-area: 2 / 1;
}
.dpad__btn--down {
  grid-area: 2 / 2;
}
.dpad__btn--right {
  grid-area: 2 / 3;
}

.dpad__btn.is-hint {
  color: #1b0a13;
  background: linear-gradient(140deg, #ffe259, #fbbf24);
  border-color: transparent;
  animation: dpadGlow 0.9s ease-out infinite;
}

@keyframes dpadGlow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.55);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
  }
}

.dpad__btn.is-shake {
  animation: dpadShake 0.3s ease-in-out;
}

@keyframes dpadShake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

/* ------------------------------ 覆盖层 ------------------------------ */
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 9;
  background: radial-gradient(75% 60% at 50% 42%, rgba(20, 14, 8, 0.72), rgba(6, 9, 20, 0.94));
  backdrop-filter: blur(8px);
}

.overlay__card {
  text-align: center;
}

.overlay__title {
  font-size: 26px;
}

.overlay__desc {
  margin-top: 8px;
  font-size: 13.5px;
  color: var(--text-2);
}

.overlay__actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
  flex-wrap: wrap;
}

.overlay__btn {
  padding: 12px 26px;
  font-size: 14.5px;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.3s var(--ease-out);
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.ai-confirm {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: end center;
  padding: 22px;
  z-index: 8;
  pointer-events: none;
}

.ai-confirm__card {
  pointer-events: auto;
  text-align: center;
  padding: 14px 20px 16px;
  border-radius: var(--radius-lg);
  background: rgba(12, 16, 32, 0.9);
  border: 1px solid rgba(251, 191, 36, 0.45);
  box-shadow: 0 22px 55px -22px rgba(0, 0, 0, 0.95), 0 0 30px -18px rgba(251, 191, 36, 0.9);
  backdrop-filter: blur(10px);
}

.ai-confirm__flag {
  display: inline-flex;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #1b0a13;
  background: linear-gradient(100deg, #ffe259, #ff4d8d);
  box-shadow: 0 8px 22px -10px rgba(255, 77, 141, 0.95);
}

.ai-confirm__title {
  margin-top: 10px;
  font-size: 18px;
}

.ai-confirm__desc {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-2);
}

.ai-confirm__card .btn {
  margin-top: 12px;
  padding: 10px 22px;
  font-size: 13.5px;
}

/* ------------------------------ 其他 ------------------------------ */
.board-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--text-3);
  text-align: center;
  flex-wrap: wrap;
  min-height: 24px;
}

.hint-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 12.5px;
  color: #1b0a13;
  background: linear-gradient(100deg, #ffe259, #fbbf24);
  box-shadow: 0 8px 22px -10px rgba(251, 191, 36, 0.95);
  animation: popIn 0.24s var(--ease-bounce);
}

.rules {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12.5px;
}

.rules li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rules li b {
  font-weight: 650;
}

.rules li span {
  color: var(--text-3);
}

.showcase {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.showcase__tile {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1140px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) minmax(190px, 240px);
  }
  .col:first-child {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .col:first-child .panel {
    flex: 1 1 220px;
  }
  .panel--stats {
    grid-template-columns: repeat(4, 1fr);
  }
  .board-wrap {
    grid-column: 1;
    grid-row: 1;
  }
  .col:last-child {
    grid-column: 2;
    grid-row: 1;
  }
}

@media (max-width: 780px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .board-wrap,
  .col:last-child,
  .col:first-child {
    grid-column: 1;
  }
  .board-wrap {
    grid-row: 1;
  }
  .col:last-child {
    grid-row: 2;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .col:last-child .panel {
    flex: 1 1 200px;
  }
  .col:first-child {
    grid-row: 3;
  }
  .panel--stats {
    grid-template-columns: 1fr 1fr;
  }
}
</style>