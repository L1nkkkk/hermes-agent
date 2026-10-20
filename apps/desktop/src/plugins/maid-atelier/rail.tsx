import { type ReactNode, useState } from 'react'

import { COPY } from './copy'
import type { MaidGroup, Workflow } from './desk-store'
import type { AtelierProfile, AtelierProject, AtelierSession } from './gateway'
import { type MaidHold, maidManuscript, type ProgressCard } from './model'
import { groupSessions, type SessionBucket } from './paths'
import { portraitSrc } from './portraits'
import { Presence, StepPresence } from './presence'
import type { PresenceTone } from './theme'

const LOUD: ReadonlySet<PresenceTone> = new Set(['busy', 'pending', 'blocked', 'attention'])

const TONE_LABEL: Record<PresenceTone, string> = {
  pending: COPY.pending,
  blocked: COPY.blocked,
  busy: COPY.busy,
  idle: COPY.idle,
  online: COPY.online,
  attention: COPY.attention,
  unknown: COPY.unknown
}

export function Rail(props: {
  profiles: readonly AtelierProfile[]
  sessions: readonly AtelierSession[]
  workflows: readonly Workflow[]
  ownerId: string | null
  sessionId: string | null
  memberIds: readonly string[]
  presence: Readonly<Record<string, PresenceTone>>
  gatewayOpen: boolean
  youName: string
  faces: Readonly<Record<string, number>>
  groups: readonly MaidGroup[]
  projects: readonly AtelierProject[]
  card: ProgressCard | null
  goalHold: MaidHold | null
  sessionHolds: Readonly<Record<string, MaidHold>>
  onSelectProfile: (id: string) => void
  onToggleMember: (id: string) => void
  onSelectSession: (id: string) => void
  onOpenWorkflow: (workflow: Workflow) => void
  onSaveWorkflow: (title: string) => void
  onSaveGroup: (title: string) => void
  onAssignGroup: (profileId: string, groupId: string | null) => void
  onToggleStep: (index: number) => void
  manuscripts: readonly { id: string; label: string }[]
  onOpenManuscript: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [closed, setClosed] = useState<Readonly<Record<string, boolean>>>({})
  const groupedIds = new Set(props.groups.flatMap(group => group.profileIds.map(id => id.toLowerCase())))

  const loose = props.profiles.filter(
    profile => !groupedIds.has(profile.id.toLowerCase()) && profileShown(profile, props.sessions, props.ownerId, query)
  )

  const fold = (id: string, expanded: boolean) => setClosed(current => ({ ...current, [id]: expanded }))

  const branch: Omit<BranchProps, 'profile'> = {
    closed,
    faces: props.faces,
    groups: props.groups,
    memberIds: props.memberIds,
    onAssignGroup: props.onAssignGroup,
    onFold: fold,
    onSelectProfile: props.onSelectProfile,
    onSelectSession: props.onSelectSession,
    onToggleMember: props.onToggleMember,
    ownerId: props.ownerId,
    presence: props.presence,
    projects: props.projects,
    query,
    sessionHolds: props.sessionHolds,
    sessionId: props.sessionId,
    sessions: props.sessions
  }

  return (
    <aside className="atelier-pane atelier-rail" data-atelier-pane="left">
      <label className="atelier-search">
        <SearchMark />
        <input
          aria-label={COPY.search}
          onChange={event => setQuery(event.target.value)}
          placeholder={COPY.search}
          type="search"
          value={query}
        />
      </label>
      <div className="atelier-rail__scroll">
        <Section title={COPY.groups}>
          {props.groups.map(group => (
            <GroupBranch
              branch={branch}
              closed={closed}
              group={group}
              key={group.id}
              onFold={fold}
              profiles={props.profiles}
              query={query}
            />
          ))}
          <GroupSave onSave={props.onSaveGroup} />
        </Section>
        <Section title={COPY.maids}>
          {loose.length === 0 && props.profiles.length === 0 ? (
            <Empty>{props.gatewayOpen ? COPY.noSessions : COPY.gatewayDown}</Empty>
          ) : null}
          {loose.map(profile => (
            <ProfileBranch key={profile.id} profile={profile} {...branch} />
          ))}
        </Section>
        <Section title={COPY.workQueue}>
          <WorkSteps
            card={props.card}
            goalHold={props.goalHold}
            manuscripts={props.manuscripts}
            onOpenManuscript={props.onOpenManuscript}
            onToggleStep={props.onToggleStep}
          />
        </Section>
        <Section title={COPY.workflows}>
          {props.workflows.length === 0 ? <Empty>{COPY.noWorkflows}</Empty> : null}
          {props.workflows.map(workflow => (
            <button
              className="atelier-session"
              key={workflow.id}
              onClick={() => props.onOpenWorkflow(workflow)}
              type="button"
            >
              <span className="atelier-row__name">{workflow.title}</span>
            </button>
          ))}
          <WorkflowSave onSave={props.onSaveWorkflow} />
        </Section>
      </div>
      <header className="atelier-you">
        <Face faces={props.faces} id="user" name={props.youName} tone={props.gatewayOpen ? 'online' : 'unknown'} />
        <div>
          <div className="atelier-you__name">{props.youName}</div>
          <div className="atelier-you__status">
            <span>{props.gatewayOpen ? COPY.online : COPY.offline}</span>
          </div>
        </div>
      </header>
    </aside>
  )
}

type BranchProps = {
  profile: AtelierProfile
  query: string
  closed: Readonly<Record<string, boolean>>
  onFold: (id: string, expanded: boolean) => void
  sessions: readonly AtelierSession[]
  ownerId: string | null
  sessionId: string | null
  memberIds: readonly string[]
  presence: Readonly<Record<string, PresenceTone>>
  faces: Readonly<Record<string, number>>
  projects: readonly AtelierProject[]
  groups: readonly MaidGroup[]
  sessionHolds: Readonly<Record<string, MaidHold>>
  onSelectProfile: (id: string) => void
  onToggleMember: (id: string) => void
  onSelectSession: (id: string) => void
  onAssignGroup: (profileId: string, groupId: string | null) => void
}

function GroupBranch(props: {
  group: MaidGroup
  profiles: readonly AtelierProfile[]
  query: string
  closed: Readonly<Record<string, boolean>>
  onFold: (id: string, expanded: boolean) => void
  branch: Omit<BranchProps, 'profile'>
}) {
  const members = groupMembers(props.group, props.profiles, props.branch.sessions, props.branch.ownerId, props.query)
  const needle = props.query.trim().toLowerCase()

  if (needle && members.length === 0 && !props.group.title.toLowerCase().includes(needle)) {
    return null
  }

  const expanded = props.closed[props.group.id] !== true && (members.length > 0 || !needle)

  return (
    <div className="atelier-branch" data-atelier-group={props.group.id}>
      <div className="atelier-row">
        <Twist expanded={expanded} label={props.group.title} onToggle={() => props.onFold(props.group.id, expanded)} />
        <span className="atelier-row__name">{props.group.title}</span>
        <span className="atelier-row__age">{members.length}</span>
      </div>
      {expanded ? members.map(profile => <ProfileBranch key={profile.id} profile={profile} {...props.branch} />) : null}
    </div>
  )
}

function ProfileBranch(props: BranchProps) {
  const selected = props.profile.id === props.ownerId
  const sessions = shownSessions(props.profile, props.sessions, props.ownerId, props.query)
  const grouped = groupSessions(sessions, selected ? props.projects : [])
  const expanded = props.closed[props.profile.id] !== true
  const assigned = assignedGroup(props.groups, props.profile.id)

  return (
    <div className="atelier-branch" data-atelier-profile={props.profile.id}>
      <div className="atelier-row" data-selected={selected ? 'true' : 'false'}>
        {selected && sessions.length > 0 ? (
          <Twist
            expanded={expanded}
            label={props.profile.name}
            onToggle={() => props.onFold(props.profile.id, expanded)}
          />
        ) : (
          <span aria-hidden="true" className="atelier-gutter" />
        )}
        <button className="atelier-row__main" onClick={() => props.onSelectProfile(props.profile.id)} type="button">
          <Face
            faces={props.faces}
            id={props.profile.id}
            name={props.profile.name}
            tone={props.presence[props.profile.id] ?? 'unknown'}
          />
          <span className="atelier-row__name">{props.profile.name}</span>
          {selected && props.sessions.length > 0 ? (
            <span className="atelier-row__age">{props.sessions.length}</span>
          ) : null}
        </button>
        {selected && props.groups.length > 0 ? (
          <select
            aria-label={COPY.groupFor(props.profile.name)}
            className="atelier-group-pick"
            onChange={event => props.onAssignGroup(props.profile.id, event.target.value || null)}
            value={assigned}
          >
            <option value="">{COPY.noGroup}</option>
            {props.groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))}
          </select>
        ) : null}
        <label className="atelier-member">
          <input
            aria-label={`${COPY.inRoom} ${props.profile.name}`}
            checked={props.profile.id === props.ownerId || props.memberIds.includes(props.profile.id)}
            disabled={props.profile.id === props.ownerId}
            onChange={() => props.onToggleMember(props.profile.id)}
            type="checkbox"
          />
        </label>
      </div>
      {selected && expanded ? (
        <SessionTree
          grouped={grouped}
          onFold={props.onFold}
          onSelectSession={props.onSelectSession}
          projectsClosed={props.closed}
          sessionHolds={props.sessionHolds}
          sessionId={props.sessionId}
          sessions={sessions}
        />
      ) : null}
    </div>
  )
}

