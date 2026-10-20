import { host, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { type GoalFacts, type GoalGate, type MaidHold, maidPresenceHold } from './model'

export type AtelierProfile = {
  id: string
  name: string
  route: PluginProfileRoute | string
  canonicalSessionId: string | null
  lastSessionId: string | null
}

export type AtelierSession = {
  id: string
  title: string
  preview: string
  updatedAt: number
  /** null when the live list could not be read. Never treat that as idle. */
  busy: boolean | null
  profileId: string
  /** Workspace fields from `session.list`. Null when the row did not report them. */
  cwd: string | null
  gitRepoRoot: string | null
  gitBranch: string | null
}

/** One `projects.tree` node. Session ids are only those the tree itself listed. */
export type AtelierProject = {
  id: string
  label: string
  path: string | null
  sessionIds: string[]
}

export type AtelierMessage = {
  role: 'assistant' | 'user'
  name: string
  text: string
}

export type AtelierTranscript = {
  runtimeId: string
  storedId: string
  messages: AtelierMessage[]
  goal: GoalFacts | null
  running: boolean
  /** Live session hold. A blocked goal is not copied here. */
  sessionHold: MaidHold | null
  /** Resume `info.project.primary_path`, else `info.cwd`. Null when absent. */
  workspacePath: string | null
}

export type AtelierGateway = {
  listProfiles: () => Promise<AtelierProfile[]>
  listSessions: (profile: AtelierProfile) => Promise<AtelierSession[]>
  resume: (profile: AtelierProfile, sessionId: string) => Promise<AtelierTranscript>
  submit: (profile: AtelierProfile, sessionId: string, text: string) => Promise<void>
  createSession: (profile: AtelierProfile, title: string) => Promise<string>
  mainSession: (profile: AtelierProfile) => Promise<null | string>
  /** `projects.tree` for this profile. Empty when the method is missing or returns nothing. */
  listProjects: (profile: AtelierProfile) => Promise<AtelierProject[]>
}

export type AtelierRpc = <T>(profile: AtelierProfile, method: string, params: Record<string, unknown>) => Promise<T>

type Rpc = AtelierRpc

export function hostGateway(): AtelierGateway {
  const gateway = createGateway(requestProfile)

  return {
    ...gateway,
    listProfiles: async () => {
      const result = await host.request<{ profiles?: unknown }>('profiles.list', { include_sessions: true })
      const rows = Array.isArray(result?.profiles) ? result.profiles : []

      return rows.flatMap(row => parseProfile(row))
    }
  }
}

export function createGateway(request: Rpc): AtelierGateway {
  return {
    listProfiles: () => listProfiles(request),
    listSessions: profile => listSessions(request, profile),
    resume: (profile, sessionId) => resume(request, profile, sessionId),
    submit: (profile, sessionId, text) => submit(request, profile, sessionId, text),
    createSession: (profile, title) => createSession(request, profile, title),
    mainSession: async profile => profile.canonicalSessionId || profile.lastSessionId || mostRecent(request, profile),
    listProjects: profile => listProjects(request, profile)
  }
}

async function requestProfile<T>(profile: AtelierProfile, method: string, params: Record<string, unknown>): Promise<T> {
  const body = { ...params, profile: profile.id }

  if (typeof host.requestProfile === 'function') {
    return host.requestProfile<T>(profile.route, method, body, undefined, { spawnPriority: 'foreground' })
  }

  return host.request<T>(method, body)
}

async function listProfiles(request: Rpc): Promise<AtelierProfile[]> {
  const local: AtelierProfile = {
    id: 'default',
    name: 'default',
    route: 'default',
    canonicalSessionId: null,
    lastSessionId: null
  }

  const result = await request<{ profiles?: unknown }>(local, 'profiles.list', { include_sessions: true })
  const rows = Array.isArray(result?.profiles) ? result.profiles : []

  return rows.flatMap(row => parseProfile(row))
}

async function listSessions(request: Rpc, profile: AtelierProfile): Promise<AtelierSession[]> {
  const listed = await request<{ sessions?: unknown }>(profile, 'session.list', { limit: 40 })
  const rows = Array.isArray(listed?.sessions) ? listed.sessions : []
  let live: Set<string> | null = null

  try {
    live = await liveIds(request, profile)
  } catch {
    live = null
  }

  return rows.flatMap(row => parseSession(row, profile.id, live))
}

async function resume(request: Rpc, profile: AtelierProfile, sessionId: string): Promise<AtelierTranscript> {
  const snapshot = await request<Record<string, unknown>>(profile, 'session.resume', { session_id: sessionId })
  const runtimeId = text(snapshot.session_id) || sessionId
  const storedId = text(snapshot.stored_session_id) || sessionId
  let goal: GoalFacts | null = null

  try {
    const control = await request<{ control?: { goal?: unknown } }>(profile, 'session.control.read', {
      session_id: runtimeId
    })

    goal = parseGoal(control?.control?.goal)
  } catch {
    goal = null
  }

  return {
    runtimeId,
    storedId,
    messages: parseMessages(snapshot.messages),
    goal,
    running: snapshot.running === true || snapshot.status === 'working' || snapshot.status === 'streaming',
    sessionHold: maidPresenceHold({
      status: text(snapshot.status),
      pendingApproval: snapshot.pending_approval != null && snapshot.pending_approval !== false
    }),
    workspacePath: workspacePath(snapshot)
  }
}

async function listProjects(request: Rpc, profile: AtelierProfile): Promise<AtelierProject[]> {
  try {
    const result = await request<{ projects?: unknown }>(profile, 'projects.tree', { preview_limit: 20 })

    return parseProjects(result?.projects)
  } catch {
    return []
  }
}

async function submit(request: Rpc, profile: AtelierProfile, sessionId: string, textBody: string): Promise<void> {
  try {
    await request(profile, 'prompt.submit', { session_id: sessionId, text: textBody })
  } catch (error) {
    const resumed = await request<Record<string, unknown>>(profile, 'session.resume', { session_id: sessionId })
    const runtimeId = text(resumed.session_id)

    if (!runtimeId || runtimeId === sessionId) {
      throw error
    }

    await request(profile, 'prompt.submit', { session_id: runtimeId, text: textBody })
  }
}

async function createSession(request: Rpc, profile: AtelierProfile, title: string): Promise<string> {
  const created = await request<Record<string, unknown>>(profile, 'session.create', {
    title,
    source: 'desktop'
  })

  const id = text(created.stored_session_id) || text(created.session_id)

  if (!id) {
    throw new Error('session.create returned no id')
  }

  return id
}

async function mostRecent(request: Rpc, profile: AtelierProfile): Promise<null | string> {
  try {
    const recent = await request<{ session_id?: unknown }>(profile, 'session.most_recent', {})

    return text(recent?.session_id) || null
  } catch {
    return null
  }
}

async function liveIds(request: Rpc, profile: AtelierProfile): Promise<Set<string>> {
  const active = await request<{ sessions?: unknown }>(profile, 'session.active_list', {})
  const rows = Array.isArray(active?.sessions) ? active.sessions : []
  const ids = new Set<string>()

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue
    }

    const record = row as Record<string, unknown>
    const status = text(record.status)

    if (status === 'working' || status === 'streaming' || status === 'starting' || status === 'waiting') {
      const id = text(record.id)

      if (id) {
        ids.add(id)
      }
    }
  }

  return ids
}

