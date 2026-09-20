<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CandySprite from './CandySprite.vue'
import JevPanel from './JevPanel.vue'
import StatTile from '@/components/StatTile.vue'
import { useMatch3, type Tile } from './useMatch3'
import { CANDIES, COLS, LEVELS, ROWS, STAR_MULTIPLIERS, starsFor } from './constants'
import { useScoreStore } from '@/stores/scores'
import { sfx } from '@/utils/sfx'

const store = useScoreStore()
const best = computed(() => store.best('match3'))

const {
  tiles,
  phase,
  level,
  levelIndex,
  score,
  movesLeft,
  combo,
  bestCombo,
  progress,
  selected,
  hint,
  popups,
  toast,
  wrongPair,
  stars,
  busy,
  ai,
  startLevel,
  restart,
  nextLevel,
  togglePause,
  useHint,
  toggleAi,
  confirmAi,
  saveApiKey,
  onTileClick,
  onTilePointerDown,
} = useMatch3({
  onLevelEnd: (finalScore, levelId, earnedStars) => {
    store.submit('match3', finalScore, { level: levelId, stars: earnedStars })
  },
})

const soundOn = ref(sfx.enabled)
watch(soundOn, (v) => sfx.setEnabled(v))

const atLastLevel = computed(() => levelIndex.value >= LEVELS.length - 1)
const starsEarned = computed(() => starsFor(score.value, level.value.target))

function markerLeft(multiplier: number): string {
  return `${Math.min((multiplier / STAR_MULTIPLIERS[2]) * 100, 100)}%`
}

function markerReached(multiplier: number): boolean {
  return score.value >= level.value.target * multiplier
}

const hintIds = computed(() => new Set(hint.value.map((t) => t.id)))
const wrongIds = computed(() => new Set(wrongPair.value.map((t) => t.id)))

function tileStyle(tile: Tile) {
  return {
    transform: `translate3d(${tile.col * 100}%, ${tile.row * 100}%, 0)`,
  }
}

function tileClass(tile: Tile) {
  return {
    'is-selected': selected.value?.id === tile.id,
    'is-clearing': tile.clearing,
    'is-hint': hintIds.value.has(tile.id),
    'is-wrong': wrongIds.value.has(tile.id),
  }
}

function popupStyle(p: { row: number; col: number }) {
  return {
    left: `${(p.col + 0.5) * (100 / COLS)}%`,
    top: `${(p.row + 0.5) * (100 / ROWS)}%`,
  }
}

const overlay = computed(() => {
  if (phase.value === 'won') {
    return {
      title: stars.value >= 3 ? '完美通关！' : '过关！',
      desc:
        `本关得分 ${score.value.toLocaleString('zh-CN')} / 目标 ${level.value.target.toLocaleString('zh-CN')}` +
        (ai.enabled ? ' · 下一关需再次确认才开启外挂' : ''),
      cta: atLastLevel.value ? '从第 1 关重新开始' : '进入下一关',
      action: nextLevel,
      stars: stars.value,
    }
  }
  if (phase.value === 'over') {
    return {
      title: '步数用完啦',
      desc:
        `距离目标还差 ${(level.value.target - score.value).toLocaleString('zh-CN')} 分` +
        (ai.enabled ? ' · 重开后需再次确认才开启外挂' : ''),
      cta: '再试一次',
      action: restart,
      stars: 0,
    }
  }
  if (phase.value === 'paused') {
    return { title: '已暂停', desc: '休息一下，糖果不会跑掉', cta: '继续游戏', action: togglePause, stars: -1 }
  }
  return null
})
</script>

