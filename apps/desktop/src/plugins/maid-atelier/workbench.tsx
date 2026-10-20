import type { PluginStorage } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import { draftLine, saveStepPlan, sendComposer, sessionTitleFromMessage, toggleStep } from './actions'
import { COPY } from './copy'
import { Desk } from './desk'
import { childStorageKey, type DeskRecords, readDesk, type Workflow, writeDesk } from './desk-store'
import { useAtelierFeeds } from './feeds'
import type { AtelierGateway, AtelierProfile, AtelierSession } from './gateway'
import { type MaidHold, maidManuscript, maidPresenceHold, maidRoom, resolveMaidProgress, roomAgents } from './model'
import { fullWorkspacePath } from './paths'
import { emptyProgressCard, pluginProgressShelf } from './progress-store'
import { Rail } from './rail'
import { Reader } from './reader'
import { accentVars, type PresenceTone } from './theme'

export function AtelierWorkbench(props: {
  gateway: AtelierGateway
  storage: PluginStorage
  gatewayOpen: boolean
  notify: (message: string, kind: 'error' | 'info') => void
}) {
  const shelf = useMemo(() => pluginProgressShelf(props.storage), [props.storage])
  const [records, setRecords] = useState<DeskRecords>(() => readDesk(props.storage))
  const [composer, setComposer] = useState('')
  const [caret, setCaret] = useState(0)
  const [pullOpen, setPullOpen] = useState(false)
  const [editingFace, setEditingFace] = useState<string | null>(null)
  const [listEpoch, setListEpoch] = useState(0)

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
    card,
    setCard,
    readerTitle,
    readerCrumbs,
    readerPath,
    readerBody,
    sessionHolds
  } = useAtelierFeeds({ gateway: props.gateway, gatewayOpen: props.gatewayOpen, shelf, listEpoch })

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
  const sessionTitle = sessions.find(session => session.id === sessionId)?.title ?? ''

  const progress = resolveMaidProgress({
    steps: card?.steps,
    markdown: card?.markdown,
    goal,
    title: sessionId ? sessionTitle : '',
    activeRun: running
  })

  const manuscripts = sessions
    .filter(session => maidManuscript(session.title))
    .map(session => ({ id: session.id, label: session.title }))

  const goalHold = maidPresenceHold({ status: goal?.status })
  const chipHold = goalHold ?? (sessionId ? (sessionHolds[sessionId] ?? null) : null)
  const presenceView = presenceWithHolds(presence, ownerId, sessions, sessionHolds)

  const persist = (next: DeskRecords) => {
    setRecords(next)
    writeDesk(props.storage, next)
  }

  const failStep = () => props.notify(COPY.stepFailed, 'error')

  return (
    <div className="atelier" style={accentVars()}>
      <Rail
        card={card}
        faces={records.faces}
        gatewayOpen={props.gatewayOpen}
        goalHold={goalHold}
        groups={records.groups}
        manuscripts={manuscripts}
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
        onOpenManuscript={setSessionId}
        onOpenWorkflow={workflow => openWorkflow(workflow, setOwnerId, setSessionId, persist, records)}
        onSaveGroup={title => {
          if (!ownerId) {
            return
          }

          persist({
            ...records,
            groups: [...records.groups, { id: workflowId(), title, profileIds: [ownerId] }]
          })
        }}
        onSaveWorkflow={title => {
          if (!ownerId) {
            return
          }

          persist({
            ...records,
            workflows: [...records.workflows, { id: workflowId(), title, memberIds }]
          })
        }}
        onSelectProfile={id => {
          setOwnerId(id)
          setSessionId(null)
        }}
        onSelectSession={setSessionId}
        onToggleMember={id => {
          if (!ownerId || id === ownerId) {
            return
          }

          const next = memberIds.includes(id) ? memberIds.filter(item => item !== id) : [...memberIds, id]
          persist({ ...records, members: { ...records.members, [ownerId]: next } })
        }}
        onToggleStep={index => {
          if (!sessionId || !card) {
            failStep()

            return
          }

          const saved = toggleStep(shelf, sessionId, card, index)
          saved ? setCard(saved) : failStep()
        }}
        ownerId={ownerId}
        presence={presenceView}
        profiles={profiles}
        projects={projects}
        sessionHolds={sessionHolds}
        sessionId={sessionId}
        sessions={sessions}
        workflows={records.workflows}
        youName={COPY.you}
      />
      <Desk
        card={card}
        caret={caret}
        chipHold={chipHold}
        composer={composer}
        editingFace={editingFace}
        faces={records.faces}
        goal={goal}
        goalHold={goalHold}
        memberIds={memberIds}
        messages={messages}
        onAddStep={label => {
          if (!sessionId) {
            failStep()

            return
          }

          const basis = card ?? emptyProgressCard(sessionId)
          const saved = saveStepPlan(shelf, sessionId, basis, [...basis.steps, { step: label, status: 'pending' }])
          saved ? setCard(saved) : failStep()
        }}
        onComposer={(value, nextCaret) => {
          setComposer(value)
          setCaret(nextCaret)
        }}
        onDraft={agent => {
          setComposer(draftLine(composer, agent.name))
          setPullOpen(false)
        }}
        onEditFace={setEditingFace}
        onPickFace={(id, index) => {
          persist({ ...records, faces: { ...records.faces, [id]: index } })
          setEditingFace(null)
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
        onTogglePull={() => setPullOpen(open => !open)}
        onToggleStep={index => {
          if (!sessionId || !card) {
            failStep()

            return
          }

          const saved = toggleStep(shelf, sessionId, card, index)
          saved ? setCard(saved) : failStep()
        }}
        ownerId={owner?.id ?? ''}
        profiles={profiles.map(profile => ({ id: profile.id, name: profile.name }))}
        progress={progress}
        pullOpen={pullOpen}
        room={room}
        sessionId={sessionId}
        youTone={props.gatewayOpen ? 'online' : 'blocked'}
      />
      <Reader
        crumbs={readerCrumbs}
        fullPath={fullWorkspacePath({ path: readerPath, title: readerTitle })}
        markdown={readerBody}
        title={readerTitle}
      />
    </div>
  )
}

function openWorkflow(
  workflow: Workflow,
  setOwnerId: (id: string) => void,
  setSessionId: (id: string | null) => void,
  persist: (next: DeskRecords) => void,
  records: DeskRecords
) {
  const owner = workflow.memberIds[0]

  if (!owner) {
    return
  }

  setOwnerId(owner)
  setSessionId(null)
  persist({ ...records, members: { ...records.members, [owner]: workflow.memberIds.slice(1) } })
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
  sessions: readonly AtelierSession[],
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