function parseProfile(row: unknown): AtelierProfile[] {
  if (!row || typeof row !== 'object') {
    return []
  }

  const record = row as Record<string, unknown>
  const id = text(record.name)

  if (!id) {
    return []
  }

  const display = text(record.display_name) || id
  const canonical = record.canonical_session
  const last = record.last_session

  return [
    {
      id,
      name: display,
      route: id,
      canonicalSessionId: sessionIdOf(canonical, 'resolved_id') || sessionIdOf(canonical, 'id'),
      lastSessionId: sessionIdOf(last, 'id')
    }
  ]
}

function parseSession(row: unknown, profileId: string, live: Set<string> | null): AtelierSession[] {
  if (!row || typeof row !== 'object') {
    return []
  }

  const record = row as Record<string, unknown>
  const id = text(record.id)

  if (!id) {
    return []
  }

  return [
    {
      id,
      title: text(record.title) || 'Session',
      preview: text(record.preview),
      updatedAt: typeof record.started_at === 'number' ? record.started_at : 0,
      busy: live === null ? null : live.has(id),
      profileId,
      cwd: text(record.cwd) || null,
      gitRepoRoot: text(record.git_repo_root) || null,
      gitBranch: text(record.git_branch) || null
    }
  ]
}

function parseProjects(value: unknown): AtelierProject[] {
  if (!Array.isArray(value)) {
    return []
  }

  const projects: AtelierProject[] = []

  for (const row of value) {
    if (!row || typeof row !== 'object') {
      continue
    }

    const record = row as Record<string, unknown>
    const id = text(record.id)
    const label = text(record.label)

    if (!id || !label || record.isNoProject === true) {
      continue
    }

    projects.push({
      id,
      label,
      path: text(record.path) || null,
      sessionIds: projectSessionIds(record)
    })
  }

  return projects
}

