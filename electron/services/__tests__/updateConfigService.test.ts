import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-config-test-'))

vi.mock('electron', () => ({
  app: { getPath: () => testDir }
}))

import {
  UpdateConfigService,
  normalizeUpdateChannel,
  UPDATE_CHANNELS,
  DEFAULT_UPDATE_CONFIG
} from '../updateConfigService'

const CONFIG_PATH = path.join(testDir, 'update-config.json')

describe('normalizeUpdateChannel', () => {
  it('accepts all declared channels', () => {
    expect(normalizeUpdateChannel('stable')).toBe('stable')
    expect(normalizeUpdateChannel('beta')).toBe('beta')
    expect(normalizeUpdateChannel('nightly')).toBe('nightly')
  })

  it('falls back to stable for unknown values', () => {
    expect(normalizeUpdateChannel('canary')).toBe('stable')
    expect(normalizeUpdateChannel('')).toBe('stable')
    expect(normalizeUpdateChannel(undefined)).toBe('stable')
    expect(normalizeUpdateChannel(42)).toBe('stable')
  })
})

describe('UpdateConfigService', () => {
  beforeEach(() => {
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH)
  })

  it('returns defaults when no config file exists', () => {
    expect(UpdateConfigService.load()).toEqual(DEFAULT_UPDATE_CONFIG)
  })

  it('persists and reloads the full config', () => {
    const saved = UpdateConfigService.save({ autoUpdate: false, updateChannel: 'stable' })
    expect(saved).toEqual({ autoUpdate: false, updateChannel: 'stable' })
    expect(UpdateConfigService.load()).toEqual({ autoUpdate: false, updateChannel: 'stable' })
  })

  it('merges partial saves with existing values', () => {
    UpdateConfigService.save({ autoUpdate: false })
    const saved = UpdateConfigService.save({ updateChannel: 'stable' })
    expect(saved).toEqual({ autoUpdate: false, updateChannel: 'stable' })
  })

  it('normalizes invalid stored channels on load', () => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ autoUpdate: true, updateChannel: 'canary' }))
    expect(UpdateConfigService.load()).toEqual({ autoUpdate: true, updateChannel: 'stable' })
  })

  it('preserves reserved channels when stored', () => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ autoUpdate: true, updateChannel: 'nightly' }))
    expect(UpdateConfigService.load()).toEqual({ autoUpdate: true, updateChannel: 'nightly' })
  })

  it('falls back to defaults for invalid autoUpdate', () => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ autoUpdate: 'yes', updateChannel: 'stable' }))
    expect(UpdateConfigService.load()).toEqual(DEFAULT_UPDATE_CONFIG)
  })

  it('returns defaults when the file is corrupt', () => {
    fs.writeFileSync(CONFIG_PATH, '{ not json')
    expect(UpdateConfigService.load()).toEqual(DEFAULT_UPDATE_CONFIG)
  })

  it('declares exactly the three channels', () => {
    expect(UPDATE_CHANNELS).toEqual(['stable', 'beta', 'nightly'])
  })
})
