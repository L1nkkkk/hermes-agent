import { describe, expect, it, vi } from 'vitest'

import { dispatchMaidMentionTurn } from './routing'

const notes = { id: 'notes', name: 'Notes' }

describe('mention dispatch', () => {
  it('sends to the room child and does not create another session', async () => {
    const submit = vi.fn(async () => undefined)
    const createChild = vi.fn(async () => 'new')
    const mainSession = vi.fn(async () => 'main')

    await expect(
      dispatchMaidMentionTurn({
        route: { agent: notes, childKey: 'child-1' },
        message: '@Notes review',
        roomTitle: 'desk',
        dispatch: { submit, createChild, mainSession }
      })
    ).resolves.toBe('child')

    expect(submit).toHaveBeenCalledWith('notes', 'child-1', '@Notes review')
    expect(createChild).not.toHaveBeenCalled()
    expect(mainSession).not.toHaveBeenCalled()
  })

  it('creates a child when the room has none', async () => {
    const submit = vi.fn(async () => undefined)

    await expect(
      dispatchMaidMentionTurn({
        route: { agent: notes },
        message: '@Notes review',
        roomTitle: 'desk',
        dispatch: {
          submit,
          createChild: async () => 'created-1',
          mainSession: async () => 'main'
        }
      })
    ).resolves.toBe('created')

    expect(submit).toHaveBeenCalledWith('notes', 'created-1', '@Notes review')
  })

  it('uses the main session only when a child cannot be created', async () => {
    const submit = vi.fn(async () => undefined)

    await expect(
      dispatchMaidMentionTurn({
        route: { agent: notes },
        message: '@Notes review',
        roomTitle: 'desk',
        dispatch: {
          submit,
          createChild: async () => {
            throw new Error('no child')
          },
          mainSession: async () => 'main-notes'
        }
      })
    ).resolves.toBe('main')

    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('notes', 'main-notes', '@Notes review')
  })
})
