import type { PluginStorage } from '@hermes/plugin-sdk'

import type { ProgressCard, ProgressStep } from './model'

export interface ProgressShelf {
  read(key: string): ProgressCard | null
  write(key: string, card: ProgressCard): void
}

/**
 * Write the next card, then read it back. The caller paints the read value.
 * A throw or a mismatched read is a failed round-trip: nothing is confirmed.
 */
export function putProgressCard(
  shelf: ProgressShelf,
  key: string,
  previous: ProgressCard,
  plan: readonly ProgressStep[]
): ProgressCard | null {
  const next: ProgressCard = {
    sessionKey: previous.sessionKey,
    revision: previous.revision + 1,
    updatedAt: Date.now(),
    ...(previous.markdown !== undefined ? { markdown: previous.markdown } : {}),
    steps: plan.map(step => ({ step: step.step, status: step.status }))
  }

  try {
    shelf.write(key, next)
  } catch {
    return null
  }

  const saved = shelf.read(key)

  if (!saved || saved.revision !== next.revision || !samePlan(saved.steps, next.steps)) {
    return null
  }

  return saved
}

export function pluginProgressShelf(storage: PluginStorage): ProgressShelf {
  return {
    read(key) {
      return asCard(storage.get(key, null))
    },
    write(key, card) {
      storage.set(key, card)
    }
  }
}

export function progressKey(sessionId: string): string {
  return `progress:${sessionId}`
}

export function emptyProgressCard(sessionKey: string): ProgressCard {
  return { sessionKey, revision: 0, updatedAt: 0, steps: [] }
}

export function memoryShelf(seed: Record<string, ProgressCard> = {}): ProgressShelf & {
  cards: Record<string, ProgressCard>
} {
  const cards = { ...seed }

  return {
    cards,
    read(key) {
      const card = cards[key]

      return card ? structuredClone(card) : null
    },
    write(key, card) {
      cards[key] = structuredClone(card)
    }
  }
}

function asCard(value: unknown): ProgressCard | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Partial<ProgressCard>

  if (typeof record.sessionKey !== 'string' || typeof record.revision !== 'number' || !Array.isArray(record.steps)) {
    return null
  }

  return {
    sessionKey: record.sessionKey,
    revision: record.revision,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
    ...(typeof record.markdown === 'string' ? { markdown: record.markdown } : {}),
    steps: record.steps.flatMap(step => {
      if (!step || typeof step.step !== 'string') {
        return []
      }

      const status = step.status === 'completed' || step.status === 'in_progress' ? step.status : 'pending'

      return [{ step: step.step, status }]
    })
  }
}

function samePlan(left: readonly ProgressStep[], right: readonly ProgressStep[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((step, index) => step.step === right[index]?.step && step.status === right[index]?.status)
}
