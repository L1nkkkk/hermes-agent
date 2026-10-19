import { type ReactNode, useState } from 'react'

import { COPY } from './copy'
import type { Workflow } from './desk-store'
import type { AtelierProfile, AtelierSession } from './gateway'
import { type MaidHold, maidManuscript, type ProgressCard } from './model'
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
  card: ProgressCard | null
  goalHold: MaidHold | null
  sessionHolds: Readonly<Record<string, MaidHold>>
  onSelectProfile: (id: string) => void
  onToggleMember: (id: string) => void
  onSelectSession: (id: string) => void
  onOpenWorkflow: (workflow: Workflow) => void
  onSaveWorkflow: (title: string) => void
  onToggleStep: (index: number) => void
  manuscripts: readonly { id: string; label: string }[]
  onOpenManuscript: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const shown = props.profiles.filter(profile => profileShown(profile, props.sessions, props.ownerId, query))

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
        <Section title={COPY.maids}>
          {shown.length === 0 ? (
            <Empty>{props.profiles.length === 0 && !props.gatewayOpen ? COPY.gatewayDown : COPY.noSessions}</Empty>
          ) : null}
          {shown.map(profile => {
            const selected = profile.id === props.ownerId
            const sessions = shownSessions(profile, props.sessions, props.ownerId, query)

            return (
              <div className="atelier-branch" key={profile.id}>
                <div className="atelier-row" data-selected={selected ? 'true' : 'false'}>
                  <button className="atelier-row__main" onClick={() => props.onSelectProfile(profile.id)} type="button">
                    <Face
                      faces={props.faces}
                      id={profile.id}
                      name={profile.name}
                      tone={props.presence[profile.id] ?? 'unknown'}
                    />
                    <span className="atelier-row__name">{profile.name}</span>
                    {selected && props.sessions.length > 0 ? (
                      <span className="atelier-row__age">{props.sessions.length}</span>
                    ) : null}
                  </button>
                  <label className="atelier-member">
                    <input
                      aria-label={`${COPY.inRoom} ${profile.name}`}
                      checked={profile.id === props.ownerId || props.memberIds.includes(profile.id)}
                      disabled={profile.id === props.ownerId}
                      onChange={() => props.onToggleMember(profile.id)}
                      type="checkbox"
                    />
                  </label>
                </div>
                {selected ? (
                  <div aria-label={COPY.sessions} className="atelier-tree">
                    {sessions.length === 0 ? <Empty>{COPY.noSessions}</Empty> : null}
                    {sessions.map(session => {
                      const tone = props.sessionHolds[session.id] ?? sessionTone(session.busy)
                      const age = sessionAge(session.updatedAt)

                      return (
                        <button
                          className="atelier-session"
                          data-selected={session.id === props.sessionId ? 'true' : 'false'}
                          key={session.id}
                          onClick={() => props.onSelectSession(session.id)}
                          type="button"
                        >
                          <Presence tone={tone} />
                          <span className="atelier-row__name">{session.title}</span>
                          {LOUD.has(tone) ? <span className="atelier-row__meta">{TONE_LABEL[tone]}</span> : null}
                          {age ? <span className="atelier-row__age">{age}</span> : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
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