function projectSessionIds(record: Record<string, unknown>): string[] {
  const ids = new Set<string>()

  if (Array.isArray(record.sessionIds)) {
    for (const id of record.sessionIds) {
      const value = text(id)

      if (value) {
        ids.add(value)
      }
    }
  }

  if (Array.isArray(record.previewSessions)) {
    for (const row of record.previewSessions) {
      if (!row || typeof row !== 'object') {
        continue
      }

      const id = text((row as Record<string, unknown>).id)

      if (id) {
        ids.add(id)
      }
    }
  }

  return [...ids]
}

function workspacePath(snapshot: Record<string, unknown>): string | null {
  const info = snapshot.info

  if (!info || typeof info !== 'object') {
    return text(snapshot.cwd) || null
  }

  const record = info as Record<string, unknown>
  const project = record.project

  const primary =
    project && typeof project === 'object' ? text((project as Record<string, unknown>).primary_path) : ''

  return primary || text(record.cwd) || text(snapshot.cwd) || null
}

function parseMessages(value: unknown): AtelierMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  const messages: AtelierMessage[] = []

  for (const row of value) {
    if (!row || typeof row !== 'object') {
      continue
    }

    const record = row as Record<string, unknown>
    const role = record.role === 'assistant' || record.role === 'user' ? record.role : null
    const body = text(record.text) || text(record.content)

    if (!role || !body || record.display_kind === 'hidden') {
      continue
    }

    messages.push({ role, name: text(record.name) || (role === 'user' ? 'You' : 'Agent'), text: body })
  }

  return messages
}

function parseGoal(value: unknown): GoalFacts | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const objective = text(record.title)

  if (!objective || record.status === 'cleared') {
    return null
  }

  const status = text(record.status) || undefined
  const note = text(record.last_reason) || text(record.paused_reason) || undefined

  return {
    objective,
    status,
    lastStatusNote: note,
    subgoals: stringList(record.subgoals),
    gates: gateList(record.gates),
    turnsUsed: count(record.turns_used),
    maxTurns: count(record.max_turns)
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap(item => (typeof item === 'string' && item.trim() ? [item.trim()] : [])) : []
}

function gateList(value: unknown): GoalGate[] {
  if (!Array.isArray(value)) {
    return []
  }

  const gates: GoalGate[] = []

  for (const row of value) {
    if (!row || typeof row !== 'object') {
      continue
    }

    const record = row as Record<string, unknown>
    const command = text(record.command)

    if (command) {
      gates.push({ command, exitCode: typeof record.last_exit_code === 'number' ? record.last_exit_code : null })
    }
  }

  return gates
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function sessionIdOf(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return text((value as Record<string, unknown>)[key]) || null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
