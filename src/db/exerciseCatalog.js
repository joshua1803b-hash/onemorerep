import { db } from './db'
import { normalizeName } from '../program/schema'

/**
 * The canonical exercise catalog — one row per real-world movement, independent
 * of any training plan. This is the identity layer that lets logged history and
 * weights carry across plan swaps.
 *
 * Row shape:
 *   { canonicalId, displayName, aliases[], muscleGroup, movementType,
 *     equipment?, defaultIncrementKg?, createdAt, updatedAt }
 */

/**
 * Insert or merge a catalog entry. Aliases are unioned, not replaced, so the
 * catalog accumulates known name variants over time.
 * @param {Object} entry
 * @returns {Promise<void>}
 */
export async function upsertCatalogExercise(entry) {
  if (!entry?.canonicalId) return
  const now = new Date().toISOString()
  const existing = await db.exerciseCatalog.get(entry.canonicalId)

  const merged = {
    canonicalId: entry.canonicalId,
    displayName: entry.displayName || existing?.displayName || entry.canonicalId,
    aliases: unionAliases(existing?.aliases, entry.aliases, entry.displayName),
    muscleGroup: entry.muscleGroup || existing?.muscleGroup || 'general',
    movementType: entry.movementType || existing?.movementType || 'isolation',
    equipment: entry.equipment ?? existing?.equipment ?? null,
    defaultIncrementKg: entry.defaultIncrementKg ?? existing?.defaultIncrementKg ?? null,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }

  await db.exerciseCatalog.put(merged)
}

/**
 * Bulk upsert catalog entries (used during backfill/import).
 * @param {Object[]} entries
 */
export async function upsertCatalogExercises(entries) {
  for (const entry of entries || []) {
    await upsertCatalogExercise(entry)
  }
}

/**
 * @param {string} canonicalId
 * @returns {Promise<Object|undefined>}
 */
export async function getCatalogExercise(canonicalId) {
  return db.exerciseCatalog.get(canonicalId)
}

/**
 * @returns {Promise<Object[]>}
 */
export async function getAllCatalogExercises() {
  return db.exerciseCatalog.toArray()
}

/**
 * @returns {Promise<Object>} - { canonicalId: entry }
 */
export async function getCatalogMap() {
  const all = await db.exerciseCatalog.toArray()
  const map = {}
  for (const e of all) map[e.canonicalId] = e
  return map
}

/**
 * Add a name variant to an existing catalog entry.
 * @param {string} canonicalId
 * @param {string} alias
 */
export async function addAlias(canonicalId, alias) {
  const existing = await db.exerciseCatalog.get(canonicalId)
  if (!existing) return
  existing.aliases = unionAliases(existing.aliases, [alias])
  existing.updatedAt = new Date().toISOString()
  await db.exerciseCatalog.put(existing)
}

/**
 * Resolve a raw id-or-name to a canonical id: exact id, then exact alias,
 * then normalised-name match. Returns null if nothing matches.
 * @param {string} idOrName
 * @param {Object[]} [catalogList] - optional pre-fetched list to avoid a query
 * @returns {Promise<string|null>}
 */
export async function resolveToCanonical(idOrName, catalogList) {
  if (!idOrName) return null
  const list = catalogList || (await db.exerciseCatalog.toArray())

  // 1. exact canonical id
  const byId = list.find(e => e.canonicalId === idOrName)
  if (byId) return byId.canonicalId

  // 2. exact alias / display name
  const byAlias = list.find(
    e => e.displayName === idOrName || (e.aliases || []).includes(idOrName)
  )
  if (byAlias) return byAlias.canonicalId

  // 3. normalised name
  const norm = normalizeName(idOrName)
  const byNorm = list.find(
    e =>
      normalizeName(e.displayName) === norm ||
      (e.aliases || []).some(a => normalizeName(a) === norm)
  )
  if (byNorm) return byNorm.canonicalId

  return null
}
