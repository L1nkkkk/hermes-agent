import { host, type PluginStorage, useValue } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import { sendComposer, sessionTitleFromMessage } from './actions'
import { COPY } from './copy'
import { Desk } from './desk'
import { childStorageKey, type DeskRecords, readDesk, writeDesk } from './desk-store'
import { useAtelierFeeds } from './feeds'
import type { AtelierGateway, AtelierProfile } from './gateway'
import { type MaidHold, maidPresenceHold, maidRoom, resolveMaidProgress, roomAgents } from './model'
import { pathTail } from './paths'
import { Rail } from './rail'
import { Reader } from './reader'
import { accentVars, type PresenceTone } from './theme'

export function AtelierWorkbench(props: {
  gateway: AtelierGateway
  storage: PluginStorage
  gatewayOpen: boolean
  notify: (message: string, kind: 'error' | 'info') => void
}) {
  const [records, setRecords] = useState<DeskRecords>(() => readDesk(props.storage))
  const [composer, setComposer] = useState('')
  const [caret, setCaret] = useState(0)
  const [listEpoch, setListEpoch] = useState(0)
  const [focusKey, setFocusKey] = useState(0)
  const hostCwd = useValue(host.state.cwd).trim()
  const connectionId = useValue(host.state.connectionId)
  const hostProfile = useValue(host.state.profile)

  const {
    profiles,
    projects,
    sessions,
    presence,
    owner,
    ownerId,
    setOwnerId,
    sessionId,
    setSessionId,
    messages,
    setMessages,
    goal,
    running,
    workspacePath,
    sessionHolds
  } = useAtelierFeeds({
    gateway: props.gateway,
    gatewayOpen: props.gatewayOpen,
    listEpoch,
    onResumeFailed: () => props.notify(COPY.resumeFailed, 'error')
  })

  const memberIds = ownerId ? (records.members[ownerId] ?? []) : []
  const names = Object.fromEntries(profiles.map(profile => [profile.id, profile.name]))

  const room = maidRoom({
    ownerId: owner?.id ?? 'atelier',
    ownerName: owner?.name ?? COPY.nav,
    userName: COPY.you,
    title: sessions.find(session => session.id === sessionId)?.title || owner?.name || COPY.nav,
    memberIds,
    names
  })

  const roomId = sessionId || ownerId || 'atelier'
  const childKeys = childKeysFor(records.children, roomId)
  const listed = sessions.find(session => session.id === sessionId)
  const sessionRoot = sessionId ? workspacePath || listed?.gitRepoRoot || listed?.cwd || null : null

  const progress = resolveMaidProgress({
    goal,
    activeRun: running
  })

  const goalHold = maidPresenceHold({ status: goal?.status })
  const chipHold = goalHold ?? (sessionId ? (sessionHolds[sessionId] ?? null) : null)
  const presenceView = presenceWithHolds(presence, ownerId, sessions, sessionHolds)

  const scope = useMemo(
    () => ({ connectionId, profile: owner?.id || hostProfile || null }),
    [connectionId, hostProfile, owner?.id]
  )

  const persist = (next: DeskRecords) => {
    setRecords(next)
    writeDesk(props.storage, next)
  }

  return (
    <div className="atelier" style={accentVars()}>
      <Rail
        faces={records.faces}
        gatewayOpen={props.gatewayOpen}
        groups={records.groups}
        memberIds={memberIds}
        onAssignGroup={(profileId, groupId) => {
          persist({
            ...records,
            groups: records.groups.map(group => ({
              ...group,
              profileIds:
                group.id === groupId
                  ? uniqueIds([...group.profileIds, profileId])
                  : group.profileIds.filter(id => id !== profileId)
            }))
          })
        }}
        onCreateSession={() => {
          if (!owner) {
            return
          }

          void props.gateway
            .createSession(owner, COPY.newSession)
            .then(id => {
              setSessionId(id)
              setListEpoch(epoch => epoch + 1)
            })
            .catch(() => props.notify(COPY.sessionFailed, 'error'))
        }}
        onSaveGroup={title => {
          if (!ownerId) {
            return
          }

          persist({
            ...records,
            groups: [...records.groups, { id: workflowId(), title, profileIds: [ownerId] }]
          })
        }}
        onSelectProfile={id => {
          setOwnerId(id)
          setSessionId(null)
        }}
        onSelectSession={setSessionId}
        onFocusComposer={() => setFocusKey(key => key + 1)}
        onOpenChat={() => host.navigate(sessionId ? `/${encodeURIComponent(sessionId)}` : '/')}
        onOpenService={() => host.navigate('/settings')}
        onToggleMember={id => {
          if (!ownerId || id === ownerId) {
            return
          }

          const next = memberIds.includes(id) ? memberIds.filter(item => item !== id) : [...memberIds, id]
          persist({ ...records, members: { ...records.members, [ownerId]: next } })
        }}
        ownerId={ownerId}
        presence={presenceView}
        profiles={profiles}
        projects={projects}
        sessionHolds={sessionHolds}
        sessionId={sessionId}
        sessions={sessions}
        youName={COPY.you}
      />
      <Desk
        caret={caret}
        chipHold={chipHold}
        composer={composer}
        faces={records.faces}
        focusKey={focusKey}
        goal={goal}
        memberIds={memberIds}
        messages={messages}
        onComposer={(value, nextCaret) => {
          setComposer(value)
          setCaret(nextCaret)
        }}
        onSend={() => {
          void sendCurrent({
            composer,
            sessionId,
            gatewayOpen: props.gatewayOpen,
            room,
            owner,
            childKeys,
            profiles,
            gateway: props.gateway,
            notify: props.notify,
            rememberChild: (agentId, created) => {
              persist({
                ...records,
                children: { ...records.children, [childStorageKey(roomId, agentId)]: created }
              })
            },
            adoptSession: created => {
              setSessionId(created)
              setListEpoch(epoch => epoch + 1)
            },
            clear: () => setComposer(''),
            echo: text => setMessages(current => [...current, { role: 'user', name: COPY.you, text }])
          })
        }}
        ownerId={owner?.id ?? ''}
        profiles={profiles.map(profile => ({ id: profile.id, name: profile.name }))}
        progress={progress}
        room={room}
        sessionId={sessionId}
        workspaceTail={workspaceTailOf(sessionRoot)}
        youTone={props.gatewayOpen ? 'online' : 'blocked'}
      />
      <Reader root={sessionId ? sessionRoot : hostCwd || null} scope={scope} />
    </div>
  )
}

