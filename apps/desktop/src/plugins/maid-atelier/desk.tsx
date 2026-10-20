import { useStore } from '@nanostores/react'

import { $currentModel } from '@/store/session'

import { COPY } from './copy'
import type { AtelierMessage } from './gateway'
import {
  applyMaidMention,
  draftCandidates,
  findMaidMentionTarget,
  type GoalFacts,
  type MaidHold,
  maidMentionChoices,
  type MentionAgent,
  type ProgressCard,
  type ProgressModel,
  type Room
} from './model'
import { Emoji, Mark } from './marks'
import { FACE_COUNT, FACE_NAMES, portraitSrc } from './portraits'
import { Presence, StepPresence } from './presence'
import { goalBadgeFill, goalEmoji, PRESENCE_FILL, type PresenceTone } from './theme'

const TONE: Record<ProgressModel['tone'], PresenceTone> = {
  working: 'busy',
  completed: 'online',
  attention: 'attention',
  idle: 'idle'
}

const STATUS: Record<ProgressModel['tone'], string> = {
  working: COPY.busy,
  completed: COPY.completed,
  attention: COPY.attention,
  idle: COPY.idle
}

export function Desk(props: {
  room: Room
  ownerId: string
  profiles: readonly MentionAgent[]
  memberIds: readonly string[]
  progress: ProgressModel
  messages: readonly AtelierMessage[]
  goal: GoalFacts | null
  card: ProgressCard | null
  goalHold: MaidHold | null
  chipHold: MaidHold | null
  composer: string
  faces: Readonly<Record<string, number>>
  pullOpen: boolean
  editingFace: string | null
  onComposer: (value: string, caret: number) => void
  onSend: () => void
  onTogglePull: () => void
  onDraft: (agent: MentionAgent) => void
  onToggleStep: (index: number) => void
  onAddStep: (label: string) => void
  onEditFace: (id: string | null) => void
  onPickFace: (id: string, index: number) => void
  caret: number
  youTone: PresenceTone
}) {
  const agents =
    props.room.kind === 'group' ? props.room.members.flatMap(member => (member.kind === 'agent' ? [member] : [])) : []

  const mentionAgents = agents
    .filter(agent => agent.id !== props.ownerId)
    .map(agent => ({ id: agent.id, name: agent.name }))

  const target = findMaidMentionTarget(props.composer, props.caret)
  const choices = target ? maidMentionChoices(mentionAgents, target.query) : []
  const candidates = draftCandidates(props.profiles, props.memberIds, props.ownerId)
  const model = useStore($currentModel).trim()

  return (
    <section className="atelier-pane atelier-desk" data-atelier-pane="main">
      <header className="atelier-desk__bar">
        <div className="atelier-room__faces">
          {props.room.members.slice(0, 4).map(member => (
            <button
              aria-label={COPY.changeFace(member.name)}
              className="atelier-room__face"
              data-kind={member.kind}
              data-tone={member.kind === 'user' ? props.youTone : undefined}
              key={member.id}
              onClick={() => props.onEditFace(member.id)}
              style={member.kind === 'user' ? { ['--face-ring' as string]: PRESENCE_FILL[props.youTone] } : undefined}
              type="button"
            >
              <img alt="" src={portraitSrc(member.id, props.faces[member.id])} />
            </button>
          ))}
        </div>
        <div className="atelier-room__copy">
          <h1 className="atelier-room-title">
            <Emoji symbol="💬" />
            {props.room.title}
          </h1>
          {props.room.kind === 'group' ? (
            <div className="atelier-room__meta">{COPY.groupRoom(props.room.members.length)}</div>
          ) : null}
        </div>
        <ProgressChip hold={props.chipHold} progress={props.progress} />
      </header>
      {props.pullOpen && candidates.length > 0 ? (
        <div className="atelier-draft__menu" role="group">
          <p>{COPY.draftHint}</p>
          {candidates.map(agent => (
            <button data-maid-candidate={agent.id} key={agent.id} onClick={() => props.onDraft(agent)} type="button">
              <img alt="" src={portraitSrc(agent.id, props.faces[agent.id])} />
              <span>{agent.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {props.editingFace ? (
        <div aria-label={COPY.faceTitle} className="atelier-faces" role="group">
          {Array.from({ length: FACE_COUNT }, (_, index) => (
            <button
              aria-label={FACE_NAMES[index]}
              key={index}
              onClick={() => props.onPickFace(props.editingFace as string, index)}
              type="button"
            >
              <img alt="" src={portraitSrc(props.editingFace as string, index)} />
            </button>
          ))}
          <button onClick={() => props.onEditFace(null)} type="button">
            {COPY.close}
          </button>
        </div>
      ) : null}
      <div className="atelier-thread">
        <TaskLog
          card={props.card}
          goalHold={props.goalHold}
          onToggleStep={props.onToggleStep}
          quiet={props.messages.length > 0}
        />
        {props.messages.map((message, index) => (
          <MessageRow
            faces={props.faces}
            key={`${message.role}:${index}`}
            mention={message.text.includes('@')}
            message={message}
          />
        ))}
      </div>
      <GoalStrip goal={props.goal} hold={props.chipHold} progress={props.progress} />
      <form
        className="atelier-composer"
        onSubmit={event => {
          event.preventDefault()
          props.onSend()
        }}
      >
        {choices.length > 0 && target ? (
          <div aria-label={COPY.mentionMenu} className="atelier-mentions" role="listbox">
            {choices.map(agent => (
              <button
                key={agent.id}
                onClick={() => {
                  const next = applyMaidMention(props.composer, target, agent)
                  props.onComposer(next.value, next.caret)
                }}
                type="button"
              >
                <img alt="" src={portraitSrc(agent.id, props.faces[agent.id])} />
                <span>@{agent.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          aria-label={props.room.kind === 'group' ? COPY.composerGroup : COPY.composerDm(props.room.title)}
          onChange={event => props.onComposer(event.target.value, event.target.selectionStart)}
          onSelect={event => props.onComposer(event.currentTarget.value, event.currentTarget.selectionStart)}
          placeholder={props.room.kind === 'group' ? COPY.composerGroup : COPY.composerDm(props.room.title)}
          value={props.composer}
        />
        <div className="atelier-composer__bar">
          <button
            aria-expanded={props.pullOpen}
            className="atelier-draft"
            data-maid-pull="draft"
            disabled={candidates.length === 0}
            onClick={props.onTogglePull}
            title={candidates.length === 0 ? COPY.draftEmpty : COPY.draftHint}
            type="button"
          >
            <Mark name="draft" />
            <span>{COPY.draftLine}</span>
          </button>
          <div className="atelier-composer__end">
            <span className="atelier-model">
              <Emoji symbol="✨" />
              <Mark name="chip" />
              <span>{model || COPY.noModel}</span>
            </span>
            <button type="submit">
              <Mark name="send" />
              <span>{COPY.send}</span>
            </button>
          </div>
        </div>
        <StepAdd onAdd={props.onAddStep} />
      </form>
    </section>
  )
}

function ProgressChip(props: { progress: ProgressModel; hold: MaidHold | null }) {
  const empty = props.progress.source === 'empty'
  const label = empty ? COPY.noGoal : props.progress.target || COPY.currentSession
  const tone: PresenceTone = props.hold ?? (empty ? 'unknown' : TONE[props.progress.tone])

  return (
    <div
      aria-label={COPY.progressLabel}
      className="atelier-progress"
      data-source={props.progress.source}
      data-tone={tone}
      role="status"
    >
      {tone === 'unknown' ? (
        <span className="atelier-progress__mark">
          <Mark name="goal" />
        </span>
      ) : (
        <Presence tone={tone} />
      )}
      {props.progress.total > 0 ? (
        <span className="atelier-progress__fraction">
          {COPY.process(props.progress.completed, props.progress.total)}
        </span>
      ) : empty ? null : (
        <span className="atelier-progress__label">{label}</span>
      )}
    </div>
  )
}

function GoalStrip(props: { progress: ProgressModel; goal: GoalFacts | null; hold: MaidHold | null }) {
  const empty = props.progress.source === 'empty' && !props.goal?.objective.trim()
  const tone: PresenceTone = props.hold ?? (empty ? 'unknown' : TONE[props.progress.tone])
  const target = props.goal?.objective.trim() || props.progress.target
  const sentence = target ? COPY.goalLine(target, STATUS[props.progress.tone]) : COPY.noGoal
  const fraction = props.progress.total > 0
  const width = fraction ? Math.round((props.progress.completed / props.progress.total) * 100) : 0
  const badgeFill = goalBadgeFill(tone)

  return (
    <div aria-hidden="true" className="atelier-goalstrip" data-tone={tone}>
      <div className="atelier-goalstrip__row">
        <span className="atelier-goalstrip__badge" data-fill={badgeFill} style={{ background: badgeFill }}>
          <Mark name={tone === 'online' ? 'check' : 'goal'} />
        </span>
        <Emoji symbol={goalEmoji(tone)} />
        <span className="atelier-goalstrip__goal">{sentence}</span>
        <span className="atelier-goalstrip__fraction">
          <Mark name="process" />
          {fraction ? <span>{COPY.process(props.progress.completed, props.progress.total)}</span> : null}
        </span>
      </div>
      {fraction ? (
        <div className="atelier-goalstrip__track">
          <span className="atelier-goalstrip__fill" style={{ width: `${width}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function TaskLog(props: {
  card: ProgressCard | null
  goalHold: MaidHold | null
  quiet: boolean
  onToggleStep: (index: number) => void
}) {
  const steps = props.card?.steps.filter(step => step.step.trim()) ?? []
  const log = firstLine(props.card?.markdown)

  if (!log && steps.length === 0) {
    if (props.quiet) {
      return null
    }

    return (
      <section aria-label={COPY.workQueue} className="atelier-log">
        <p className="atelier-empty">
          <Mark name="file" />
          <Emoji symbol="📄" />
          <span>{COPY.noLog}</span>
        </p>
        <p className="atelier-empty" data-empty="checklist">
          <Mark name="queue" />
          <Emoji symbol="📋" />
          <span>{COPY.noChecklist}</span>
        </p>
      </section>
    )
  }

  return (
    <section aria-label={COPY.workQueue} className="atelier-log">
      {log ? <p>{log}</p> : null}
      {steps.length > 0 ? (
        <ul>
          {steps.map((step, index) => (
            <li key={`${index}:${step.step}`}>
              <button
                aria-checked={step.status === 'completed'}
                onClick={() => props.onToggleStep(index)}
                role="checkbox"
                type="button"
              >
                <span aria-hidden="true" className="atelier-step__box">
                  {step.status === 'completed' ? <Mark name="check" /> : null}
                </span>
                <StepPresence goalHold={props.goalHold} status={step.status} />
                <span>{step.step}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function MessageRow(props: { message: AtelierMessage; mention: boolean; faces: Readonly<Record<string, number>> }) {
  const id = props.message.role === 'user' ? 'user' : props.message.name

  return (
    <article
      className={props.mention ? 'atelier-msg atelier-msg--mention' : 'atelier-msg'}
      data-role={props.message.role}
    >
      <img alt="" src={portraitSrc(id, props.faces[id])} />
      <div>
        <div className="atelier-msg__name">{props.message.name}</div>
        <p>{props.message.text}</p>
      </div>
    </article>
  )
}

function StepAdd(props: { onAdd: (label: string) => void }) {
  return (
    <input
      aria-label={COPY.addStep}
      className="atelier-add-step"
      onKeyDown={event => {
        if (event.key !== 'Enter') {
          return
        }

        event.preventDefault()
        const label = event.currentTarget.value.trim()

        if (!label) {
          return
        }

        props.onAdd(label)
        event.currentTarget.value = ''
      }}
      placeholder={COPY.addStep}
    />
  )
}

function firstLine(markdown: string | undefined): string {
  if (!markdown) {
    return ''
  }

  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/^[#>*\-\d.)\s]+/u, '').trim()

    if (line) {
      return line
    }
  }

  return ''
}
