import type { PluginStorage } from '@hermes/plugin-sdk'

export type Workflow = {
  id: string
  title: string
  memberIds: string[]
}

export type DeskRecords = {
  children: Record<string, string>
  workflows: Workflow[]
  faces: Record<string, number>
  members: Record<string, string[]>
}

const KEY = 'desk'

const EMPTY: DeskRecords = { children: {}, workflows: [], faces: {}, members: {} }

export function readDesk(storage: PluginStorage): DeskRecords {
  const value = storage.get(KEY, EMPTY)

  if (!value || typeof value !== 'object') {
    return { ...EMPTY }
  }

  const record = value as Partial<DeskRecords>

  return {
    children: stringMap(record.children),
    workflows: Array.isArray(record.workflows) ? record.workflows.flatMap(parseWorkflow) : [],
    faces: numberMap(record.faces),
    members: stringListMap(record.members)
  }
}

export function writeDesk(storage: PluginStorage, records: DeskRecords): void {
  storage.set(KEY, records)
}

export function childStorageKey(roomId: string, agentId: string): string {
  return `${roomId}:${agentId}`
}

function parseWorkflow(value: unknown): Workflow[] {
  if (!value || typeof value !== 'object') {
    return []
  }

  const record = value as Partial<Workflow>
  const id = typeof record.id === 'string' ? record.id : ''
  const title = typeof record.title === 'string' ? record.title.trim() : ''

  if (!id || !title) {
    return []
  }

  return [{ id, title, memberIds: Array.isArray(record.memberIds) ? record.memberIds.filter(isString) : [] }]
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const next: Record<string, string> = {}

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && item) {
      next[key] = item
    }
  }

  return next
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const next: Record<string, number> = {}

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number') {
      next[key] = item
    }
  }

  return next
}

function stringListMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const next: Record<string, string[]> = {}

  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) {
      next[key] = item.filter(isString)
    }
  }

  return next
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