<template>
  <div class="page match3">
    <div class="container">
      <header class="game-head">
        <div>
          <span class="tag tag-pink">🍬 休闲</span>
          <h1 class="game-head__title">开心消消乐</h1>
          <p class="game-head__sub">交换相邻糖果凑成三个同色即可消除，连锁越长得分越高</p>
        </div>
        <div class="game-head__actions">
          <button class="btn btn-ai" :class="{ 'is-on': ai.enabled }" @click="toggleAi">
            ⚡ {{ !ai.enabled ? 'JEV 外挂' : ai.status === 'confirm' ? '等待确认' : '外挂运行中' }}
          </button>
          <button class="btn btn-ghost btn-icon" :title="soundOn ? '关闭音效' : '开启音效'" @click="soundOn = !soundOn">
            {{ soundOn ? '🔊' : '🔇' }}
          </button>
          <button class="btn btn-ghost" @click="useHint" :disabled="busy || ai.enabled">💡 提示</button>
          <button class="btn btn-ghost" @click="togglePause" :disabled="phase === 'won' || phase === 'over'">
            {{ phase === 'paused' ? '继续' : '暂停' }}
          </button>
          <button class="btn btn-primary" @click="restart">重新开始</button>
        </div>
      </header>

      <div class="layout">
        <!-- 左栏：数据 -->
        <aside class="col">
          <section class="panel glass panel--stats">
            <StatTile label="本关得分" :value="score.toLocaleString('zh-CN')" accent="#ff4d8d" highlight />
            <StatTile label="最高分" :value="best.toLocaleString('zh-CN')" accent="#7c5cff" />
            <StatTile label="剩余步数" :value="movesLeft" accent="#fbbf24" :hint="`共 ${level.moves} 步`" />
            <StatTile
              label="当前连锁"
              :value="combo > 1 ? `×${combo}` : '—'"
              accent="#34d399"
              :hint="`历史最高 ×${bestCombo}`"
              :highlight="combo > 1"
            />
          </section>

          <section class="panel glass">
            <h2 class="panel__title">关卡目标</h2>
            <p class="level-name">{{ level.name }}</p>
            <p class="level-desc">{{ level.desc }}</p>

            <div class="progress">
              <div class="progress__track">
                <div class="progress__fill" :style="{ width: `${progress * 100}%` }"></div>
                <span
                  v-for="(m, i) in STAR_MULTIPLIERS"
                  :key="m"
                  class="progress__marker"
                  :class="{ 'is-reached': markerReached(m) }"
                  :style="{ left: markerLeft(m) }"
                >
                  ★<em>{{ i + 1 }}</em>
                </span>
              </div>
              <div class="progress__labels">
                <span>{{ score.toLocaleString('zh-CN') }}</span>
                <span>目标 {{ level.target.toLocaleString('zh-CN') }}</span>
              </div>
            </div>

            <div class="stars-row" aria-label="星级">
              <span v-for="i in 3" :key="i" class="star" :class="{ 'is-on': starsEarned >= i }">★</span>
            </div>
          </section>

          <section class="panel glass">
            <h2 class="panel__title">关卡选择</h2>
            <div class="level-chips">
              <button
                v-for="(lv, i) in LEVELS"
                :key="lv.id"
                class="level-chip"
                :class="{ 'is-active': i === levelIndex }"
                :title="lv.name"
                @click="startLevel(i)"
              >
                {{ lv.id }}
              </button>
            </div>
          </section>
        </aside>

        <!-- 棋盘 -->
        <div class="board-wrap">
          <div class="board glass" :style="{ '--cols': COLS, '--rows': ROWS }">
            <div class="board__grid" aria-hidden="true">
              <span
                v-for="i in COLS * ROWS"
                :key="i"
                :class="{ 'is-alt': (Math.floor((i - 1) / COLS) + ((i - 1) % COLS)) % 2 === 0 }"
              />
            </div>

            <button
              v-for="tile in tiles"
              :key="tile.id"
              type="button"
              class="tile"
              :class="tileClass(tile)"
              :style="tileStyle(tile)"
              :aria-label="`糖果 ${tile.type + 1}`"
              @click="onTileClick(tile)"
              @pointerdown="onTilePointerDown(tile, $event)"
            >
              <span class="tile__inner">
                <CandySprite :type="tile.type" />
              </span>
            </button>

            <span
              v-for="p in popups"
              :key="p.id"
              class="popup"
              :class="`popup--${p.tone}`"
              :style="popupStyle(p)"
            >
              {{ p.text }}
            </span>

            <Transition name="overlay">
              <div v-if="overlay" class="overlay">
                <div class="overlay__card">
                  <div v-if="overlay.stars >= 0" class="overlay__stars">
                    <span
                      v-for="i in 3"
                      :key="i"
                      class="star star--lg"
                      :class="{ 'is-on': overlay.stars >= i }"
                      >★</span
                    >
                  </div>
                  <h2 class="overlay__title">{{ overlay.title }}</h2>
                  <p class="overlay__desc">{{ overlay.desc }}</p>
                  <button class="btn btn-primary overlay__btn" @click="overlay.action()">
                    {{ overlay.cta }}
                  </button>
                </div>
              </div>
            </Transition>

            <Transition name="overlay">
              <div v-if="ai.enabled && ai.status === 'confirm'" class="ai-confirm">
                <div class="ai-confirm__card">
                  <p class="ai-confirm__flag">⚡ JEV 外挂</p>
                  <h3 class="ai-confirm__title">已进入「{{ level.name }}」</h3>
                  <p class="ai-confirm__desc">确认后由 Jev 接管本关，也可以先手动开玩</p>
                  <button class="btn btn-ai is-on" @click="confirmAi">点击确认，开启 JEV 外挂</button>
                </div>
              </div>
            </Transition>

            <Transition name="banner">
              <span v-if="toast" class="toast">{{ toast }}</span>
            </Transition>
          </div>

          <p class="board-tip">
            <span v-if="combo > 1 && phase === 'playing'" class="combo-chip">连锁 ×{{ combo }}</span>
            <span>点击两个相邻糖果交换，也可以直接按住拖动</span>
          </p>
        </div>

        <!-- 右栏：玩法 -->
        <aside class="col">
          <JevPanel :ai="ai" @toggle="toggleAi" @confirm="confirmAi" @save-key="saveApiKey" />

          <section class="panel glass">
            <h2 class="panel__title">玩法规则</h2>
            <ul class="rules">
              <li><b>3 个同色</b><span>基础消除</span></li>
              <li><b>横竖交叉</b><span>一次性清除更多</span></li>
              <li><b>连锁反应</b><span>每层 ×0.5 加成</span></li>
              <li><b>步数用尽</b><span>达到目标才算过关</span></li>
            </ul>
          </section>

          <section class="panel glass">
            <h2 class="panel__title">计分</h2>
            <ul class="rules">
              <li><b>每个糖果</b><span>60 分</span></li>
              <li><b>第 2 连锁</b><span>×1.5 倍</span></li>
              <li><b>第 3 连锁</b><span>×2.0 倍</span></li>
              <li><b>每多一层</b><span>倍率 +0.5</span></li>
            </ul>
          </section>

          <section class="panel glass panel--candies">
            <h2 class="panel__title">糖果图鉴</h2>
            <div class="candy-list">
              <div v-for="(c, i) in CANDIES" :key="c.key" class="candy-item" :title="c.name">
                <CandySprite :type="i" />
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.match3 {
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
  flex-wrap: wrap;
}