/** Two-segment workspace tail for the desk header; empty when no session root. */
function workspaceTailOf(root: string | null): string {
  return root ? pathTail(root, 2).join('/') : ''
}

function childKeysFor(children: Record<string, string>, roomId: string): Record<string, string> {
  const prefix = `${roomId}:`
  const keys: Record<string, string> = {}

  for (const [key, value] of Object.entries(children)) {
    if (key.startsWith(prefix)) {
      keys[key.slice(prefix.length)] = value
    }
  }

  return keys
}

function presenceWithHolds(
  presence: Readonly<Record<string, PresenceTone>>,
  ownerId: string | null,
  sessions: readonly { id: string }[],
  holds: Readonly<Record<string, MaidHold>>
): Record<string, PresenceTone> {
  if (!ownerId) {
    return { ...presence }
  }

  const tones = sessions.map(session => holds[session.id]).filter(tone => tone !== undefined)
  const hold = tones.includes('blocked') ? 'blocked' : tones.includes('pending') ? 'pending' : null

  return hold ? { ...presence, [ownerId]: hold } : { ...presence }
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []

  for (const id of ids) {
    const key = id.toLowerCase()

    if (!id || seen.has(key)) {
      continue
    }

    seen.add(key)
    next.push(id)
  }

  return next
}

function workflowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `wf-${Date.now()}`
}

async function sendCurrent(input: {
  composer: string
  sessionId: string | null
  gatewayOpen: boolean
  room: ReturnType<typeof maidRoom>
  owner: AtelierProfile | null
  childKeys: Record<string, string>
  profiles: readonly AtelierProfile[]
  gateway: AtelierGateway
  notify: (message: string, kind: 'error' | 'info') => void
  rememberChild: (agentId: string, sessionId: string) => void
  adoptSession: (sessionId: string) => void
  clear: () => void
  echo: (text: string) => void
}) {
  const text = input.composer

  const result = await sendComposer(text, input.sessionId, {
    gatewayOpen: input.gatewayOpen,
    roomKind: input.room.kind,
    owner: input.owner,
    agents: roomAgents(input.room, input.owner?.id ?? ''),
    childKeys: input.childKeys,
    profiles: input.profiles,
    roomTitle: input.room.title,
    gateway: input.gateway,
    rememberChild: input.rememberChild,
    ensureSession: async () => {
      if (!input.owner) {
        return null
      }

      const created = await input.gateway.createSession(input.owner, sessionTitleFromMessage(input.composer))
      input.adoptSession(created)

      return created
    }
  })

  if (result.kind === 'mention') {
    input.clear()
    input.notify(result.outcome === 'main' ? COPY.mentionSentMain(result.name) : COPY.mentionSent(result.name), 'info')

    return
  }

  if (result.kind === 'room') {
    input.echo(text.trim())
    input.clear()

    return
  }

  if (result.kind === 'offline') {
    input.notify(COPY.mentionOffline(result.name), 'error')

    return
  }

  if (result.kind === 'failed') {
    input.notify(COPY.mentionFailed(result.name), 'error')

    return
  }

  if (result.kind === 'room-failed') {
    input.notify(COPY.mentionFailed(input.owner?.name ?? COPY.nav), 'error')
  }
}
