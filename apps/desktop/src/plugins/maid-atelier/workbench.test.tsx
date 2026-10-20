import { host, type PluginStorage } from '@hermes/plugin-sdk'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { sessionTitleFromMessage } from './actions'
import { type AtelierProfile, type AtelierRpc, createGateway } from './gateway'
import { portraitSrc } from './portraits'
import { AtelierWorkbench } from './workbench'

function scripted(handler: (profile: AtelierProfile, method: string) => Promise<unknown>): AtelierRpc {
  return handler as AtelierRpc
}

afterEach(() => {
  cleanup()
  window.location.hash = ''
  vi.restoreAllMocks()
  host.openModelPicker(false)
  delete (window as { hermesDesktop?: unknown }).hermesDesktop
})

function storage(): PluginStorage {
  const saved = new Map<string, string>()

  return {
    get(key, fallback) {
      const raw = saved.get(key)

      return raw === undefined ? fallback : JSON.parse(raw)
    },
    set(key, value) {
      saved.set(key, JSON.stringify(value))
    },
    remove(key) {
      saved.delete(key)
    }
  }
}

function gatewayPayload(profileRow: AtelierProfile, method: string): unknown {
  if (method === 'profiles.list') {
    return {
      profiles: [
        {
          name: 'harper',
          display_name: 'Harper',
          canonical_session: { id: 'harper-main', resolved_id: 'harper-main' }
        },
        { name: 'notes', display_name: 'Notes', canonical_session: { id: 'notes-main', resolved_id: 'notes-main' } }
      ]
    }
  }

  if (method === 'session.list') {
    return profileRow.id === 'harper'
      ? { sessions: [{ id: 'deploy', title: 'ch01_deploy.md', preview: 'status: running', started_at: 10 }] }
      : { sessions: [] }
  }

  if (method === 'session.active_list') {
    return { sessions: [] }
  }

  if (method === 'session.resume') {
    return { session_id: 'rt-deploy', stored_session_id: 'deploy', messages: [], running: false }
  }

  if (method === 'session.control.read') {
    return { control: { goal: null } }
  }

  if (method === 'session.create') {
    return { session_id: 'rt-child', stored_session_id: 'child-notes' }
  }

  if (method === 'prompt.submit') {
    return { status: 'streaming' }
  }

  return {}
}

function installFiles(root: string, text: string) {
  const file = `${root}/chapter.md`
  const writeTextFile = vi.fn(async (path: string) => ({ path }))

  Object.assign(window, {
    hermesDesktop: {
      readDir: async (path: string) => ({
        entries: [{ name: 'chapter.md', path: `${path}/chapter.md`, isDirectory: false }]
      }),
      readFileText: async () => ({ path: file, text, truncated: false }),
      writeTextFile
    }
  })

  return { writeTextFile }
}

function gatewayFor(calls: string[]) {
  return createGateway(
    scripted(async (profileRow, method) => {
      calls.push(`${profileRow.id}:${method}`)

      return gatewayPayload(profileRow, method)
    })
  )
}

