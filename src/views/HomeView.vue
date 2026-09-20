<script setup lang="ts">
import { computed } from 'vue'
import GameCard from '@/components/GameCard.vue'
import { GAME_ROUTES } from '@/router'

const games = computed(() =>
  GAME_ROUTES.map((r) => ({
    id: r.name as string,
    path: r.path,
    title: r.meta?.title as string,
    subtitle: r.meta?.subtitle as string,
    emoji: r.meta?.emoji as string,
    tag: r.meta?.tag as string,
    accent: r.meta?.accent as string,
    accent2: r.meta?.accent2 as string,
  })),
)

const features = [
  { icon: '⚡️', title: '极速体验', desc: 'Vite 5 + 原生 ESM，冷启动毫秒级' },
  { icon: '🎮', title: '手感优先', desc: 'SRS 旋转 / 锁延迟 / 连击连锁，接近街机' },
  { icon: '🎨', title: '原创素材', desc: '全部图形与音效均为代码实时生成' },
  { icon: '📱', title: '全端适配', desc: '键盘、鼠标、触屏拖拽都能玩' },
]
</script>

<template>
  <div class="home">
    <section class="hero container">
      <span class="hero__badge fade-up">
        <span class="hero__dot"></span>
        Vue 3.5 · TypeScript · Vue Router 4 · Pinia
      </span>

      <h1 class="hero__title fade-up" style="animation-delay: 0.06s">
        一个精心打磨的<br />
        <span class="gradient-text">小游戏合集</span>
      </h1>

      <p class="hero__desc fade-up" style="animation-delay: 0.12s">
        每个游戏都是纯前端实现：自研游戏引擎、原创 SVG 素材、WebAudio 实时合成音效。
        没有图片、没有音频文件，只有代码。
      </p>

      <div class="hero__actions fade-up" style="animation-delay: 0.18s">
        <RouterLink to="/games/tetris" class="btn btn-primary">🧱 玩俄罗斯方块</RouterLink>
        <RouterLink to="/games/match3" class="btn btn-ghost">🍬 玩开心消消乐</RouterLink>
      </div>
    </section>

    <section class="container">
      <div class="section-head">
        <h2>选择游戏</h2>
        <p>两个完整的游戏，四种操作方式</p>
      </div>

      <div class="grid">
        <GameCard v-for="(g, i) in games" :key="g.id" v-bind="g" class="fade-up" :style="{ animationDelay: `${0.08 * i}s` }" />
      </div>
    </section>

    <section class="container">
      <div class="section-head">
        <h2>技术亮点</h2>
        <p>不是玩具，是认真写的</p>
      </div>

      <ul class="features">
        <li v-for="f in features" :key="f.title" class="feature glass">
          <span class="feature__icon">{{ f.icon }}</span>
          <div>
            <h4>{{ f.title }}</h4>
            <p>{{ f.desc }}</p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  z-index: 1;
  padding: 64px 0 80px;
}

.hero {
  text-align: center;
  padding-bottom: 76px;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 7px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid var(--border);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-2);
  backdrop-filter: blur(12px);
}

.hero__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.6);
  animation: pulseDot 2.2s ease-out infinite;
}

@keyframes pulseDot {
  0% {
    box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.6);
  }
  70% {
    box-shadow: 0 0 0 9px rgba(52, 211, 153, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
  }
}

.hero__title {
  margin: 24px 0 0;
  font-size: clamp(36px, 6.4vw, 68px);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.08;
}

.hero__desc {
  max-width: 600px;
  margin: 20px auto 0;
  font-size: 16px;
  color: var(--text-2);
}

.hero__actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 30px;
  flex-wrap: wrap;
}

.hero__actions .btn {
  padding: 13px 26px;
  font-size: 15px;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.section-head h2 {
  font-size: 24px;
}

.section-head p {
  font-size: 13.5px;
  color: var(--text-3);
}

.grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  margin-bottom: 72px;
}

.features {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.feature {
  display: flex;
  gap: 13px;
  align-items: flex-start;
  padding: 18px;
  transition: transform 0.3s var(--ease-out), border-color 0.3s;
}

.feature:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
}

.feature__icon {
  font-size: 20px;
  line-height: 1.2;
}

.feature h4 {
  font-size: 15px;
}

.feature p {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 2px;
}
</style>