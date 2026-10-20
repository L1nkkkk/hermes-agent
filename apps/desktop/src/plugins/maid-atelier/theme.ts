import type { CSSProperties } from 'react'

/**
 * Presence fills for the Maid Atelier workbench.
 *
 * pending and blocked are the locked OpenClaw values. busy is OpenClaw's
 * `--warn` amber. online is the maid theme `--ok` sage. idle is a cooler mint
 * so the three stay apart: OpenClaw's own pip CSS still points busy at `--info`
 * and idle at a muted mix, which would fail the checklist's three-way split.
 * Unknown is an empty ring, never a green.
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

/** Goal hairline and the reader's first chapter. OpenClaw binds both to `--info`. */
export const GOAL_ACCENT = '#60a5fa'

/** Rail star / loud-row gold already used by session meta. */
export const STAR_ACCENT = '#d7b56a'

/** CSS variables the workbench root sets so chrome marks use these tokens. */
export function accentVars(): CSSProperties {
  return {
    '--atelier-pending': PRESENCE_FILL.pending,
    '--atelier-blocked': PRESENCE_FILL.blocked,
    '--atelier-busy': PRESENCE_FILL.busy,
    '--atelier-online': PRESENCE_FILL.online,
    '--atelier-idle': PRESENCE_FILL.idle,
    '--atelier-goal': GOAL_ACCENT,
    '--atelier-star': STAR_ACCENT
  }
}

/**
 * Badge fill for the goal strip. An empty strip uses the goal accent, not a
 * gray disc and not the completed sage.
 */
export function goalBadgeFill(tone: PresenceTone): string {
  if (tone === 'unknown') {
    return GOAL_ACCENT
  }

  if (tone === 'attention') {
    return PRESENCE_FILL.blocked
  }

  return PRESENCE_FILL[tone]
}

export const SHELL = {
  bg: '#1c1d21',
  elevated: '#26282e',
  text: '#c6c8ce',
  strong: '#f3f4f6',
  muted: '#9aa1ab',
  border: '#32353d',
  accent: '#7aa2d0'
} as const
