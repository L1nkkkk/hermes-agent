import type { AtelierProject, AtelierSession } from './gateway'
import { maidManuscript } from './model'

export type SessionBucket = {
  id: string
  label: string
  path: string | null
  sessions: AtelierSession[]
}

/** Tail of a real workspace path. Segments that were not in the path are never added. */
export function pathTail(path: string, count = 3): string[] {
  return path
    .split(/[\\/]+/u)
    .filter(part => part && part !== '.')
    .slice(-count)
}

export function pathLabel(path: string): string {
  return pathTail(path, 1)[0] || path
}

/**
 * Reader crumbs. A missing path stays a single title — no invented
 * `manuscript/` folders. A file-like session title is appended only as the leaf.
 */
export function workspaceCrumbs(input: { path?: string | null; title?: string | null }): string[] {
  const title = input.title?.trim() ?? ''
  const path = input.path?.trim() ?? ''

  if (!path) {
    return title ? [title] : []
  }

  const tail = pathTail(path, 3)

  if (title && maidManuscript(title) && tail[tail.length - 1] !== title) {
    return [...tail, title]
  }

  return tail
}

export function fullWorkspacePath(input: { path?: string | null; title?: string | null }): string {
  const path = input.path?.trim() ?? ''
  const title = input.title?.trim() ?? ''

  if (!path) {
    return title
  }

  if (title && maidManuscript(title) && !path.endsWith(title)) {
    return `${path.replace(/[\\/]+$/u, '')}/${title}`
  }

  return path
}

/**
 * Project nodes from `projects.tree` when they name loaded sessions.
 * Otherwise group this profile's own sessions by `git_repo_root` or `cwd`.
 * Sessions with neither stay loose. Nothing here is a cross-profile room.
 */
export function groupSessions(
  sessions: readonly AtelierSession[],
  projects: readonly AtelierProject[]
): { buckets: SessionBucket[]; loose: AtelierSession[] } {
  const claimed = new Set<string>()
  const buckets: SessionBucket[] = []

  for (const project of projects) {
    const rows = sessions.filter(session => project.sessionIds.includes(session.id))

    if (rows.length === 0) {
      continue
    }

    for (const row of rows) {
      claimed.add(row.id)
    }

    buckets.push({ id: project.id, label: project.label, path: project.path, sessions: rows })
  }

  const rest = sessions.filter(session => !claimed.has(session.id))

  if (buckets.length > 0) {
    return { buckets, loose: rest }
  }

  return groupByWorkspace(rest)
}

function groupByWorkspace(sessions: readonly AtelierSession[]): { buckets: SessionBucket[]; loose: AtelierSession[] } {
  const buckets: SessionBucket[] = []
  const loose: AtelierSession[] = []
  const index = new Map<string, SessionBucket>()

  for (const session of sessions) {
    const path = session.gitRepoRoot || session.cwd

    if (!path) {
      loose.push(session)

      continue
    }

    const existing = index.get(path)

    if (existing) {
      existing.sessions.push(session)

      continue
    }

    const bucket: SessionBucket = { id: path, label: pathLabel(path), path, sessions: [session] }

    index.set(path, bucket)
    buckets.push(bucket)
  }

  return { buckets, loose }
}
