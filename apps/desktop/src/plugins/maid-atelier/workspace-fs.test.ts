import { afterEach, describe, expect, it, vi } from 'vitest'

import { crumbTrail, listWorkspace, readWorkspaceText, workspaceWritable, writeWorkspaceText } from './workspace-fs'

type Bridge = {
  api?: ReturnType<typeof vi.fn>
  readDir?: ReturnType<typeof vi.fn>
  readFileText?: ReturnType<typeof vi.fn>
  writeTextFile?: ReturnType<typeof vi.fn>
}

const desktop = globalThis as { hermesDesktop?: Bridge }

afterEach(() => {
  delete desktop.hermesDesktop
})

describe('crumbTrail', () => {
  it('keeps only real path segments', () => {
    expect(crumbTrail('/work/hp02-rewrite/manuscript/volume_1').map(crumb => crumb.label)).toEqual([
      'work',
      'hp02-rewrite',
      'manuscript',
      'volume_1'
    ])
    expect(crumbTrail('/work/hp02-rewrite/manuscript/volume_1').at(-1)?.path).toBe(
      '/work/hp02-rewrite/manuscript/volume_1'
    )
    expect(crumbTrail('C:\\Users\\linkkchu').map(crumb => crumb.path)).toEqual(['C:', 'C:\\Users', 'C:\\Users\\linkkchu'])
    expect(crumbTrail('')).toEqual([])
  })
})

describe('workspace bridge', () => {
  it('lists and reads through the local desktop bridge', async () => {
    const readDir = vi.fn(async () => ({
      entries: [
        { name: 'notes.txt', path: '/work/notes.txt', isDirectory: false },
        { name: '.git', path: '/work/.git', isDirectory: true },
        { name: 'src', path: '/work/src', isDirectory: true },
        { name: 'node_modules', path: '/work/node_modules', isDirectory: true }
      ]
    }))

    const readFileText = vi.fn(async () => ({ path: '/work/notes.txt', text: '# Note\n\nHello', truncated: false }))

    desktop.hermesDesktop = { readDir, readFileText, writeTextFile: vi.fn() }

    const entries = await listWorkspace('/work', { connectionId: 'local', profile: 'default' })

    expect(entries.map(entry => entry.name)).toEqual(['src', 'notes.txt'])
    expect(readDir).toHaveBeenCalledWith('/work')
    await expect(readWorkspaceText('/work/notes.txt', { connectionId: null, profile: null })).resolves.toMatchObject({
      text: '# Note\n\nHello',
      binary: false
    })
    expect(workspaceWritable({ connectionId: 'local', profile: null })).toBe(true)
  })

  it('writes text only when the bridge can save', async () => {
    const writeTextFile = vi.fn(async (path: string) => ({ path }))

    desktop.hermesDesktop = {
      readDir: vi.fn(),
      readFileText: vi.fn(async () => ({ ok: false, message: 'gone' })),
      writeTextFile
    }

    await writeWorkspaceText('/work/notes.txt', 'next', { connectionId: '', profile: null })
    expect(writeTextFile).toHaveBeenCalledWith('/work/notes.txt', 'next')
    await expect(readWorkspaceText('/work/missing.txt', { connectionId: null, profile: null })).rejects.toThrow('gone')
  })

  it('uses the fs REST bridge for a remote connection', async () => {
    const api = vi.fn(async (request: { method?: string; path: string }) => {
      if (request.path.startsWith('/api/fs/list')) {
        return { entries: [{ name: 'a.md', path: '/remote/a.md', isDirectory: false }] }
      }

      if (request.method === 'POST') {
        return { path: '/remote/a.md' }
      }

      return { path: '/remote/a.md', text: 'remote', binary: false }
    })

    desktop.hermesDesktop = { api }
    const scope = { connectionId: 'ssh-1', profile: 'harper' }

    expect(await listWorkspace('/remote', scope)).toEqual([
      { name: 'a.md', path: '/remote/a.md', isDirectory: false }
    ])
    expect(api).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'ssh-1', profile: 'harper' }))
    await expect(readWorkspaceText('/remote/a.md', scope)).resolves.toMatchObject({ text: 'remote' })
    await writeWorkspaceText('/remote/a.md', 'saved', scope)
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/api/fs/write-text', body: { content: 'saved', path: '/remote/a.md' } })
    )
  })

  it('stays read-only when the window has no save bridge', () => {
    desktop.hermesDesktop = { readDir: vi.fn(), readFileText: vi.fn() }
    expect(workspaceWritable({ connectionId: 'local', profile: null })).toBe(false)
  })
})
