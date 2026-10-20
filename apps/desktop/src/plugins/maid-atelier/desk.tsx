import { host, useValue } from '@hermes/plugin-sdk'
import { useEffect, useRef } from 'react'

import { COPY } from './copy'
import type { AtelierMessage } from './gateway'
import { Emoji, Mark } from './marks'
import {
  applyMaidMention,
  findMaidMentionTarget,
  type GateState,
  type GoalFacts,
  goalSummary,
  type MaidHold,
  maidMentionChoices,
  type MentionAgent,
  type ProgressModel,
  type Room,
  type SummaryRow
} from './model'
import { portraitSrc } from './portraits'
import { Presence } from './presence'
import { goalBadgeFill, goalEmoji, type PresenceTone, statusPaint } from './theme'

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
  chipHold: MaidHold | null
  composer: string
  faces: Readonly<Record<string, number>>
  onComposer: (value: string, caret: number) => void
  onSend: () => void
  caret: number
  youTone: PresenceTone
  sessionId: string | null
  /** Bumps when the rail's Quick Start asks for the composer. */
  focusKey: number
  /** Workspace tail under the room name, from the session the desk resumed. */
  workspaceTail: string
}) {
  const agents =
    props.room.kind === 'group' ? props.room.members.flatMap(member => (member.kind === 'agent' ? [member] : [])) : []

  const mentionAgents = agents
    .filter(agent => agent.id !== props.ownerId)
    .map(agent => ({ id: agent.id, name: agent.name }))

  const target = findMaidMentionTarget(props.composer, props.caret)
  const choices = target ? maidMentionChoices(mentionAgents, target.query) : []
  const model = useValue(host.state.model).trim()
  const canSend = props.composer.trim().length > 0
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (props.focusKey > 0) {
      input.current?.focus()
    }
  }, [props.focusKey])

  return (
    <section className="atelier-pane atelier-desk" data-atelier-pane="main">
      <header className="atelier-desk__bar">
        <div className="atelier-room__faces">
          {props.room.members.slice(0, 4).map(member => (
            <span
              className="atelier-room__face"
              data-kind={member.kind}
              data-tone={member.kind === 'user' ? props.youTone : undefined}
              key={member.id}
              style={member.kind === 'user' ? { ['--face-ring' as string]: statusPaint(props.youTone) } : undefined}
            >
              <img alt="" src={portraitSrc(member.id, props.faces[member.id])} />
            </span>
          ))}
        </div>
        <div className="atelier-room__copy">
          <h1 className="atelier-room-title">
            <Emoji symbol="💬" />
            {props.room.title}
          </h1>
          <div className="atelier-room__meta">
            <span>{props.room.kind === 'group' ? COPY.groupRoom(props.room.members.length) : COPY.privateRoom}</span>
            {props.workspaceTail ? (
              <>
                <span className="atelier-room__sep">·</span>
                <span className="atelier-room__path" title={props.workspaceTail}>
                  {props.workspaceTail}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="atelier-host">
          <button
            onClick={() => host.navigate(props.sessionId ? `/${encodeURIComponent(props.sessionId)}` : '/')}
            type="button"
          >
            {COPY.openChat}
          </button>
          <button onClick={() => host.navigate('/settings')} type="button">
            {COPY.settings}
          </button>
        </div>
        <ProgressChip hold={props.chipHold} progress={props.progress} />
      </header>
      <div className="atelier-thread">
        <WorkSummary goal={props.goal} />
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

          if (!canSend) {
            return
          }

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
          ref={input}
          value={props.composer}
        />
        <div className="atelier-composer__bar">
          <div className="atelier-composer__end">
            <button
              aria-label={COPY.pickModel}
              className="atelier-model"
              onClick={() => host.openModelPicker()}
              type="button"
            >
              <Emoji symbol="✨" />
              <Mark name="chip" />
              <span>{model || COPY.noModel}</span>
            </button>
            <button disabled={!canSend} type="submit">
              <Mark name="send" />
              <span>{COPY.send}</span>
            </button>
          </div>
        </div>
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

const GATE_MARK: Record<GateState, { mark: 'check' | 'cross' | 'dot'; label: string }> = {
  passed: { mark: 'check', label: COPY.gatePassed },
  failed: { mark: 'cross', label: COPY.gateFailed },
  unrun: { mark: 'dot', label: COPY.gateUnrun }
}

/**
 * Structured work summary above the transcript: the goal control's real
 * criteria and gates as a file-list of bullets. No goal, no invented rows.
 */
function WorkSummary(props: { goal: GoalFacts | null }) {
  const rows = goalSummary(props.goal)
  const title = props.goal?.objective.trim() || ''

  return (
    <section aria-label={COPY.workSummaryLabel} className="atelier-summary">
      <div className="atelier-summary__head">
        <Mark name="queue" />
        <span className="atelier-summary__title">{COPY.workSummary}</span>
        {title ? <span className="atelier-summary__goal">{title}</span> : null}
        {rows.length > 0 ? <span className="atelier-summary__count">{rows.length}</span> : null}
      </div>
      {rows.length === 0 ? (
        <p className="atelier-summary__empty">{COPY.noPlan}</p>
      ) : (
        <ul className="atelier-summary__rows">
          {rows.map(row => (
            <SummaryLine key={row.kind === 'gate' ? `gate:${row.command}` : `sub:${row.index}`} row={row} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SummaryLine(props: { row: SummaryRow }) {
  if (props.row.kind === 'subgoal') {
    return (
      <li className="atelier-summary__row" data-kind="subgoal">
        <span className="atelier-summary__index">{props.row.index}</span>
        <span className="atelier-summary__text">{props.row.text}</span>
      </li>
    )
  }

  const gate = GATE_MARK[props.row.state]

  return (
    <li aria-label={gate.label} className="atelier-summary__row" data-kind="gate" data-state={props.row.state}>
      <Mark name={gate.mark} />
      <span className="atelier-summary__cmd">{props.row.command}</span>
    </li>
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
