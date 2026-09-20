import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface GameRecord {
  best: number
  plays: number
  lastPlayed: number | null
  extra?: Record<string, number>
}

type Records = Record<string, GameRecord>

const STORAGE_KEY = 'mini-games:records'

function emptyRecord(): GameRecord {
  return { best: 0, plays: 0, lastPlayed: null, extra: {} }
}

function load(): Records {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Records
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const useScoreStore = defineStore('scores', () => {
  const records = ref<Records>(load())

  watch(
    records,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  function record(id: string): GameRecord {
    return records.value[id] ?? emptyRecord()
  }

  function best(id: string): number {
    return records.value[id]?.best ?? 0
  }

  function submit(id: string, score: number, extra?: Record<string, number>): boolean {
    const current = records.value[id] ?? emptyRecord()
    const isBest = score > current.best
    records.value[id] = {
      best: Math.max(current.best, score),
      plays: current.plays + 1,
      lastPlayed: Date.now(),
      extra: { ...current.extra, ...(extra ?? {}) },
    }
    return isBest
  }

  function reset(id?: string): void {
    if (!id) {
      records.value = {}
      return
    }
    const next = { ...records.value }
    delete next[id]
    records.value = next
  }

  return { records, record, best, submit, reset }
})