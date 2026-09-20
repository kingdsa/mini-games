/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TypeSafe API Key（建议写在 .env.local，不要提交） */
  readonly VITE_TYPESAFE_API_KEY?: string
  /** TypeSafe API 基地址，默认 /jev-api（Vite 代理），也可设为 https://api.typesafe.ai */
  readonly VITE_TYPESAFE_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}