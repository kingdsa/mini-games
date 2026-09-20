<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { GAME_ROUTES } from '@/router'

const games = computed(() => GAME_ROUTES)
const scrolled = ref(false)
const menuOpen = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 8
  if (menuOpen.value) menuOpen.value = false
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header class="header" :class="{ 'is-scrolled': scrolled }">
    <div class="container header__inner">
      <RouterLink to="/" class="brand" @click="menuOpen = false">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="26" height="26">
            <defs>
              <linearGradient id="hdrLogo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#7c5cff" />
                <stop offset="100%" stop-color="#22d3ee" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#hdrLogo)" />
            <g fill="#fff" opacity=".92">
              <rect x="7" y="7" width="6" height="6" rx="1.8" />
              <rect x="14" y="7" width="6" height="6" rx="1.8" />
              <rect x="14" y="14" width="6" height="6" rx="1.8" />
              <rect x="21" y="14" width="6" height="6" rx="1.8" opacity=".65" />
              <rect x="14" y="21" width="6" height="6" rx="1.8" opacity=".65" />
            </g>
          </svg>
        </span>
        <span class="brand__text">
          <strong>Mini Games</strong>
          <small>小游戏合集</small>
        </span>
      </RouterLink>

      <nav class="nav" aria-label="主导航">
        <RouterLink to="/" class="nav__link" exact-active-class="is-active">首页</RouterLink>
        <RouterLink
          v-for="g in games"
          :key="g.path"
          :to="g.path"
          class="nav__link"
          active-class="is-active"
        >
          <span class="nav__emoji">{{ g.meta?.emoji }}</span>
          {{ g.meta?.title }}
        </RouterLink>
      </nav>

      <div class="header__actions">
        <RouterLink to="/games/match3" class="btn btn-primary header__cta">
          开始游戏
        </RouterLink>
        <button
          class="btn btn-icon menu-toggle"
          type="button"
          aria-label="菜单"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="menu-toggle__bars" :class="{ 'is-open': menuOpen }"></span>
        </button>
      </div>
    </div>

    <Transition name="dropdown">
      <div v-if="menuOpen" class="mobile-menu glass">
        <RouterLink to="/" class="mobile-menu__item" @click="menuOpen = false">🏠 首页</RouterLink>
        <RouterLink
          v-for="g in games"
          :key="g.path"
          :to="g.path"
          class="mobile-menu__item"
          @click="menuOpen = false"
        >
          {{ g.meta?.emoji }} {{ g.meta?.title }}
        </RouterLink>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  transition: background 0.3s var(--ease-out), border-color 0.3s, backdrop-filter 0.3s;
  border-bottom: 1px solid transparent;
}

.header.is-scrolled {
  background: rgba(8, 12, 26, 0.72);
  border-bottom-color: var(--border);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
}

.header__inner {
  display: flex;
  height: var(--header-h);
  align-items: center;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  flex-shrink: 0;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-1);
  transition: transform 0.3s var(--ease-bounce);
}

.brand:hover .brand__mark {
  transform: rotate(-8deg) scale(1.06);
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.brand__text strong {
  font-size: 15.5px;
  letter-spacing: -0.01em;
}

.brand__text small {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.14em;
}

.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.nav__link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  transition: color 0.2s, background 0.24s var(--ease-out);
}

.nav__link:hover {
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.06);
}

.nav__link.is-active {
  color: var(--text-1);
  background: linear-gradient(135deg, rgba(124, 92, 255, 0.28), rgba(34, 211, 238, 0.18));
  box-shadow: inset 0 0 0 1px rgba(124, 92, 255, 0.4);
}

.nav__emoji {
  font-size: 15px;
}

.header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
}

.header__cta {
  padding: 9px 20px;
  font-size: 13.5px;
}

.menu-toggle {
  display: none;
}

.menu-toggle__bars,
.menu-toggle__bars::before,
.menu-toggle__bars::after {
  display: block;
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--text-1);
  transition: transform 0.26s var(--ease-out), opacity 0.2s;
}

.menu-toggle__bars {
  position: relative;
}

.menu-toggle__bars::before,
.menu-toggle__bars::after {
  content: '';
  position: absolute;
  left: 0;
}

.menu-toggle__bars::before {
  top: -6px;
}
.menu-toggle__bars::after {
  top: 6px;
}

.menu-toggle__bars.is-open {
  background: transparent;
}
.menu-toggle__bars.is-open::before {
  transform: translateY(6px) rotate(45deg);
}
.menu-toggle__bars.is-open::after {
  transform: translateY(-6px) rotate(-45deg);
}

.mobile-menu {
  position: absolute;
  left: 20px;
  right: 20px;
  top: calc(var(--header-h) - 6px);
  padding: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-2);
}

.mobile-menu__item {
  padding: 12px 14px;
  border-radius: 12px;
  font-weight: 600;
  color: var(--text-1);
}

.mobile-menu__item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.22s var(--ease-out), transform 0.22s var(--ease-out);
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 860px) {
  .nav {
    display: none;
  }
  .menu-toggle {
    display: inline-flex;
  }
  .header__actions {
    margin-left: auto;
  }
  .header__cta {
    display: none;
  }
}
</style>