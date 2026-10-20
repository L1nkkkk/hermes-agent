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
  'caret-right': <path d="M6 3.5 L11 8 L6 12.5" />,
  'caret-down': <path d="M3.5 6 L8 11 L12.5 6" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.4 10.4 L13.5 13.5" />
    </>
  ),
  groups: (
    <>
      <circle cx="5.5" cy="5.5" r="1.7" />
      <circle cx="10.5" cy="5.5" r="1.7" />
      <path d="M2.5 12.5 C2.8 10 4 9 5.5 9 C7 9 8 10 8.2 12.5" />
      <path d="M7.8 12.5 C8.2 10 9.2 9 10.5 9 C12 9 13.2 10 13.5 12.5" />
    </>
  ),
  maid: (
    <>
      <circle cx="8" cy="5.2" r="2.1" />
      <path d="M3.2 13 C3.6 10 5.2 8.8 8 8.8 C10.8 8.8 12.4 10 12.8 13" />
    </>
  ),
  queue: (
    <>
      <path d="M3 4.5 H6.2" />
      <path d="M3 8 H6.2" />
      <path d="M3 11.5 H6.2" />
      <path d="M8 4.5 H13" />
      <path d="M8 8 H13" />
      <path d="M8 11.5 H13" />
    </>
  ),
  workflow: (
    <>
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="6.5" cy="12" r="1.6" />
      <path d="M5.4 4.8 L10.5 5.6" />
      <path d="M5.2 5.4 L6 10.4" />
    </>
  ),
  folder: <path d="M2 4.5 H6.2 L7.4 6 H14 V12.5 H2 Z" />,
  file: (
    <>
      <path d="M4 2.5 H9.5 L12.5 5.5 V13.5 H4 Z" />
      <path d="M9.5 2.5 V5.5 H12.5" />
    </>
  ),
  check: <path d="M3.5 8.2 L6.6 11.3 L12.6 4.6" />,
  goal: <circle cx="8" cy="8" r="5.25" />,
  process: (
    <>
      <rect height="3.2" rx="0.6" width="3.2" x="2.2" y="2.4" />
      <path d="M7.2 4 H13.5" />
      <rect height="3.2" rx="0.6" width="3.2" x="2.2" y="6.4" />
      <path d="M7.2 8 H13.5" />
      <rect height="3.2" rx="0.6" width="3.2" x="2.2" y="10.4" />
      <path d="M7.2 12 H13.5" />
    </>
  ),
  copy: (
    <>
      <rect height="8.5" rx="1" width="7.5" x="5.5" y="5" />
      <path d="M3.5 10.5 V3.5 H10.5" />
    </>
  ),
  code: <path d="M6 4.5 L2.8 8 L6 11.5 M10 4.5 L13.2 8 L10 11.5" />,
  send: <path d="M3 8 H13 M9 4 L13 8 L9 12" />,
  draft: <path d="M3 13 L3.6 10.2 L11.2 2.6 L13.4 4.8 L5.8 12.4 Z" />,
  plug: (
    <>
      <path d="M6 2.5 V6" />
      <path d="M10 2.5 V6" />
      <path d="M4 6 H12 V9.5 A4 4 0 0 1 8 13.5 A4 4 0 0 1 4 9.5 Z" />
    </>
  ),
  chevron: <path d="M6 3.5 L10.5 8 L6 12.5" />,
  chip: (
    <>
      <rect height="8" rx="1.4" width="8" x="4" y="4" />
      <path d="M8 2 V4 M8 12 V14 M2 8 H4 M12 8 H14 M4.2 4.2 L3 3 M11.8 4.2 L13 3 M4.2 11.8 L3 13 M11.8 11.8 L13 13" />
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
