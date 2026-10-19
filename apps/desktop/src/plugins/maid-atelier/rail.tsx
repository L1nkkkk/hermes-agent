import type { ReactNode } from 'react'

import { COPY } from './copy'
import type { Workflow } from './desk-store'
import type { AtelierProfile, AtelierSession } from './gateway'
import { type MaidHold, maidManuscript, type ProgressCard } from './model'
import { portraitSrc } from './portraits'
import { Presence, StepPresence } from './presence'
import type { PresenceTone } from './theme'

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
  return (
    <aside className="atelier-pane atelier-rail" data-atelier-pane="left">
      <header className="atelier-you">
        <Face faces={props.faces} id="user" name={props.youName} />
        <div>
          <div className="atelier-you__name">{props.youName}</div>
          <div className="atelier-you__status">
            <Presence tone={props.gatewayOpen ? 'online' : 'unknown'} />
            <span>{props.gatewayOpen ? COPY.online : COPY.offline}</span>
          </div>
        </div>
      </header>
      <Section title={COPY.maids}>
        {props.profiles.length === 0 ? <Empty>{props.gatewayOpen ? COPY.noSessions : COPY.gatewayDown}</Empty> : null}
        {props.profiles.map(profile => (
          <div className="atelier-row" data-selected={profile.id === props.ownerId ? 'true' : 'false'} key={profile.id}>
            <button className="atelier-row__main" onClick={() => props.onSelectProfile(profile.id)} type="button">
              <Face faces={props.faces} id={profile.id} name={profile.name} />
              <span className="atelier-row__name">{profile.name}</span>
              <Presence tone={props.presence[profile.id] ?? 'unknown'} />
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
        ))}
      </Section>
      <Section title={COPY.sessions}>
        {props.sessions.length === 0 ? <Empty>{COPY.noSessions}</Empty> : null}
        {props.sessions.map(session => (
          <button
            className="atelier-session"
            data-selected={session.id === props.sessionId ? 'true' : 'false'}
            key={session.id}
            onClick={() => props.onSelectSession(session.id)}
            type="button"
          >
            <Presence tone={props.sessionHolds[session.id] ?? sessionTone(session.busy)} />
            <span className="atelier-row__name">{session.title}</span>
          </button>
        ))}
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
      <Section title={COPY.workQueue}>
        <WorkSteps
          card={props.card}
          goalHold={props.goalHold}
          manuscripts={props.manuscripts}
          onOpenManuscript={props.onOpenManuscript}
          onToggleStep={props.onToggleStep}
        />
      </Section>
    </aside>
  )
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

function Face(props: { id: string; name: string; faces: Readonly<Record<string, number>> }) {
  return <img alt="" className="atelier-face" src={portraitSrc(props.id, props.faces[props.id])} />
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
