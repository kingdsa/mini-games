<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="nf container">
    <div class="nf__box glass">
      <p class="nf__code gradient-text">404</p>
      <h1>这一关还没做出来</h1>
      <p class="nf__desc">你要找的页面不存在，不如回去挑个游戏玩？</p>
      <RouterLink to="/" class="btn btn-primary">返回首页</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.nf {
  display: grid;
  place-items: center;
  min-height: calc(100vh - var(--header-h) - 100px);
  padding: 40px 0;
}

.nf__box {
  padding: 48px 40px;
  text-align: center;
  max-width: 460px;
}

.nf__code {
  font-size: 84px;
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 1;
}

.nf__desc {
  margin: 12px 0 26px;
  color: var(--text-2);
  font-size: 14px;
}
</style>