import { describe, it, expect } from 'vitest'
import {
  compareVersions,
  parseVersionSegments,
  isVersionGreaterThan,
  isVersionLessThan,
  isVersionEqual
} from '../versionCompare'

describe('parseVersionSegments', () => {
  it('splits numeric segments and strips a leading v', () => {
    expect(parseVersionSegments('1.0.0')).toEqual([1, 0, 0])
    expect(parseVersionSegments('v1.0.0')).toEqual([1, 0, 0])
    expect(parseVersionSegments('V2.0.0')).toEqual([2, 0, 0])
    expect(parseVersionSegments('1.0.10')).toEqual([1, 0, 10])
  })
})

describe('compareVersions', () => {
  it('correctly orders 1.0.0 < 1.0.1 < 1.2.0 < 2.0.0', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    expect(compareVersions('1.0.1', '1.2.0')).toBe(-1)
    expect(compareVersions('1.2.0', '2.0.0')).toBe(-1)
    expect(compareVersions('2.0.0', '1.2.0')).toBe(1)
    expect(compareVersions('1.2.0', '1.0.1')).toBe(1)
  })

  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('ignores a leading v', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('V1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('v1.0.1', '1.0.0')).toBe(1)
  })

  it('compares segments numerically, so 1.0.10 > 1.0.2', () => {
    expect(compareVersions('1.0.10', '1.0.2')).toBe(1)
    expect(compareVersions('1.0.2', '1.0.10')).toBe(-1)
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1)
  })

  it('treats missing trailing segments as zero', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('2', '2.0.0')).toBe(0)
    expect(compareVersions('1.0.1', '1.0')).toBe(1)
  })

  it('is symmetric under argument order', () => {
    for (const [a, b] of [
      ['1.0.0', '1.0.1'],
      ['1.2.0', '2.0.0'],
      ['1.0.0', '1.0.0']
    ]) {
      const ba = compareVersions(b, a)
      // Normalize away negative zero so equal versions (0 vs -0) compare equal.
      expect(compareVersions(a, b)).toBe(ba === 0 ? 0 : -ba)
    }
  })
})

describe('comparison helpers (>, <, =)', () => {
  it('supports >', () => {
    expect(isVersionGreaterThan('1.0.10', '1.0.2')).toBe(true)
    expect(isVersionGreaterThan('1.0.0', '1.0.1')).toBe(false)
    expect(isVersionGreaterThan('1.0.0', '1.0.0')).toBe(false)
  })

  it('supports <', () => {
    expect(isVersionLessThan('1.0.0', '1.0.1')).toBe(true)
    expect(isVersionLessThan('1.0.10', '1.0.2')).toBe(false)
    expect(isVersionLessThan('1.0.0', '1.0.0')).toBe(false)
  })

  it('supports =', () => {
    expect(isVersionEqual('1.0.0', '1.0.0')).toBe(true)
    expect(isVersionEqual('v1.0.0', '1.0.0')).toBe(true)
    expect(isVersionEqual('1.0.0', '1.0.1')).toBe(false)
  })
})