.btn-ai {
  background: linear-gradient(135deg, rgba(255, 77, 141, 0.26), rgba(168, 85, 247, 0.22));
  border-color: rgba(255, 77, 141, 0.42);
  color: #ffd7e6;
}

.btn-ai:hover {
  border-color: rgba(255, 77, 141, 0.7);
  background: linear-gradient(135deg, rgba(255, 77, 141, 0.4), rgba(168, 85, 247, 0.32));
}

.btn-ai.is-on {
  background: linear-gradient(135deg, #ffe259, #ff4d8d 55%, #a855f7);
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

.panel__title {
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

.level-name {
  font-size: 15px;
  font-weight: 700;
}

.level-desc {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--text-3);
}

.progress {
  margin-top: 14px;
}

.progress__track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border);
  overflow: visible;
}

.progress__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff4d8d, #fbbf24 55%, #34d399);
  box-shadow: 0 0 14px -2px rgba(255, 77, 141, 0.8);
  transition: width 0.45s var(--ease-out);
}

.progress__marker {
  position: absolute;
  top: -8px;
  transform: translateX(-50%);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.24);
  transition: color 0.3s, text-shadow 0.3s;
  line-height: 1;
}

.progress__marker em {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-style: normal;
  color: var(--text-3);
}

.progress__marker.is-reached {
  color: #fbbf24;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.9);
}

.progress__labels {
  display: flex;
  justify-content: space-between;
  margin-top: 22px;
  font-size: 11.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.stars-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.star {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.14);
  transition: color 0.3s, text-shadow 0.3s, transform 0.3s var(--ease-bounce);
}

.star.is-on {
  color: #fbbf24;
  text-shadow: 0 0 16px rgba(251, 191, 36, 0.9);
  transform: scale(1.1);
}

.star--lg {
  font-size: 34px;
}

.level-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.level-chip {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  transition: all 0.22s var(--ease-out);
}