function SessionTree(props: {
  sessions: readonly AtelierSession[]
  grouped: { buckets: SessionBucket[]; loose: AtelierSession[] }
  projectsClosed: Readonly<Record<string, boolean>>
  onFold: (id: string, expanded: boolean) => void
  sessionId: string | null
  sessionHolds: Readonly<Record<string, MaidHold>>
  onSelectSession: (id: string) => void
}) {
  return (
    <div aria-label={COPY.sessions} className="atelier-tree">
      {props.sessions.length === 0 ? <Empty>{COPY.noSessions}</Empty> : null}
      {props.grouped.buckets.map(bucket => (
        <ProjectNode
          bucket={bucket}
          expanded={props.projectsClosed[bucket.id] !== true}
          key={bucket.id}
          onFold={() => props.onFold(bucket.id, props.projectsClosed[bucket.id] !== true)}
          onSelectSession={props.onSelectSession}
          sessionHolds={props.sessionHolds}
          sessionId={props.sessionId}
        />
      ))}
      {props.grouped.loose.map(session => (
        <SessionRow
          hold={props.sessionHolds[session.id]}
          key={session.id}
          onSelect={() => props.onSelectSession(session.id)}
          selected={session.id === props.sessionId}
          session={session}
        />
      ))}
    </div>
  )
}

