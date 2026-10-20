/** Workspace files through the Desktop bridge the host file tree already uses. */

export type WorkspaceEntry = {
  name: string
  path: string
  isDirectory: boolean
}

export type WorkspaceText = {
  path: string
  text: string
  truncated: boolean
  binary: boolean
}

export type WorkspaceScope = {
  connectionId: string | null
  profile: string | null
}

type DesktopFs = {
  readDir?: (path: string) => Promise<{ entries?: WorkspaceEntry[]; error?: string }>
  readFileText?: (path: string) => Promise<unknown>
  writeTextFile?: (path: string, content: string) => Promise<{ path: string }>
  api?: <T>(request: {
    body?: unknown
    connectionId?: string | null
    method?: string
    path: string
    profile?: string | null
  }) => Promise<T>
}

const SKIPPED = new Set(['.git', 'node_modules'])

export function crumbTrail(path: string): { label: string; path: string }[] {
  const slash = path.includes('\\') && !path.includes('/') ? '\\' : '/'
  const trimmed = path.replace(/[\\/]+$/u, '')
  const rooted = trimmed.startsWith('/')
  const parts = trimmed.split(/[\\/]+/u).filter(part => part && part !== '.')
  const trail: { label: string; path: string }[] = []
  let current = ''

  for (const part of parts) {
    if (!current) {
      current = rooted ? `/${part}` : part
    } else {
      current = `${current}${slash}${part}`
    }

    trail.push({ label: part, path: current })
  }

  return trail
}

export function workspaceWritable(scope: WorkspaceScope): boolean {
  const desktop = bridge()

  if (!desktop) {
    return false
  }

  return remoteScope(scope) ? typeof desktop.api === 'function' : typeof desktop.writeTextFile === 'function'
}

export async function listWorkspace(path: string, scope: WorkspaceScope): Promise<WorkspaceEntry[]> {
  const desktop = requireBridge()

  const listed = remoteScope(scope)
    ? await desktop.api!< { entries?: WorkspaceEntry[]; error?: string }>({
        connectionId: scope.connectionId,
        path: `/api/fs/list?path=${encodeURIComponent(path)}`,
        profile: scope.profile
      })
    : await requireLocal(desktop.readDir)(path)

  if (listed.error) {
    throw new Error(listed.error)
  }

  return (listed.entries ?? [])
    .filter(entry => entry.name && !SKIPPED.has(entry.name))
    .sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
}

export async function readWorkspaceText(path: string, scope: WorkspaceScope): Promise<WorkspaceText> {
  const desktop = requireBridge()

  const result = remoteScope(scope)
    ? await desktop.api!<unknown>({
        connectionId: scope.connectionId,
        path: `/api/fs/read-text?path=${encodeURIComponent(path)}`,
        profile: scope.profile
      })
    : await requireLocal(desktop.readFileText)(path)

  return asText(result, path)
}

export async function writeWorkspaceText(path: string, content: string, scope: WorkspaceScope): Promise<void> {
  const desktop = requireBridge()

  if (!workspaceWritable(scope)) {
    throw new Error('Saving is not available')
  }

  if (remoteScope(scope)) {
    await desktop.api!({
      body: { content, path },
      connectionId: scope.connectionId,
      method: 'POST',
      path: '/api/fs/write-text',
      profile: scope.profile
    })

    return
  }

  await desktop.writeTextFile!(path, content)
}

function bridge(): DesktopFs | null {
  const desktop = (globalThis as { hermesDesktop?: DesktopFs }).hermesDesktop

  return desktop ?? null
}

function requireBridge(): DesktopFs {
  const desktop = bridge()

  if (!desktop) {
    throw new Error('Workspace files are unavailable in this window.')
  }

  return desktop
}

function requireLocal<T extends (...args: never[]) => unknown>(fn: T | undefined): T {
  if (!fn) {
    throw new Error('Workspace files are unavailable in this window.')
  }

  return fn
}

function remoteScope(scope: WorkspaceScope): boolean {
  const id = scope.connectionId?.trim() ?? ''

  return id !== '' && id !== 'local'
}

function asText(value: unknown, fallbackPath: string): WorkspaceText {
  if (value && typeof value === 'object' && (value as { ok?: unknown }).ok === false) {
    const message = (value as { message?: unknown }).message

    throw new Error(typeof message === 'string' && message ? message : 'File is missing.')
  }

  if (!value || typeof value !== 'object') {
    throw new Error('Could not read this file.')
  }

  const row = value as { binary?: unknown; path?: unknown; text?: unknown; truncated?: unknown }

  return {
    path: typeof row.path === 'string' && row.path ? row.path : fallbackPath,
    text: typeof row.text === 'string' ? row.text : '',
    truncated: row.truncated === true,
    binary: row.binary === true
  }
}
