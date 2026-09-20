import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

export const GAME_ROUTES: RouteRecordRaw[] = [
  {
    path: '/games/tetris',
    name: 'tetris',
    component: () => import('@/games/tetris/TetrisView.vue'),
    meta: {
      title: '俄罗斯方块',
      subtitle: '经典俄罗斯方块 · 7-bag 随机器 / SRS 旋转 / Hold 暂存',
      emoji: '🧱',
      accent: '#22d3ee',
      accent2: '#7c5cff',
      tag: '经典',
    },
  },
  {
    path: '/games/match3',
    name: 'match3',
    component: () => import('@/games/match3/Match3View.vue'),
    meta: {
      title: '开心消消乐',
      subtitle: '三消连锁 · 关卡目标 / 连击加成分 / 自动洗牌',
      emoji: '🍬',
      accent: '#ff4d8d',
      accent2: '#fbbf24',
      tag: '休闲',
    },
  },
  {
    path: '/games/2048',
    name: '2048',
    component: () => import('@/games/game2048/Game2048View.vue'),
    meta: {
      title: '2048',
      subtitle: '数字合并 · 滑动方块 / 冲击 2048 / JEV AI 实时指导',
      emoji: '🔢',
      accent: '#fbbf24',
      accent2: '#f97316',
      tag: '益智',
    },
  },
  {
    path: '/tools/gf-translator',
    name: 'gf-translator',
    component: () => import('@/games/gf-translator/GfTranslatorView.vue'),
    meta: {
      title: '女友翻译器',
      subtitle: '聊天模拟 · 情绪 / 生气指数 / 潜台词识别，JEV 替你回复',
      emoji: '💬',
      accent: '#ff4d8d',
      accent2: '#7c5cff',
      tag: 'AI 工具',
      hideStats: true,
      ctaLabel: '来试试',
    },
  },
]

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '小游戏合集' },
  },
  ...GAME_ROUTES,
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面走丢了' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '小游戏合集'
  document.title = `${title} · Mini Games`
})

export default router