function ProjectNode(props: {
  bucket: SessionBucket
  expanded: boolean
  onFold: () => void
  sessionId: string | null
  sessionHolds: Readonly<Record<string, MaidHold>>
  onSelectSession: (id: string) => void
}) {
  return (
    <div className="atelier-project" data-atelier-project={props.bucket.label}>
      <div className="atelier-row">
        <Twist expanded={props.expanded} label={props.bucket.label} onToggle={props.onFold} />
        <span className="atelier-row__name">{props.bucket.label}</span>
        <span className="atelier-row__age">{props.bucket.sessions.length}</span>
      </div>
      {props.expanded
        ? props.bucket.sessions.map(session => (
            <SessionRow
              hold={props.sessionHolds[session.id]}
              key={session.id}
              onSelect={() => props.onSelectSession(session.id)}
              selected={session.id === props.sessionId}
              session={session}
            />
          ))
        : null}
    </div>
  )
}

function SessionRow(props: {
  session: AtelierSession
  selected: boolean
  hold: MaidHold | undefined
  onSelect: () => void
}) {
  const tone = props.hold ?? sessionTone(props.session.busy)
  const age = sessionAge(props.session.updatedAt)

  return (
    <button
      className="atelier-session"
      data-selected={props.selected ? 'true' : 'false'}
      onClick={props.onSelect}
      type="button"
    >
      <Presence tone={tone} />
      <span className="atelier-row__name">{props.session.title}</span>
      {LOUD.has(tone) ? <span className="atelier-row__meta">{TONE_LABEL[tone]}</span> : null}
      {age ? <span className="atelier-row__age">{age}</span> : null}
    </button>
  )
}

function Twist(props: { expanded: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      aria-expanded={props.expanded}
      aria-label={props.expanded ? COPY.collapse(props.label) : COPY.expand(props.label)}
      className="atelier-twist"
      data-open={props.expanded ? 'true' : 'false'}
      onClick={props.onToggle}
      type="button"
    />
  )
}

function GroupSave(props: { onSave: (title: string) => void }) {
  return (
    <form
      className="atelier-workflow-save"
      onSubmit={event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const title = String(data.get('title') || '').trim()

        if (title) {
          props.onSave(title)
          event.currentTarget.reset()
        }
      }}
    >
      <input aria-label={COPY.groupName} name="title" placeholder={COPY.groupName} />
      <button type="submit">{COPY.newGroup}</button>
    </form>
  )
}