describe('atelier workbench', () => {
  it('shows the three columns and the honest empty copy', async () => {
    const view = render(
      <AtelierWorkbench gateway={gatewayFor([])} gatewayOpen notify={vi.fn()} storage={storage()} />
    ).container.querySelector('.atelier')

    await screen.findByRole('checkbox', { name: 'In room Notes' })

    expect(view?.querySelector('.atelier-room__face[data-kind="agent"] img')?.getAttribute('src')).toBe(
      portraitSrc('harper')
    )
    expect(screen.queryByRole('button', { name: /change .* face/i })).toBeNull()
    expect(view?.querySelector('[data-atelier-pane="left"]')).toBeTruthy()
    expect(view?.querySelector('[data-atelier-pane="main"]')).toBeTruthy()
    expect(view?.querySelector('[data-atelier-pane="right"]')).toBeTruthy()
    expect(screen.getAllByText('No goal').length).toBeGreaterThan(0)
    expect(screen.getByText('No workspace')).toBeTruthy()
    expect(screen.queryByText('No log')).toBeNull()
    expect(screen.queryByText('No checklist')).toBeNull()
    expect(screen.queryByText('Work queue')).toBeNull()
    expect(screen.queryByText('Workflows')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Draft line' })).toBeNull()
    expect(screen.queryByLabelText('Add a step')).toBeNull()
    expect(screen.queryByText(/sample/i)).toBeNull()
    expect(view?.querySelectorAll('.atelier-section__toggle .atelier-mark').length).toBe(4)
    expect(view?.querySelectorAll('.atelier-section__toggle .atelier-mark--caret-down').length).toBe(2)
    expect(view?.querySelector('.atelier-you img')).toBeTruthy()
    expect(view?.querySelector('.atelier-you .atelier-pip')).toBeTruthy()
    expect(view?.querySelector('.atelier-goalstrip__badge .atelier-mark--goal')).toBeTruthy()
    expect(view?.querySelector('.atelier-goalstrip__badge')?.getAttribute('data-fill')).toBe('#60a5fa')
    expect(view?.querySelector('.atelier-you .atelier-avatar .atelier-pip')?.getAttribute('data-fill')).toBe('#6fbf8a')
    expect(view?.querySelector('.atelier-room__face[data-kind="user"]')?.getAttribute('data-tone')).toBe('online')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-pending')).toBe('#5b8def')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-blocked')).toBe('#d4546a')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-busy')).toBe('#f59e0b')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-online')).toBe('#6fbf8a')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-idle')).toBe('#7ec8c3')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-star')).toBe('#d7b56a')
    expect(view?.querySelector('.atelier-goalstrip__fraction .atelier-mark--process')).toBeTruthy()
    expect(view?.querySelector('.atelier-reader__tab .atelier-mark--folder')).toBeTruthy()
    expect(view?.querySelector('.atelier-reader__toolbar .atelier-mark--copy')).toBeTruthy()
    expect((view?.querySelector('.atelier-reader__source') as HTMLButtonElement | null)?.disabled).toBe(true)
    expect(view?.querySelector('.atelier-model .atelier-mark--chip')).toBeTruthy()
    expect(view?.textContent).toContain('⭐')
    expect(view?.textContent).toContain('🎯')
    expect(view?.textContent).toContain('✨')
    expect(view?.textContent).toContain('📁')
    expect(view?.querySelectorAll('.atelier-emoji').length).toBeGreaterThanOrEqual(6)
    expect(view?.querySelector('.atelier-member input')).toBeTruthy()
  })

  it('paints offline face rings blocked, not online', async () => {
    const view = render(
      <AtelierWorkbench gateway={gatewayFor([])} gatewayOpen={false} notify={vi.fn()} storage={storage()} />
    )

    const face = view.container.querySelector('.atelier-room__face[data-kind="user"]')

    expect(view.container.querySelector('.atelier-you .atelier-avatar .atelier-pip')?.getAttribute('data-fill')).toBe(
      '#d4546a'
    )
    expect(view.container.querySelector('.atelier-you__status')?.getAttribute('data-tone')).toBe('blocked')
    expect(view.container.querySelector('.atelier-you__status .atelier-pip')?.getAttribute('data-fill')).toBe('#d4546a')
    expect(view.container.querySelector('.atelier-you__status')?.textContent).toContain('Offline')
    expect(view.container.querySelector('.atelier-you__status')?.textContent).toContain('⛔')
    expect(view.container.querySelector('.atelier-you__status')?.textContent).not.toContain('🟢')
    expect(face?.getAttribute('data-tone')).toBe('blocked')
    expect(face?.getAttribute('style')).toContain('#d4546a')
    expect(face?.getAttribute('style')).not.toContain('#6fbf8a')
    expect(view.container.querySelector('.atelier-goalstrip__badge')?.getAttribute('data-fill')).toBe('#60a5fa')
    expect(view.container.querySelector('.atelier-mark--plug')).toBeTruthy()
  })

  it('sends an @mention to that agent and does not put the reply in this room', async () => {
    const calls: string[] = []
    const notify = vi.fn()

    const view = render(
      <AtelierWorkbench gateway={gatewayFor(calls)} gatewayOpen notify={notify} storage={storage()} />
    )

    const session = await waitFor(() => {
      const row = view.container.querySelector('.atelier-session')

      if (!row) {
        throw new Error('session row missing')
      }

      return row
    })

    fireEvent.click(session)
    fireEvent.click(screen.getByRole('checkbox', { name: 'In room Notes' }))
    fireEvent.change(screen.getByLabelText('Message the group…'), { target: { value: '@Notes review the diff' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Sent this turn to Notes. The reply stays in that agent's session.", 'info')
    })
    const composer = screen.getByLabelText('Message the group…') as HTMLTextAreaElement

    expect(composer.value).toBe('')
    expect(calls.some(call => call.startsWith('notes:prompt.submit'))).toBe(true)
    expect(calls.some(call => call === 'harper:prompt.submit')).toBe(false)
    expect(screen.queryByText('@Notes review the diff')).toBeNull()
  })

  it('paints a blocked goal and previews the workspace file, not the transcript', async () => {
    installFiles('/work/chapter', '# Clay\n\nMud and whisper.')

    const view = render(
      <AtelierWorkbench
        gateway={createGateway(
          scripted(async (profileRow, method) => {
            if (method === 'profiles.list') {
              return { profiles: [{ name: 'harper', display_name: 'Harper' }] }
            }

            if (method === 'session.list' && profileRow.id === 'harper') {
              return {
                sessions: [{ id: 'deploy', title: 'ch01_deploy.md', preview: '', started_at: 1, cwd: '/work/chapter' }]
              }
            }

            if (method === 'session.active_list') {
              return { sessions: [] }
            }

            if (method === 'session.resume') {
              return {
                session_id: 'rt-deploy',
                stored_session_id: 'deploy',
                messages: [{ role: 'assistant', name: 'Harper', text: 'see @Notes' }],
                pending_approval: { id: 'ask' },
                running: false,
                info: { cwd: '/work/chapter' }
              }
            }

            if (method === 'session.control.read') {
              return { control: { goal: { title: 'Ship the chapter', status: 'blocked' } } }
            }

            return {}
          })
        )}
        gatewayOpen
        notify={vi.fn()}
        storage={storage()}
      />
    )

    const session = await waitFor(() => {
      const row = view.container.querySelector('.atelier-session')

      if (!row) {
        throw new Error('session missing')
      }

      return row
    })

    fireEvent.click(session)
    fireEvent.click(await screen.findByRole('button', { name: 'chapter.md' }))

    await waitFor(() => {
      const reader = view.container.querySelector('[data-atelier-pane="right"]')
      const desk = view.container.querySelector('[data-atelier-pane="main"]')

      expect(reader?.textContent).toContain('Mud and whisper.')
      expect(reader?.textContent).not.toContain('see @Notes')
      expect(desk?.textContent).toContain('see @Notes')
      expect(view.container.querySelector('.atelier-reader__h1')?.textContent).toBe('Clay')
      expect(view.container.querySelector('.atelier-goalstrip')?.textContent).toContain('Ship the chapter')
      expect(view.container.querySelector('.atelier-goalstrip')?.textContent).not.toMatch(/Process \d/)
      expect(view.container.querySelector('.atelier-msg--mention')).toBeTruthy()
    })

    const progress = await screen.findByRole('status', { name: 'Atelier progress' })

    expect(within(progress).getByRole('img', { name: 'Blocked' }).getAttribute('data-fill')).toBe('#d4546a')
    expect(view.container.querySelector('.atelier-session [data-tone="pending"]')?.getAttribute('data-fill')).toBe(
      '#5b8def'
    )
  })

  it('filters the maid list in the rail', async () => {
    const view = render(<AtelierWorkbench gateway={gatewayFor([])} gatewayOpen notify={vi.fn()} storage={storage()} />)

    await screen.findByRole('checkbox', { name: 'In room Notes' })
    const rail = view.container.querySelector('[data-atelier-pane="left"]')

    expect(rail).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'notes' } })

    expect(within(rail as HTMLElement).queryByText('Harper')).toBeNull()
    expect(within(rail as HTMLElement).getByText('Notes')).toBeTruthy()
  })

  it('nests sessions under projects.tree and reads the workspace file', async () => {
    const view = render(
      <AtelierWorkbench
        gateway={createGateway(
          scripted(async (profileRow, method) => {
            if (method === 'profiles.list') {
              return { profiles: [{ name: 'harper', display_name: 'Harper' }] }
            }

            if (method === 'session.list' && profileRow.id === 'harper') {
              return {
                sessions: [
                  {
                    id: 'deploy',
                    title: 'ch01_deploy.md',
                    preview: '',
                    started_at: 1,
                    cwd: '/work/hp02-rewrite/manuscript/volume_1'
                  },
                  { id: 'scratch', title: 'Scratch', preview: '', started_at: 1 }
                ]
              }
            }

            if (method === 'projects.tree') {
              return {
                projects: [
                  {
                    id: 'hp02',
                    label: 'hp02-rewrite',
                    path: '/work/hp02-rewrite',
                    sessionIds: ['deploy']
                  }
                ]
              }
            }

            if (method === 'session.resume') {
              return {
                session_id: 'rt-deploy',
                stored_session_id: 'deploy',
                messages: [{ role: 'assistant', name: 'Harper', text: 'chapter body' }],
                running: false,
                info: { cwd: '/work/hp02-rewrite/manuscript/volume_1' }
              }
            }

            return {}
          })
        )}
        gatewayOpen
        notify={vi.fn()}
        storage={storage()}
      />
    )

    const root = '/work/hp02-rewrite/manuscript/volume_1'
    const { writeTextFile } = installFiles(root, '# Chapter\n\nThe clay god waits.')

    const project = await waitFor(() => {
      const node = view.container.querySelector('[data-atelier-project="hp02-rewrite"]')

      if (!node) {
        throw new Error('project missing')
      }

      return node
    })

    expect(within(project as HTMLElement).getByText('ch01_deploy.md')).toBeTruthy()
    expect(project.querySelector('.atelier-session .atelier-mark--file')).toBeTruthy()
    expect(project.querySelector('.atelier-mark--folder')).toBeTruthy()
    expect(project.querySelector('.atelier-twist .atelier-mark')).toBeTruthy()
    expect(project.querySelector('.atelier-session')).toBeTruthy()
    expect(project.textContent).not.toContain('Scratch')

    fireEvent.click(project.querySelector('.atelier-session') as HTMLElement)

    const reader = () => view.container.querySelector('[data-atelier-pane="right"]')

    await waitFor(() => {
      const path = view.container.querySelector('.atelier-reader__path')

      expect(path?.getAttribute('title')).toBe(root)
      expect(path?.textContent).not.toContain('ch01_deploy.md')
      expect(reader()?.textContent).not.toContain('chapter body')
    })

    fireEvent.click(await screen.findByRole('button', { name: 'chapter.md' }))

    await waitFor(() => {
      const path = view.container.querySelector('.atelier-reader__path')

      expect(path?.textContent).toContain('hp02-rewrite')
      expect(path?.textContent).toContain('manuscript')
      expect(path?.textContent).toContain('volume_1')
      expect(path?.textContent).toContain('chapter.md')
      expect(path?.textContent).not.toContain('Harper')
      expect(path?.textContent).not.toContain('Copy path')
      expect(path?.getAttribute('title')).toBe(`${root}/chapter.md`)
      expect(view.container.querySelector('.atelier-reader__tab')?.textContent).toContain('chapter.md')
      expect(view.container.querySelector('.atelier-reader__tab')?.textContent).toContain('📝')
      expect(reader()?.textContent).toContain('The clay god waits.')
      expect(reader()?.textContent).not.toContain('chapter body')
      expect(view.container.querySelector('[data-atelier-pane="main"]')?.textContent).toContain('chapter body')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    expect(view.container.querySelector('.atelier-reader__h1')).toBeNull()
    expect(view.container.querySelector('.atelier-reader__source-text')?.textContent).toContain('# Chapter')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Edit'), { target: { value: '# Chapter\n\nSaved.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(writeTextFile).toHaveBeenCalledWith(`${root}/chapter.md`, '# Chapter\n\nSaved.')
    })
  })

  it('keeps a local group as a profile list and does not load the other profile sessions', async () => {
    const calls: string[] = []

    const view = render(
      <AtelierWorkbench gateway={gatewayFor(calls)} gatewayOpen notify={vi.fn()} storage={storage()} />
    )

    await screen.findByRole('checkbox', { name: 'In room Notes' })
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'SCP' } })
    fireEvent.click(screen.getByRole('button', { name: 'New group' }))

    const group = await waitFor(() => {
      const node = view.container.querySelector('[data-atelier-group]')

      if (!node) {
        throw new Error('group missing')
      }

      return node
    })

    expect(within(group as HTMLElement).getByText('Harper')).toBeTruthy()
    expect(within(group as HTMLElement).queryByText('Notes')).toBeNull()
    expect(within(group as HTMLElement).getByText('ch01_deploy.md')).toBeTruthy()

    const notes = screen.getByText('Notes').closest('[data-atelier-profile]')

    expect(notes?.closest('[data-atelier-group]')).toBeNull()
    expect(notes?.querySelector('.atelier-session')).toBeNull()
    expect(calls.some(call => call.startsWith('notes:projects.tree'))).toBe(false)
    expect(calls.some(call => call.startsWith('notes:session.resume'))).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse SCP' }))
    expect(within(group as HTMLElement).queryByText('Harper')).toBeNull()
  })

  it('opens the real model picker, settings, and native chat from the desk', async () => {
    const openModelPicker = vi.spyOn(host, 'openModelPicker')

    render(<AtelierWorkbench gateway={gatewayFor([])} gatewayOpen notify={vi.fn()} storage={storage()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose model' }))
    expect(openModelPicker).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(window.location.hash).toBe('#/settings')

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(window.location.hash).toBe('#/')

    const session = await waitFor(() => {
      const row = globalThis.document.querySelector('.atelier-session')

      if (!row) {
        throw new Error('session missing')
      }

      return row
    })

    fireEvent.click(session)
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(window.location.hash).toBe('#/deploy')
  })

  it('creates a session on send when the desk has none, and from New session', async () => {
    const calls: string[] = []
    const titles: string[] = []

    const gateway = createGateway(
      (async (profile, method, params) => {
        calls.push(`${profile.id}:${method}`)

        if (method === 'session.create') {
          titles.push(String(params.title))
        }

        return gatewayPayload(profile, method)
      }) as AtelierRpc
    )

    render(<AtelierWorkbench gateway={gateway} gatewayOpen notify={vi.fn()} storage={storage()} />)

    const composer = await screen.findByLabelText(/Message Harper/)
    fireEvent.change(composer, { target: { value: 'Ship the chapter tonight' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(calls).toContain('harper:session.create')
      expect(calls).toContain('harper:prompt.submit')
    })
    expect(titles).toContain('Ship the chapter tonight')
    expect(sessionTitleFromMessage(`${'Ship the chapter tonight'}\nmore`)).toBe('Ship the chapter tonight')
    expect(sessionTitleFromMessage('x'.repeat(60)).endsWith('…')).toBe(true)
    expect(calls.indexOf('harper:session.create')).toBeLessThan(calls.indexOf('harper:prompt.submit'))

    fireEvent.click(screen.getByRole('button', { name: 'New session' }))

    await waitFor(() => {
      expect(titles.filter(title => title === 'New session').length).toBe(1)
    })
  })
})
