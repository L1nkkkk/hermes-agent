import type { CSSProperties } from 'react'

/**
 * Dark-mode fallbacks for presence fills. The painted color is `statusPaint()`,
 * which reads `--status-*` from styles.css (`:root` light, `.dark` dark) so a
 * light shell does not keep the OpenClaw night values. These hexes stay the
 * dark checklist: pending and blocked apart, busy / idle / online three ways,
 * unknown an empty ring.
 */

export const PRESENCE_FILL = {
  pending: '#5b8def',
  blocked: '#d4546a',
  busy: '#f59e0b',
  idle: '#7ec8c3',
  online: '#6fbf8a',
  attention: '#f87171',
  unknown: 'transparent'
} as const

export type PresenceTone = keyof typeof PRESENCE_FILL

/** Status emoji for a real presence tone. Online is a green dot, not a completed check. */
export const TONE_EMOJI: Record<PresenceTone, string> = {
  pending: '⏳',
  blocked: '⛔',
  busy: '⚡',
  idle: '💤',
  online: '🟢',
  attention: '⚠️',
  unknown: '🎯'
}

/** Goal-strip emoji. A completed goal is a check; an empty goal stays a target. */
export function goalEmoji(tone: PresenceTone): string {
  if (tone === 'online') {
    return '✅'
  }

  if (tone === 'unknown') {
    return '🎯'
  }

  return TONE_EMOJI[tone]
}

const STATUS_VAR = {
  pending: '--status-pending',
  blocked: '--status-blocked',
  busy: '--status-busy',
  idle: '--status-idle',
  online: '--status-online',
  attention: '--status-attention'
} as const

/** Paint a presence tone from the shell status token, with the dark hex as fallback. */
export function statusPaint(tone: PresenceTone): string {
  if (tone === 'unknown') {
    return PRESENCE_FILL.unknown
  }

  return `var(${STATUS_VAR[tone]}, ${PRESENCE_FILL[tone]})`
}

/** CSS variables the workbench root sets so chrome marks follow `--status-*`. */
export function accentVars(): CSSProperties {
  return {
    '--atelier-pending': statusPaint('pending'),
    '--atelier-blocked': statusPaint('blocked'),
    '--atelier-busy': statusPaint('busy'),
    '--atelier-online': statusPaint('online'),
    '--atelier-idle': statusPaint('idle'),
    '--atelier-goal': 'var(--status-goal, #60a5fa)',
    '--atelier-star': 'var(--status-star, #d7b56a)'
  }
}

/**
 * Badge fill for the goal strip. An empty strip uses the goal accent, not a
 * gray disc and not the completed sage.
 */
export function goalBadgeFill(tone: PresenceTone): string {
  if (tone === 'unknown') {
    return 'var(--status-goal, #60a5fa)'
  }

  if (tone === 'attention') {
    return statusPaint('blocked')
  }

  return statusPaint(tone)
}
