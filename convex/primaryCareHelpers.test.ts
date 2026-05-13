import { describe, it, expect } from 'vitest'
import { overlaps, findConflict } from './primaryCareHelpers'

describe('primaryCareHelpers', () => {
  it('overlaps returns true for overlapping ranges', () => {
    expect(overlaps(10, 20, 15, 25)).toBe(true)
    expect(overlaps(10, 20, 20, 30)).toBe(false)
  })

  it('findConflict respects providerId collisions', () => {
    const candidates = [
      { startMs: 1000, endMs: 2000, providerId: 'p1' },
      { startMs: 1500, endMs: 2500, providerId: 'p2' },
    ]

    // conflict when same provider
    const c = findConflict(candidates, { startMs: 1100, endMs: 1200, providerId: 'p1' })
    expect(c).toBeDefined()

    // no conflict when different provider
    const c2 = findConflict(candidates, { startMs: 1100, endMs: 1200, providerId: 'p3' })
    expect(c2).toBeUndefined()

    // clinic-level conflict when provider not provided
    const c3 = findConflict(candidates, { startMs: 1100, endMs: 1200 })
    expect(c3).toBeDefined()
  })

  it('findConflict respects room collisions', () => {
    const candidates = [
      { startMs: 1000, endMs: 2000, providerId: 'p1', roomId: 'r1' },
      { startMs: 1500, endMs: 2500, providerId: 'p2', roomId: 'r2' },
    ]

    // conflict when same room even if provider differs
    const c = findConflict(candidates, { startMs: 1100, endMs: 1200, roomId: 'r1' })
    expect(c).toBeDefined()

    // no conflict when different room and different provider
    const c2 = findConflict(candidates, { startMs: 1100, endMs: 1200, roomId: 'r3' })
    expect(c2).toBeUndefined()
  })
})
