import { describe, expect, it } from 'vitest'

import { emptyProgressCard, memoryShelf, putProgressCard } from './progress-store'

describe('progress card round-trip', () => {
  it('returns the card read back after the write', () => {
    const shelf = memoryShelf()
    const basis = emptyProgressCard('session-1')
    const saved = putProgressCard(shelf, 'progress:session-1', basis, [{ step: 'lint', status: 'completed' }])

    expect(saved?.revision).toBe(1)
    expect(saved?.steps).toEqual([{ step: 'lint', status: 'completed' }])
    expect(shelf.read('progress:session-1')).toEqual(saved)
  })

  it('rejects a write that does not read back', () => {
    const shelf = memoryShelf()

    shelf.write = () => {
      throw new Error('full')
    }

    expect(
      putProgressCard(shelf, 'progress:session-1', emptyProgressCard('session-1'), [
        { step: 'lint', status: 'pending' }
      ])
    ).toBeNull()
    expect(shelf.read('progress:session-1')).toBeNull()
  })
})
