import { COPY } from './copy'
import type { AtelierGateway, AtelierProfile } from './gateway'
import { type MentionAgent, resolveMaidMentionRoute } from './model'
import { dispatchMaidMentionTurn, type MentionOutcome } from './routing'

export type SendResult =
  | { kind: 'empty' }
  | { kind: 'failed'; name: string }
  | { kind: 'mention'; name: string; outcome: MentionOutcome }
  | { kind: 'offline'; name: string }
  | { kind: 'room' }
  | { kind: 'room-failed' }

export async function sendComposer(
  message: string,
  sessionId: null | string,
  input: {
    gatewayOpen: boolean
    roomKind: 'dm' | 'group'
    owner: AtelierProfile | null
    agents: readonly MentionAgent[]
    childKeys: Readonly<Record<string, string>>
    profiles: readonly AtelierProfile[]
    roomTitle: string
    gateway: AtelierGateway
    rememberChild: (agentId: string, sessionId: string) => void
    /** Mints a real `session.create` row when the desk has nowhere to send. */
    ensureSession?: () => Promise<null | string>
  }
): Promise<SendResult> {
  const text = message.trim()

  if (!text) {
    return { kind: 'empty' }
  }

  const route =
    input.roomKind === 'group' && input.owner
      ? resolveMaidMentionRoute({
          message: text,
          agents: input.agents,
          currentAgentId: input.owner.id,
          childKeys: input.childKeys
        })
      : null

  if (route) {
    return sendMention(text, route.agent, route.childKey, input)
  }

  if (!input.owner) {
    return { kind: 'room-failed' }
  }

  if (!input.gatewayOpen) {
    return { kind: 'offline', name: input.owner.name }
  }

  let roomSession = sessionId

  if (!roomSession && input.ensureSession) {
    try {
      roomSession = await input.ensureSession()
    } catch {
      return { kind: 'room-failed' }
    }
  }

  if (!roomSession) {
    return { kind: 'room-failed' }
  }

  try {
    await input.gateway.submit(input.owner, roomSession, text)

    return { kind: 'room' }
  } catch {
    return { kind: 'room-failed' }
  }
}

/** First line of the composer, capped, used as the `session.create` title. */
export function sessionTitleFromMessage(text: string): string {
  const line = text.trim().split(/\r?\n/u)[0]?.replace(/\s+/gu, ' ').trim() ?? ''

  if (!line) {
    return COPY.newSession
  }

  return line.length > 48 ? `${line.slice(0, 47)}…` : line
}

async function sendMention(
  message: string,
  agent: MentionAgent,
  childKey: string | undefined,
  input: {
    gatewayOpen: boolean
    profiles: readonly AtelierProfile[]
    roomTitle: string
    gateway: AtelierGateway
    rememberChild: (agentId: string, sessionId: string) => void
  }
): Promise<SendResult> {
  const profile = input.profiles.find(item => item.id.toLowerCase() === agent.id.toLowerCase())

  if (!input.gatewayOpen || !profile) {
    return { kind: 'offline', name: agent.name }
  }

  try {
    const outcome = await dispatchMaidMentionTurn({
      route: { agent, ...(childKey ? { childKey } : {}) },
      message,
      roomTitle: input.roomTitle,
      dispatch: {
        submit: (agentId, sessionId, text) => {
          const target = input.profiles.find(item => item.id.toLowerCase() === agentId.toLowerCase())

          if (!target) {
            throw new Error('missing profile')
          }

          return input.gateway.submit(target, sessionId, text)
        },
        createChild: async (agentId, title) => {
          const target = input.profiles.find(item => item.id.toLowerCase() === agentId.toLowerCase())

          if (!target) {
            throw new Error('missing profile')
          }

          const created = await input.gateway.createSession(target, title || `Atelier · ${agent.name}`)
          input.rememberChild(agentId, created)

          return created
        },
        mainSession: agentId => {
          const target = input.profiles.find(item => item.id.toLowerCase() === agentId.toLowerCase())

          return target ? input.gateway.mainSession(target) : Promise.resolve(null)
        }
      }
    })

    return { kind: 'mention', name: agent.name, outcome }
  } catch {
    return { kind: 'failed', name: agent.name }
  }
}