.level-chip:hover {
  color: var(--text-1);
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.level-chip.is-active {
  color: #fff;
  background: linear-gradient(140deg, #ff4d8d, #a855f7);
  border-color: transparent;
  box-shadow: 0 10px 24px -12px rgba(255, 77, 141, 0.95);
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
  width: min(100%, 480px);
  aspect-ratio: 1;
  padding: 10px;
  border-radius: var(--radius-lg);
  background: linear-gradient(150deg, rgba(255, 77, 141, 0.22), rgba(124, 92, 255, 0.16) 55%, rgba(251, 191, 36, 0.14));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.9), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  touch-action: none;
  overflow: hidden;
}

.board__grid {
  position: absolute;
  inset: 10px;
  display: grid;
  grid-template-columns: repeat(var(--cols, 8), 1fr);
  grid-template-rows: repeat(var(--rows, 8), 1fr);
  border-radius: 16px;
  overflow: hidden;
}

.board__grid span {
  background: rgba(10, 14, 30, 0.55);
}

.board__grid span.is-alt {
  background: rgba(22, 28, 52, 0.5);
}

.tile {
  position: absolute;
  top: 10px;
  left: 10px;
  width: calc(100% / var(--cols, 8));
  height: calc(100% / var(--rows, 8));
  padding: 0.6%;
  background: none;
  border: none;
  transition: transform 240ms cubic-bezier(0.3, 1.15, 0.5, 1);
  will-change: transform;
}

.tile__inner {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 26%;
  transition: transform 0.22s var(--ease-out), box-shadow 0.24s var(--ease-out), opacity 0.2s;
  animation: candyIn 340ms var(--ease-bounce) backwards;
  padding: 6%;
}

@keyframes candyIn {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.tile:hover .tile__inner {
  transform: scale(1.08);
}

.tile.is-selected .tile__inner {
  transform: scale(1.16);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 22px 2px rgba(255, 255, 255, 0.55);
  border-radius: 30%;
}

.tile.is-hint .tile__inner {
  animation: hintPulse 1.1s ease-in-out infinite;
}

@keyframes hintPulse {
  0%,
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.14);
    filter: brightness(1.5);
  }
}

.tile.is-wrong .tile__inner {
  animation: shake 0.42s ease-in-out;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-14%) rotate(-5deg);
  }
  75% {
    transform: translateX(14%) rotate(5deg);
  }
}

.tile.is-clearing {
  pointer-events: none;
}

.tile.is-clearing .tile__inner {
  animation: candyOut 260ms ease-in forwards;
}

@keyframes candyOut {
  0% {
    transform: scale(1.18);
    filter: brightness(2.2);
  }
  100% {
    transform: scale(0.1) rotate(160deg);
    opacity: 0;
  }
}

.tile.is-clearing::after {
  content: '';
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.85);
  animation: ring 300ms ease-out forwards;
  pointer-events: none;
}

@keyframes ring {
  from {
    transform: scale(0.5);
    opacity: 0.9;
  }
  to {
    transform: scale(1.7);
    opacity: 0;
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
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
  animation: popupFloat 1s var(--ease-out) forwards;
}

.popup--normal {
  color: #fff;
}
.popup--combo {
  color: #ffe259;
  font-size: 17px;
}
.popup--big {
  color: #7df9ff;
  font-size: 20px;
}

@keyframes popupFloat {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.6);
  }
  25% {
    opacity: 1;
    transform: translate(-50%, -80%) scale(1.15);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -190%) scale(1);
  }
}

.toast {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  padding: 7px 18px;
  border-radius: 999px;
  font-weight: 800;
  letter-spacing: 0.04em;
  pointer-events: none;
  white-space: nowrap;
  z-index: 8;
  bottom: 14px;
  font-size: 12.5px;
  color: var(--text-1);
  background: rgba(12, 16, 32, 0.86);
  border: 1px solid var(--border-strong);
  backdrop-filter: blur(10px);
}

.banner-enter-active {
  transition: opacity 0.2s, transform 0.34s var(--ease-bounce);
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
  transform: translateX(-50%) translateY(-10px) scale(0.9);
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
  border: 1px solid rgba(255, 77, 141, 0.45);
  box-shadow: 0 22px 55px -22px rgba(0, 0, 0, 0.95), 0 0 30px -18px rgba(255, 77, 141, 0.9);
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

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 9;
  background: radial-gradient(75% 60% at 50% 42%, rgba(14, 10, 30, 0.72), rgba(6, 9, 20, 0.94));
  backdrop-filter: blur(8px);
}

.overlay__card {
  text-align: center;
}

.overlay__stars {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 12px;
}

.overlay__title {
  font-size: 26px;
}

.overlay__desc {
  margin-top: 8px;
  font-size: 13.5px;
  color: var(--text-2);
}

.overlay__btn {
  margin-top: 22px;
  padding: 12px 30px;
  font-size: 15px;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.3s var(--ease-out);
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.board-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--text-3);
  text-align: center;
}

.combo-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 12.5px;
  color: #1b0a13;
  background: linear-gradient(100deg, #ffe259, #ff4d8d);
  box-shadow: 0 8px 22px -10px rgba(255, 77, 141, 0.95);
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

.candy-list {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.candy-item {
  aspect-ratio: 1;
  padding: 2px;
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
  .panel--stats .panel__title {
    grid-column: 1 / -1;
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
  }
  .col:first-child {
    grid-row: 3;
  }
  .col:last-child {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .col:last-child .panel {
    flex: 1 1 200px;
  }
  .panel--stats {
    grid-template-columns: 1fr 1fr;
  }
}
</style>