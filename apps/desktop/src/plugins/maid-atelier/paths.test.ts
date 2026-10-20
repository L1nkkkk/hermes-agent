import { describe, expect, it } from 'vitest'

import type { AtelierProject, AtelierSession } from './gateway'
import { groupSessions } from './paths'

function session(patch: Partial<AtelierSession> & Pick<AtelierSession, 'id' | 'title'>): AtelierSession {
  return {
    preview: '',
    updatedAt: 0,
    busy: false,
    profileId: 'harper',
    cwd: null,
    gitRepoRoot: null,
    gitBranch: null,
    ...patch
  }
}

describe('session groups', () => {
  const clay = session({
    id: 'ch07',
    title: 'ch07_clay.md',
    cwd: '/work/hp02-rewrite/manuscript/volume_1'
  })

  const notes = session({ id: 'notes', title: 'Scratch', cwd: null })

  it('nests sessions under projects.tree labels and leaves the rest loose', () => {
    const projects: AtelierProject[] = [
      { id: 'p1', label: 'hp02-rewrite', path: '/work/hp02-rewrite', sessionIds: ['ch07'] }
    ]

    expect(groupSessions([clay, notes], projects)).toEqual({
      buckets: [{ id: 'p1', label: 'hp02-rewrite', path: '/work/hp02-rewrite', sessions: [clay] }],
      loose: [notes]
    })
  })

  it('falls back to the session cwd when the project tree names nothing loaded', () => {
    const grouped = groupSessions([clay, notes], [])

    expect(grouped.buckets.map(bucket => bucket.label)).toEqual(['volume_1'])
    expect(grouped.buckets[0]?.sessions.map(row => row.id)).toEqual(['ch07'])
    expect(grouped.loose.map(row => row.id)).toEqual(['notes'])
  })
})
