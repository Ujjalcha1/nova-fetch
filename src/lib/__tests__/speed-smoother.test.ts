import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  pushSpeedSample,
  getSmoothedSpeed,
  computeEta,
  clearSamples
} from '../speed-smoother'

describe('speed-smoother', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    clearSamples('test')
    vi.useRealTimers()
  })

  describe('getSmoothedSpeed', () => {
    it('returns the mean of recent samples', () => {
      pushSpeedSample('test', 1000)
      vi.advanceTimersByTime(250)
      pushSpeedSample('test', 2000)
      vi.advanceTimersByTime(250)
      pushSpeedSample('test', 3000)

      expect(getSmoothedSpeed('test')).toBe(2000)
    })

    it('excludes zero-speed (paused) samples from the average', () => {
      pushSpeedSample('test', 1000)
      pushSpeedSample('test', 2000)
      // Zero samples are pushed while a download is paused and must not
      // drag the displayed speed toward 0 after a resume.
      pushSpeedSample('test', 0)

      expect(getSmoothedSpeed('test')).toBe(1500)
    })

    it('returns 0 when only paused samples exist', () => {
      pushSpeedSample('test', 0)

      expect(getSmoothedSpeed('test')).toBe(0)
    })

    it('drops samples older than the 5s window', () => {
      pushSpeedSample('test', 1000)
      vi.advanceTimersByTime(6000)
      pushSpeedSample('test', 3000)

      expect(getSmoothedSpeed('test')).toBe(3000)
    })

    it('returns 0 for an unknown id', () => {
      expect(getSmoothedSpeed('nope')).toBe(0)
    })
  })

  describe('computeEta', () => {
    it('uses the same smoothed speed as the displayed speed', () => {
      const speed = 2 * 1024 * 1024 // 2 MiB/s
      pushSpeedSample('test', speed)

      const total = 15 * 1024 * 1024
      const downloaded = 5 * 1024 * 1024
      const remaining = total - downloaded

      expect(computeEta('test', downloaded, total)).toBe(remaining / speed)
    })

    it('returns 0 while paused (no positive speed samples)', () => {
      pushSpeedSample('test', 0)

      expect(computeEta('test', 1000, 5000)).toBe(0)
    })

    it('returns 0 for degenerate inputs', () => {
      pushSpeedSample('test', 1024)

      expect(computeEta('test', 0, 5000)).toBe(0) // nothing downloaded
      expect(computeEta('test', 5000, 5000)).toBe(0) // nothing remaining
      expect(computeEta('test', 1000, 0)).toBe(0) // unknown total
      expect(computeEta('test', 1000, 500)).toBe(0) // downloaded > total
    })

    it('reflects a speed drop inside the sampling window', () => {
      pushSpeedSample('test', 2 * 1024 * 1024)
      pushSpeedSample('test', 1024 * 1024)

      // Mean of the two samples: 1.5 MiB/s, remaining: 3 MiB → 2 s
      expect(computeEta('test', 1024 * 1024, 4 * 1024 * 1024)).toBe(2)
    })
  })

  it('clearSamples removes recorded state for an id', () => {
    pushSpeedSample('test', 1024)
    clearSamples('test')

    expect(getSmoothedSpeed('test')).toBe(0)
    expect(computeEta('test', 1000, 5000)).toBe(0)
  })
})
