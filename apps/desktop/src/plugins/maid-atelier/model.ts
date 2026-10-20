import { COPY } from './copy'

export type ProgressStatus = 'pending' | 'in_progress' | 'completed'

/** Locked presence holds. Pending approval is not a busy run, and blocked is not pending. */
export type MaidHold = 'pending' | 'blocked'

export type ProgressStep = {
  step: string
  status: ProgressStatus
}

export type ProgressCard = {
  sessionKey: string
  revision: number
  updatedAt: number
  markdown?: string
  steps: ProgressStep[]
}

export type GoalFacts = {
  objective: string
  status?: string
  lastStatusNote?: string
}

export type MentionAgent = {
  id: string
  name: string
}

export type MentionTarget = {
  start: number
  end: number
  query: string
}

export type MentionToken = {
  agent: MentionAgent
  start: number
  end: number
}

export type MentionRoute = {
  agent: MentionAgent
  childKey?: string
}

export type RoomMember = {
  id: string
  name: string
  kind: 'user' | 'agent'
}

export type Room = {
  kind: 'dm' | 'group'
  title: string
  members: RoomMember[]
}

export type ProgressModel = {
  source: 'progress' | 'goal' | 'empty'
  target: string
  tone: 'working' | 'idle' | 'completed' | 'attention'
  completed: number
  total: number
}

