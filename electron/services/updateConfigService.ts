import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/**
 * Update configuration store.
 *
 * Persists the user's update preferences (auto-update on/off and the update
 * channel) to a dedicated JSON file in the app's userData directory. This is
 * intentionally separate from the general `AppSettings` store so update
 * configuration can evolve independently.
 *
 * Channels: "stable" is the only channel selectable today. "beta" and
 * "nightly" are reserved for future use — the type accepts them so stored
 * values round-trip, but nothing offers them to the user yet.
 */

export type UpdateChannel = 'stable' | 'beta' | 'nightly'

export const UPDATE_CHANNELS: readonly UpdateChannel[] = ['stable', 'beta', 'nightly']

export interface UpdateConfig {
  autoUpdate: boolean
  updateChannel: UpdateChannel
}

export const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
  autoUpdate: true,
  updateChannel: 'stable'
}

/**
 * Coerce an arbitrary stored value into a valid UpdateChannel. Unknown values
 * fall back to "stable". "beta" and "nightly" are preserved (reserved for
 * future use) rather than rejected.
 */
export function normalizeUpdateChannel(value: unknown): UpdateChannel {
  return UPDATE_CHANNELS.includes(value as UpdateChannel) ? (value as UpdateChannel) : 'stable'
}

function updateConfigPath(): string {
  return path.join(app.getPath('userData'), 'update-config.json')
}

export class UpdateConfigService {
  static load(): UpdateConfig {
    try {
      const p = updateConfigPath()
      if (!fs.existsSync(p)) return { ...DEFAULT_UPDATE_CONFIG }
      const saved = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>

      return {
        autoUpdate:
          typeof saved.autoUpdate === 'boolean'
            ? saved.autoUpdate
            : DEFAULT_UPDATE_CONFIG.autoUpdate,
        updateChannel: normalizeUpdateChannel(saved.updateChannel)
      }
    } catch {
      return { ...DEFAULT_UPDATE_CONFIG }
    }
  }

  static save(partial: Partial<UpdateConfig>): UpdateConfig {
    const current = this.load()
    const updated: UpdateConfig = {
      autoUpdate: typeof partial.autoUpdate === 'boolean' ? partial.autoUpdate : current.autoUpdate,
      updateChannel:
        partial.updateChannel !== undefined
          ? normalizeUpdateChannel(partial.updateChannel)
          : current.updateChannel
    }

    const p = updateConfigPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8')

    return updated
  }
}
