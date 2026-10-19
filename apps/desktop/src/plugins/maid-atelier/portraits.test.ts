import { describe, expect, it } from 'vitest'

import { FACE_COUNT, normalizeFace, portraitSrc } from './portraits'

describe('atelier portraits', () => {
  it('keeps a stable hash slot and cycles the packaged face set', () => {
    expect(FACE_COUNT).toBe(10)
    expect(portraitSrc('harper')).toBe(portraitSrc('harper'))
    expect(portraitSrc('harper')).toBe(portraitSrc('notes', 1))
    expect(portraitSrc('notes')).toBe(portraitSrc('harper', 6))
    expect(portraitSrc('user')).toBe(portraitSrc('harper', 2))
    expect(portraitSrc('harper', FACE_COUNT)).toBe(portraitSrc('harper', 0))
    expect(portraitSrc('harper', -1)).toBe(portraitSrc('harper', FACE_COUNT - 1))
    expect(normalizeFace(-1)).toBe(FACE_COUNT - 1)

    const faces = new Set(Array.from({ length: FACE_COUNT }, (_, index) => portraitSrc('harper', index)))

    expect(faces.size).toBe(FACE_COUNT)

    for (const src of faces) {
      expect(src).toMatch(/\.webp|image\/webp/)
      expect(src).not.toMatch(/svg\+xml|<svg/i)
    }
  })
})