const MENTION_BOUNDARY = /[\s([{]/u
const GOAL_ATTENTION = new Set(['blocked', 'paused', 'usage_limited', 'budget_limited', 'waiting'])
const PENDING_APPROVAL = new Set(['pending_approval', 'pending-approval'])

/** Session pending-approval and an exact blocked status. Other goal pauses stay attention. */
export function maidPresenceHold(input: { status?: string | null; pendingApproval?: boolean }): MaidHold | null {
  if (input.pendingApproval) {
    return 'pending'
  }

  const status = input.status?.trim()

  if (!status) {
    return null
  }

  if (PENDING_APPROVAL.has(status)) {
    return 'pending'
  }

  return status === 'blocked' ? 'blocked' : null
}

/** An open work step uses the pending pip. A blocked goal replaces it; a finished step has neither. */
export function openStepTone(status: ProgressStatus, goalHold: MaidHold | null): MaidHold | null {
  if (status === 'completed') {
    return null
  }

  return goalHold === 'blocked' ? 'blocked' : 'pending'
}

export function maidClip(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const chars = [...flat]

  if (chars.length <= max) {
    return flat
  }

  return `${chars
    .slice(0, max - 1)
    .join('')
    .trimEnd()}…`
}

/** Append a pull ask to the composer. Membership is not an argument. */
export function maidPullDraft(current: string, ask: string): string {
  return current.trim() ? `${current.replace(/\s+$/u, '')}\n${ask}` : ask
}

export function pullAsk(name: string): string {
  return COPY.pullAsk(name)
}

/** Completed returns to pending. Pending and in-progress become completed. */
export function maidToggledProgressPlan(steps: readonly ProgressStep[], index: number): ProgressStep[] | null {
  if (!steps[index]) {
    return null
  }

  return steps.map((step, stepIndex) => ({
    step: step.step,
    status: stepIndex === index ? (step.status === 'completed' ? 'pending' : 'completed') : step.status
  }))
}

export function resolveMaidProgress(input: {
  steps?: readonly ProgressStep[] | null
  markdown?: string | null
  goal?: GoalFacts | null
  activeRun?: boolean
}): ProgressModel {
  const steps = (input.steps ?? []).filter(step => step.step.trim().length > 0)

  if (steps.length > 0) {
    return progressFromSteps(steps, input.activeRun === true)
  }

  const markdown = input.markdown ? markdownTarget(input.markdown) : ''

  if (markdown) {
    return {
      source: 'progress',
      target: markdown,
      tone: input.activeRun ? 'working' : 'idle',
      completed: 0,
      total: 0
    }
  }

  return progressFromGoal(input.goal, input.activeRun === true)
}

export function findMaidMentionTarget(value: string, caret: number): MentionTarget | null {
  if (value.trimStart().startsWith('/')) {
    return null
  }

  if (inCode(value, caret)) {
    return null
  }

  const beforeCaret = value.slice(0, caret)
  const match = /(?:^|[\s([{])@(?! )([\p{L}\p{N}\p{M}_. -]{0,128})$/u.exec(beforeCaret)

  if (!match) {
    return null
  }

  const query = match[1] ?? ''
  const start = caret - query.length - 1
  let end = caret

  while (end < value.length && /[\p{L}\p{N}\p{M}_.-]/u.test(value[end] ?? '')) {
    end += 1
  }

  return { start, end, query }
}

/** Empty query lists the room. A trailing space closes the picker. */
export function maidMentionChoices(agents: readonly MentionAgent[], query: string): MentionAgent[] {
  const needle = query.toLowerCase()

  if (needle.endsWith(' ')) {
    return []
  }

  return agents.filter(agent => agent.name.toLowerCase().startsWith(needle))
}

export function applyMaidMention(
  value: string,
  target: Pick<MentionTarget, 'start' | 'end'>,
  agent: Pick<MentionAgent, 'name'>
): { value: string; caret: number } {
  const boundary = value[target.end]
  const spacer = boundary === ' ' || boundary === '\n' ? '' : ' '
  const replacement = `@${agent.name}${spacer}`

  return {
    value: `${value.slice(0, target.start)}${replacement}${value.slice(target.end)}`,
    caret: target.start + replacement.length + (spacer === '' && boundary === ' ' ? 1 : 0)
  }
}

/** Longest name wins, so @Anna is not also @Ann. */
export function maidMentionTokens(value: string, agents: readonly MentionAgent[]): MentionToken[] {
  const ranked = agents
    .map((agent, order) => ({ agent, order }))
    .filter(entry => entry.agent.name.trim())
    .sort((left, right) => right.agent.name.length - left.agent.name.length || left.order - right.order)

  const tokens: MentionToken[] = []
  let index = 0

  while (index < value.length) {
    const boundary = index === 0 || MENTION_BOUNDARY.test(value[index - 1] ?? '')

    if (value[index] === '@' && boundary && !inCode(value, index)) {
      const match = tokenAt(value.slice(index + 1), ranked)

      if (match) {
        const end = index + 1 + match.agent.name.length
        tokens.push({ agent: match.agent, start: index, end })
        index = end

        continue
      }
    }

    index += 1
  }

  return tokens
}

/** First @ that names another agent already in the room. Slash commands stay text. */
export function resolveMaidMentionRoute(input: {
  message: string
  agents: readonly MentionAgent[]
  currentAgentId: string
  childKeys?: Readonly<Record<string, string>>
}): MentionRoute | null {
  if (input.message.trimStart().startsWith('/')) {
    return null
  }

  const token = maidMentionTokens(input.message, input.agents)[0]

  if (!token || sameId(token.agent.id, input.currentAgentId)) {
    return null
  }

  const childKey = input.childKeys?.[token.agent.id]

  return childKey ? { agent: token.agent, childKey } : { agent: token.agent }
}

export function maidRoom(input: {
  ownerId: string
  ownerName: string
  userName: string
  title: string
  memberIds: readonly string[]
  names: Readonly<Record<string, string>>
}): Room {
  const members: RoomMember[] = [
    { id: 'user', name: input.userName || COPY.you, kind: 'user' },
    { id: input.ownerId, name: input.ownerName, kind: 'agent' }
  ]

  const seen = new Set([input.ownerId.toLowerCase()])

  for (const id of input.memberIds) {
    const key = id.toLowerCase()

    if (!id || seen.has(key)) {
      continue
    }

    seen.add(key)
    members.push({ id, name: input.names[id] || id, kind: 'agent' })
  }

  const grouped = members.filter(member => member.kind === 'agent').length > 1

  return {
    kind: grouped ? 'group' : 'dm',
    title: grouped ? input.title || input.ownerName : input.ownerName,
    members
  }
}

export function roomAgents(room: Room, ownerId: string): MentionAgent[] {
  if (room.kind !== 'group') {
    return []
  }

  return room.members.flatMap(member =>
    member.kind === 'agent' && !sameId(member.id, ownerId) ? [{ id: member.id, name: member.name }] : []
  )
}

export function draftCandidates(
  profiles: readonly MentionAgent[],
  memberIds: readonly string[],
  ownerId: string
): MentionAgent[] {
  const present = new Set([ownerId.toLowerCase(), ...memberIds.map(id => id.toLowerCase())])

  return profiles.filter(profile => profile.id && !present.has(profile.id.toLowerCase()))
}

function progressFromSteps(steps: ProgressStep[], activeRun: boolean): ProgressModel {
  const completed = steps.filter(step => step.status === 'completed').length

  const current =
    steps.find(step => step.status === 'in_progress') ??
    steps.find(step => step.status === 'pending') ??
    steps[steps.length - 1]

  const allDone = completed === steps.length
  const working = steps.some(step => step.status === 'in_progress') || activeRun

  return {
    source: 'progress',
    target: maidClip(current?.step ?? '', 80),
    tone: allDone ? 'completed' : working ? 'working' : 'idle',
    completed,
    total: steps.length
  }
}

/** A session title is not a goal. Only `session.control.read` supplies one. */
function progressFromGoal(goal: GoalFacts | null | undefined, activeRun: boolean): ProgressModel {
  if (goal?.objective.trim()) {
    const done = goal.status === 'complete' || goal.status === 'done'
    const attention = goal.status ? GOAL_ATTENTION.has(goal.status) : false

    return {
      source: 'goal',
      target: maidClip(goal.lastStatusNote || goal.objective, 80),
      tone: done ? 'completed' : attention ? 'attention' : goal.status === 'active' || activeRun ? 'working' : 'idle',
      completed: 0,
      total: 0
    }
  }

  return { source: 'empty', target: '', tone: 'idle', completed: 0, total: 0 }
}

function markdownTarget(markdown: string): string {
  for (const raw of markdown.split('\n')) {
    const line = raw
      .replace(/^[#>*\-\d.)\s]+/u, '')
      .replace(/`/gu, '')
      .trim()

    if (line) {
      return maidClip(line, 80)
    }
  }

  return ''
}

function inCode(value: string, index: number): boolean {
  if ((value.slice(0, index).match(/```/gu)?.length ?? 0) % 2 === 1) {
    return true
  }

  const lineStart = value.lastIndexOf('\n', index - 1) + 1

  return (value.slice(lineStart, index).match(/`/gu)?.length ?? 0) % 2 === 1
}

function tokenAt(rest: string, ranked: readonly { agent: MentionAgent }[]): { agent: MentionAgent } | undefined {
  return ranked.find(entry => {
    if (!rest.toLowerCase().startsWith(entry.agent.name.toLowerCase())) {
      return false
    }

    const after = rest[entry.agent.name.length]

    return after === undefined || !/[\p{L}\p{N}\p{M}_.-]/u.test(after)
  })
}

function sameId(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}
