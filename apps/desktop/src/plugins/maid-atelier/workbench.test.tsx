import type { PluginStorage } from '@hermes/plugin-sdk'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type AtelierProfile, type AtelierRpc, createGateway } from './gateway'
import { portraitSrc } from './portraits'
import { AtelierWorkbench } from './workbench'

function scripted(handler: (profile: AtelierProfile, method: string) => Promise<unknown>): AtelierRpc {
  return handler as AtelierRpc
}

afterEach(() => {
  cleanup()
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

function gatewayFor(calls: string[]) {
  return createGateway(
    scripted(async (profileRow, method) => {
      calls.push(`${profileRow.id}:${method}`)

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
    })
  )
}

describe('atelier workbench', () => {
  it('shows the three columns and the honest empty copy', async () => {
    render(<AtelierWorkbench gateway={gatewayFor([])} gatewayOpen notify={vi.fn()} storage={storage()} />)

    const face = await screen.findByRole('button', { name: "Change Harper's face" })

    expect(face.querySelector('img')?.getAttribute('src')).toBe(portraitSrc('harper'))
    const view = screen.getByRole('button', { name: "Change Harper's face" }).closest('.atelier')

    expect(view?.querySelector('[data-atelier-pane="left"]')).toBeTruthy()
    expect(view?.querySelector('[data-atelier-pane="main"]')).toBeTruthy()
    expect(view?.querySelector('[data-atelier-pane="right"]')).toBeTruthy()
    expect(screen.getAllByText('No goal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('No log').length).toBeGreaterThan(0)
    expect(screen.getAllByText('No checklist').length).toBeGreaterThan(0)
    expect(screen.queryByText(/sample/i)).toBeNull()
    expect(view?.querySelectorAll('.atelier-section__toggle .atelier-mark').length).toBe(8)
    expect(view?.querySelectorAll('.atelier-section__toggle .atelier-mark--caret-down').length).toBe(4)
    expect(view?.querySelector('.atelier-you img')).toBeTruthy()
    expect(view?.querySelector('.atelier-you .atelier-pip')).toBeTruthy()
    expect(view?.querySelector('.atelier-goalstrip__badge .atelier-mark--goal')).toBeTruthy()
    expect(view?.querySelector('.atelier-goalstrip__badge')?.getAttribute('data-fill')).toBe('#60a5fa')
    expect(view?.querySelector('.atelier-you .atelier-avatar .atelier-pip')?.getAttribute('data-fill')).toBe('#6fbf8a')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-pending')).toBe('#5b8def')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-blocked')).toBe('#d4546a')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-busy')).toBe('#f59e0b')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-online')).toBe('#6fbf8a')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-idle')).toBe('#7ec8c3')
    expect((view as HTMLElement).style.getPropertyValue('--atelier-star')).toBe('#d7b56a')
    expect(view?.querySelector('.atelier-goalstrip__fraction .atelier-mark--process')).toBeTruthy()
    expect(view?.querySelector('.atelier-reader__tab .atelier-mark--file')).toBeTruthy()
    expect(view?.querySelector('.atelier-reader__toolbar .atelier-mark--copy')).toBeTruthy()
    expect((view?.querySelector('.atelier-reader__source') as HTMLButtonElement | null)?.disabled).toBe(true)
    expect(view?.querySelector('.atelier-model .atelier-mark--chip')).toBeTruthy()
    expect(view?.querySelector('.atelier-member input')).toBeTruthy()
  })

  it('keeps the local user green and paints gateway-down as blocked', async () => {
    const view = render(
      <AtelierWorkbench gateway={gatewayFor([])} gatewayOpen={false} notify={vi.fn()} storage={storage()} />
    )

    expect(view.container.querySelector('.atelier-you .atelier-avatar .atelier-pip')?.getAttribute('data-fill')).toBe(
      '#6fbf8a'
    )
    expect(view.container.querySelector('.atelier-you__status')?.getAttribute('data-tone')).toBe('blocked')
    expect(view.container.querySelector('.atelier-you__status .atelier-pip')?.getAttribute('data-fill')).toBe('#d4546a')
    expect(view.container.querySelector('.atelier-you__status')?.textContent).toContain('Offline')
    expect(view.container.querySelector('.atelier-goalstrip__badge')?.getAttribute('data-fill')).toBe('#60a5fa')
    expect(view.container.querySelector('.atelier-mark--plug')).toBeTruthy()
  })

  it('drafts a pull line without inviting the agent', async () => {
    render(<AtelierWorkbench gateway={gatewayFor([])} gatewayOpen notify={vi.fn()} storage={storage()} />)

    await screen.findByRole('checkbox', { name: 'In room Notes' })
    fireEvent.click(screen.getByRole('button', { name: 'Draft line' }))
    const menu = screen.getByRole('group')
    fireEvent.click(within(menu).getByRole('button', { name: 'Notes' }))

    const composer = screen.getByLabelText(/Message Harper/) as HTMLTextAreaElement
    const member = screen.getByRole('checkbox', { name: 'In room Notes' }) as HTMLInputElement

    expect(composer.value).toBe('Pull Notes into this conversation.')
    expect(member.checked).toBe(false)
  })

  it('saves a work step through a read-back and does not put the @ reply in the room', async () => {
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
    const step = screen.getByLabelText('Add a step')
    fireEvent.change(step, { target: { value: 'lint' } })
    fireEvent.keyDown(step, { key: 'Enter' })

    const boxes = await screen.findAllByRole('checkbox', { name: 'lint' })
    expect(screen.getAllByText('Process 0/1').length).toBeGreaterThan(0)
    expect(boxes[0]?.getAttribute('aria-checked')).toBe('false')
    expect(boxes[0]?.querySelector('[data-fill]')?.getAttribute('data-fill')).toBe('#5b8def')
    fireEvent.click(boxes[0]!)
    expect(screen.getAllByRole('checkbox', { name: 'lint' })[0]?.getAttribute('aria-checked')).toBe('true')

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

  it('paints a blocked goal with the blocked fill and opens a manuscript in the reader', async () => {
    const view = render(
      <AtelierWorkbench
        gateway={createGateway(
          scripted(async (profileRow, method) => {
            if (method === 'profiles.list') {
              return { profiles: [{ name: 'harper', display_name: 'Harper' }] }
            }

            if (method === 'session.list' && profileRow.id === 'harper') {
              return { sessions: [{ id: 'deploy', title: 'ch01_deploy.md', preview: '', started_at: 1 }] }
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
                running: false
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

    const manuscript = await waitFor(() => {
      const row = view.container.querySelector('[data-manuscript="true"]')

      if (!row) {
        throw new Error('manuscript missing')
      }

      return row
    })

    fireEvent.click(manuscript)

    await waitFor(() => {
      const path = view.container.querySelector('.atelier-reader__path')

      expect(path?.textContent).toContain('ch01_deploy.md')
      expect(path?.textContent).not.toContain('Harper')
      expect(path?.textContent).not.toContain('manuscript')
      expect(view.container.querySelector('.atelier-goalstrip')?.textContent).toContain('Ship the chapter')
      expect(view.container.querySelector('.atelier-goalstrip')?.textContent).not.toMatch(/Process \d/)
      expect(view.container.querySelector('.atelier-reader__h1')).toBeTruthy()
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

  it('nests the selected profile sessions under projects.tree and crumbs the real cwd', async () => {
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

    const manuscript = view.container.querySelector('[data-manuscript="true"]')

    if (!manuscript) {
      throw new Error('manuscript missing')
    }

    fireEvent.click(manuscript)

    await waitFor(() => {
      const path = view.container.querySelector('.atelier-reader__path')

      expect(path?.textContent).toContain('hp02-rewrite')
      expect(path?.textContent).toContain('manuscript')
      expect(path?.textContent).toContain('volume_1')
      expect(path?.textContent).toContain('ch01_deploy.md')
      expect(path?.textContent).not.toContain('Harper')
      expect(path?.textContent).not.toContain('Copy path')
      expect(path?.getAttribute('title')).toBe('/work/hp02-rewrite/manuscript/volume_1/ch01_deploy.md')
      expect(view.container.querySelector('.atelier-reader__tab')?.textContent).toBe('ch01_deploy.md')
      expect(view.container.querySelector('.atelier-reader__copy')?.textContent).toBe('Copy path')
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
})
