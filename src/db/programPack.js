import { db } from './db'
import { validateProgramPack } from '../program/schema'

/**
 * Storage for reference-based Program Packs (the swappable plan unit) and the
 * pointer to the currently active pack.
 */

const ACTIVE_PACK_KEY = 'activePackId'

/**
 * Persist a pack (validated, fail-closed). Strips any inline `catalog` array —
 * catalog additions are stored separately in exerciseCatalog.
 * @param {Object} pack
 * @returns {Promise<void>}
 */
export async function savePack(pack) {
  const { valid, errors } = validateProgramPack(pack)
  if (!valid) {
    throw new Error(`Invalid program pack: ${errors.join('; ')}`)
  }
  const { catalog, ...rest } = pack
  await db.programPack.put({
    ...rest,
    updatedAt: new Date().toISOString()
  })
}

/**
 * @param {string} packId
 * @returns {Promise<Object|undefined>}
 */
export async function getPack(packId) {
  return db.programPack.get(packId)
}

/**
 * @returns {Promise<Object[]>}
 */
export async function listPacks() {
  return db.programPack.toArray()
}

/**
 * @returns {Promise<string|null>}
 */
export async function getActivePackId() {
  const setting = await db.settings.get(ACTIVE_PACK_KEY)
  return setting?.value ?? null
}

/**
 * @param {string} packId
 */
export async function setActivePackId(packId) {
  await db.settings.put({ key: ACTIVE_PACK_KEY, value: packId })
}
