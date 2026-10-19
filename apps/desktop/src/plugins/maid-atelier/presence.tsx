import { COPY } from './copy'
import { type MaidHold, openStepTone, type ProgressStatus } from './model'
import { PRESENCE_FILL, type PresenceTone } from './theme'

const LABEL: Record<PresenceTone, string> = {
  pending: COPY.pending,
  blocked: COPY.blocked,
  busy: COPY.busy,
  idle: COPY.idle,
  online: COPY.online,
  attention: COPY.attention,
  unknown: COPY.unknown
}

export function Presence(props: { tone: PresenceTone; label?: string; named?: boolean }) {
  const fill = PRESENCE_FILL[props.tone]
  const label = props.label ?? LABEL[props.tone]
  const named = props.named !== false

  return (
    <span
      aria-hidden={named ? undefined : true}
      aria-label={named ? label : undefined}
      className="atelier-pip"
      data-fill={fill}
      data-tone={props.tone}
      role={named ? 'img' : undefined}
      style={{ background: fill }}
    />
  )
}

export function StepPresence(props: { status: ProgressStatus; goalHold: MaidHold | null }) {
  const tone = openStepTone(props.status, props.goalHold)

  if (!tone) {
    return null
  }

  return <Presence named={false} tone={tone} />
}