function groupMembers(
  group: MaidGroup,
  profiles: readonly AtelierProfile[],
  sessions: readonly AtelierSession[],
  ownerId: string | null,
  query: string
): AtelierProfile[] {
  const ids = new Set(group.profileIds.map(id => id.toLowerCase()))

  return profiles.filter(
    profile => ids.has(profile.id.toLowerCase()) && profileShown(profile, sessions, ownerId, query)
  )
}

function assignedGroup(groups: readonly MaidGroup[], profileId: string): string {
  const key = profileId.toLowerCase()

  return groups.find(group => group.profileIds.some(id => id.toLowerCase() === key))?.id ?? ''
}

function profileShown(
  profile: { id: string; name: string },
  sessions: readonly AtelierSession[],
  ownerId: string | null,
  query: string
): boolean {
  const needle = query.trim().toLowerCase()

  if (!needle) {
    return true
  }

  if (profile.name.toLowerCase().includes(needle)) {
    return true
  }

  if (profile.id !== ownerId) {
    return false
  }

  return sessions.some(session => session.title.toLowerCase().includes(needle))
}

function shownSessions(
  profile: { id: string; name: string },
  sessions: readonly AtelierSession[],
  ownerId: string | null,
  query: string
): readonly AtelierSession[] {
  if (profile.id !== ownerId) {
    return []
  }

  const needle = query.trim().toLowerCase()

  if (!needle || profile.name.toLowerCase().includes(needle)) {
    return sessions
  }

  return sessions.filter(session => session.title.toLowerCase().includes(needle))
}

function sessionAge(updatedAt: number, now = Date.now()): string {
  const ms = updatedAt > 1e12 ? updatedAt : updatedAt > 1e9 ? updatedAt * 1000 : 0

  if (!ms) {
    return ''
  }

  const delta = now - ms

  if (delta < 0 || delta < 45_000) {
    return delta < 0 ? '' : 'now'
  }

  const minutes = Math.floor(delta / 60_000)

  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 36) {
    return `${hours}h`
  }

  return `${Math.floor(hours / 24)}d`
}

function WorkSteps(props: {
  card: ProgressCard | null
  goalHold: MaidHold | null
  manuscripts: readonly { id: string; label: string }[]
  onOpenManuscript: (id: string) => void
  onToggleStep: (index: number) => void
}) {
  const steps = props.card?.steps.filter(step => step.step.trim()) ?? []

  if (steps.length === 0 && props.manuscripts.length === 0) {
    return <Empty>{COPY.noChecklist}</Empty>
  }

  return (
    <ul className="atelier-steps">
      {steps.map((step, index) => (
        <li key={`${index}:${step.step}`}>
          <button
            aria-checked={step.status === 'completed'}
            className="atelier-step"
            data-done={step.status === 'completed' ? 'true' : 'false'}
            data-readonly-label="true"
            onClick={() => props.onToggleStep(index)}
            role="checkbox"
            type="button"
          >
            <span aria-hidden="true" className="atelier-step__box" />
            <StepPresence goalHold={props.goalHold} status={step.status} />
            <span>{step.step}</span>
          </button>
        </li>
      ))}
      {props.manuscripts.map(item => (
        <li key={item.id}>
          <button
            className="atelier-step"
            data-manuscript="true"
            onClick={() => props.onOpenManuscript(item.id)}
            type="button"
          >
            <span>{item.label}</span>
            {maidManuscript(item.label) ? <span className="atelier-refine">{COPY.refine}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

function WorkflowSave(props: { onSave: (title: string) => void }) {
  return (
    <form
      className="atelier-workflow-save"
      onSubmit={event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const title = String(data.get('title') || '').trim()

        if (title) {
          props.onSave(title)
          event.currentTarget.reset()
        }
      }}
    >
      <input aria-label={COPY.workflowName} name="title" placeholder={COPY.workflowName} />
      <button type="submit">{COPY.saveWorkflow}</button>
    </form>
  )
}

function Face(props: { id: string; name: string; faces: Readonly<Record<string, number>>; tone?: PresenceTone }) {
  return (
    <span className="atelier-avatar">
      <img alt="" className="atelier-face" src={portraitSrc(props.id, props.faces[props.id])} />
      {props.tone ? <Presence tone={props.tone} /> : null}
    </span>
  )
}

function SearchMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <circle cx="7" cy="7" fill="none" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.4 10.4 L13.5 13.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="atelier-section">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  )
}

function Empty(props: { children: string }) {
  return <p className="atelier-empty">{props.children}</p>
}

function sessionTone(busy: boolean | null): PresenceTone {
  if (busy === null) {
    return 'unknown'
  }

  return busy ? 'busy' : 'idle'
}
