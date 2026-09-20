<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="container footer__inner">
      <p class="footer__copy">© {{ year }} Mini Games · 用 Vue 3 + TypeScript 打造</p>
      <p class="footer__stack">
        <span class="tag tag-cyan">Vue 3.5</span>
        <span class="tag">TypeScript</span>
        <span class="tag tag-pink">Vue Router 4</span>
        <span class="tag">Vite</span>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--border);
  background: rgba(6, 9, 20, 0.5);
}

.footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 0;
  flex-wrap: wrap;
}

.footer__copy {
  font-size: 13px;
  color: var(--text-3);
}

.footer__stack {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>