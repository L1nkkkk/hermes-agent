import type { ReactNode } from 'react'

/** Painted chrome marks. Inline so the Electron window does not depend on an icon font. */

export type MarkName =
  | 'caret-right'
  | 'caret-down'
  | 'search'
  | 'groups'
  | 'maid'
  | 'queue'
  | 'workflow'
  | 'folder'
  | 'file'
  | 'check'
  | 'goal'
  | 'process'
  | 'copy'
  | 'code'
  | 'send'
  | 'draft'
  | 'plug'
  | 'chevron'
  | 'chip'

const BODY: Record<MarkName, ReactNode> = {
  'caret-right': <path d="M6.25 4.35 L10.05 8 L6.25 11.65" />,
  'caret-down': <path d="M4.35 6.25 L8 10.05 L11.65 6.25" />,
  search: (
    <>
      <circle cx="6.7" cy="6.7" r="3.45" />
      <path d="M9.25 9.25 L13.15 13.15" />
    </>
  ),
  groups: (
    <>
      <circle cx="5.15" cy="5.05" r="1.4" />
      <circle cx="10.75" cy="5.05" r="1.4" />
      <path d="M2.35 12.85 C2.65 10.2 3.7 9 5.15 9 C6.6 9 7.55 10.2 7.9 12.85" />
      <path d="M8.1 12.85 C8.45 10.2 9.4 9 10.75 9 C12.2 9 13.25 10.2 13.55 12.85" />
    </>
  ),
  maid: (
    <>
      <circle cx="8" cy="4.85" r="1.8" />
      <path d="M3.45 13.15 C3.8 10.15 5.4 8.8 8 8.8 C10.6 8.8 12.2 10.15 12.55 13.15" />
    </>
  ),
  queue: (
    <>
      <rect height="2.15" rx="0.35" width="2.15" x="2.45" y="2.55" />
      <rect height="2.15" rx="0.35" width="2.15" x="2.45" y="6.9" />
      <rect height="2.15" rx="0.35" width="2.15" x="2.45" y="11.25" />
      <path d="M6.35 3.6 H13.45 M6.35 7.95 H13.45 M6.35 12.3 H13.45" />
    </>
  ),
  workflow: (
    <>
      <circle cx="3.7" cy="4" r="1.15" />
      <circle cx="12.15" cy="5.45" r="1.15" />
      <circle cx="6.35" cy="12.15" r="1.15" />
      <path d="M4.8 4.2 L11.05 5.25" />
      <path d="M4.05 5.05 L5.95 11.05" />
    </>
  ),
  folder: <path d="M2.35 4.55 H6.05 L7.2 6.05 H13.65 V12.95 H2.35 Z" />,
  file: (
    <>
      <path d="M4.05 2.15 H9.05 L12.75 5.85 V13.85 H4.05 Z" />
      <path d="M9.05 2.15 V5.85 H12.75" />
      <path d="M6.1 8.35 H10.75 M6.1 10.7 H9.35" />
    </>
  ),
  check: <path d="M4.05 8.3 L6.75 11 L12.1 4.9" />,
  goal: <circle cx="8" cy="8" r="4.35" />,
  process: (
    <>
      <circle cx="3.55" cy="4" r="0.85" />
      <circle cx="3.55" cy="8" r="0.85" />
      <circle cx="3.55" cy="12" r="0.85" />
      <path d="M6.15 4 H13.35 M6.15 8 H13.35 M6.15 12 H11.15" />
    </>
  ),
  copy: (
    <>
      <rect height="7.45" rx="1.05" width="6.85" x="6.2" y="5.45" />
      <path d="M3.55 10.35 V3.45 H10.45" />
    </>
  ),
  code: <path d="M6.15 4.1 L2.85 8 L6.15 11.9 M9.85 4.1 L13.15 8 L9.85 11.9" />,
  send: <path d="M3.15 8 H12.7 M8.95 4.25 L12.7 8 L8.95 11.75" />,
  draft: (
    <>
      <path d="M2.9 13.1 L3.95 10.05 L11.7 2.3 L13.7 4.3 L5.95 12.05 Z" />
      <path d="M10.55 3.45 L12.55 5.45" />
    </>
  ),
  plug: (
    <>
      <path d="M6.2 2.25 V5.35 M9.8 2.25 V5.35" />
      <path d="M4.25 5.35 H11.75 V9.15 C11.75 11.35 10.1 13.15 8 13.15 C5.9 13.15 4.25 11.35 4.25 9.15 Z" />
    </>
  ),
  chevron: <path d="M5.7 3.7 L10.45 8 L5.7 12.3" />,
  chip: (
    <>
      <rect height="6" rx="1" width="6" x="5" y="5" />
      <path d="M8 2.55 V5 M8 11 V13.45 M2.55 8 H5 M11 8 H13.45" />
    </>
  )
}

export function Mark(props: { name: MarkName }) {
  return (
    <svg aria-hidden="true" className={`atelier-mark atelier-mark--${props.name}`} viewBox="0 0 16 16">
      {BODY[props.name]}
    </svg>
  )
}

/** Color emoji Control uses in the rail, goal strip, and reader chrome. Hidden from the accessible name. */
export function Emoji(props: { symbol: string; trail?: boolean }) {
  return (
    <span aria-hidden="true" className={props.trail ? 'atelier-emoji atelier-emoji--trail' : 'atelier-emoji'}>
      {props.symbol}
    </span>
  )
}
