import { db } from '../db/db'
import {
  upsertCatalogExercise,
  upsertCatalogExercises,
  getCatalogMap,
  getAllCatalogExercises
} from '../db/exerciseCatalog'
import { buildLedger } from '../db/ledger'
import { savePack, getPack, listPacks, getActivePackId, setActivePackId } from '../db/programPack'
import { getAllProgressionStates } from '../db/progression'
import { JEFF_NIPPARD_4X } from '../db/seed'
import { validateProgramPack, DEFAULT_PROGRESSION_RULES } from './schema'
import { legacyProgramToPack, hydratePack } from './transform'
import { pushCatalog, pushPack, pullPacks } from '../db/sync'

/**
 * Local Program Provider — the seam between reference-based Program Packs and
 * the hydrated `db.program` the UI renders. Framework-agnostic async functions
 * so they can be reused by a React context, the Me tab, or (later) an MCP.
 *
 * Invariant: activating/importing a pack only ever writes to `program`,
 * `programPack`, `exerciseCatalog` and the `activePackId` setting. It never
 * touches `workoutLog`, `progressionState` or `bodyWeight`, so all logged
 * data survives a plan swap.
 */

/**
 * Build the context needed to hydrate a pack: canonical catalog, live
 * progression states, and the performance ledger (history-derived weights).
 */
async function buildHydrationContext() {
  const [catalog, progressionList, ledger] = await Promise.all([
    getCatalogMap(),
    getAllProgressionStates(),
    buildLedger()
  ])
  const progression = {}
  for (const p of progressionList) progression[p.exerciseId] = p
  return { catalog, progression, ledger }
}

/**
 * Make a stored pack the active plan: hydrate it (resolving names from the
 * catalog and weights from history) and write the result into `db.program`.
 * @param {string} packId
 */
export async function activatePack(packId) {
  const pack = await getPack(packId)
  if (!pack) throw new Error(`Program pack not found: ${packId}`)

  const ctx = await buildHydrationContext()
  const hydrated = hydratePack(pack, ctx)

  await db.transaction('rw', db.program, db.settings, async () => {
    await db.program.clear()
    await db.program.add({
      name: hydrated.name,
      packId: hydrated.packId,
      progressionRules: hydrated.progressionRules,
      sessions: hydrated.sessions,
      createdAt: new Date().toISOString()
    })
    await db.settings.put({ key: 'activePackId', value: packId })
  })

  return hydrated
}

/**
 * Seed + activate the built-in default program (Jeff Nippard 4x). Idempotent:
 * safe to call from onboarding or a "Load Default Program" button.
 */
export async function activateDefaultPack() {
  const { pack, catalogEntries } = legacyProgramToPack(JEFF_NIPPARD_4X, {
    rules: DEFAULT_PROGRESSION_RULES
  })
  await upsertCatalogExercises(catalogEntries)
  await savePack(pack)
  await activatePack(pack.packId)
  pushPackToRemote(pack)
  return pack.packId
}

/**
 * Fire-and-forget push of the current catalog + a pack to Supabase. Never awaits
 * and never throws (offline / missing config is fine — the local write already
 * succeeded before this runs).
 * @param {Object} pack
 */
function pushPackToRemote(pack) {
  getAllCatalogExercises()
    .then(catalog => pushCatalog(catalog))
    .catch(() => {})
  Promise.resolve()
    .then(() => pushPack(pack, { active: true }))
    .catch(() => {})
}

/**
 * Import a pack from raw JSON (paste-in for Phase 1; the MCP will call the same
 * path later). Creates catalog entries for any referenced ids that aren't known
 * yet — from an embedded `catalog` array or from inline fields on the exercise
 * (displayName / muscleGroup / movementType) — then activates the pack.
 * @param {Object|string} rawPack
 * @returns {Promise<string>} the activated packId
 */
export async function importPack(rawPack) {
  const pack = typeof rawPack === 'string' ? JSON.parse(rawPack) : rawPack

  const { valid, errors } = validateProgramPack(pack)
  if (!valid) throw new Error(`Invalid program pack: ${errors.join('; ')}`)

  const known = await getCatalogMap()
  const embedded = new Map((pack.catalog || []).map(e => [e.canonicalId, e]))
  const toCreate = new Map()

  function planNewEntry(id, fallbackName, muscleGroup, movementType) {
    if (!id || known[id] || embedded.has(id) || toCreate.has(id)) return
    toCreate.set(id, {
      canonicalId: id,
      displayName: fallbackName || id,
      aliases: fallbackName ? [fallbackName] : [],
      muscleGroup: muscleGroup || 'general',
      movementType: movementType || 'isolation'
    })
  }

  for (const session of pack.sessions) {
    for (const ex of session.exercises) {
      planNewEntry(ex.canonicalId, ex.displayName, ex.muscleGroup, ex.movementType)
      for (const altId of ex.alternatives || []) {
        planNewEntry(altId, undefined, ex.muscleGroup, ex.movementType)
      }
    }
  }

  // Upsert embedded catalog entries first, then any inferred ones.
  await upsertCatalogExercises(Array.from(embedded.values()))
  await upsertCatalogExercises(Array.from(toCreate.values()))

  await savePack(pack)
  await activatePack(pack.packId)
  pushPackToRemote(pack)
  return pack.packId
}

/**
 * Pull the catalog + packs published remotely (e.g. by the MCP server) into the
 * local DB, and if the remote-active pack differs from the local active pack,
 * switch to it. Best-effort: never throws, so a network failure can't block load.
 * @returns {Promise<void>}
 */
export async function syncPacksFromRemote() {
  try {
    const remoteActiveId = await pullPacks()
    if (!remoteActiveId) return

    const localActiveId = await getActivePackId()
    if (remoteActiveId !== localActiveId) {
      await activatePack(remoteActiveId)
    }
  } catch (err) {
    console.error('Sync: syncPacksFromRemote failed', err)
  }
}

/**
 * One-time migration/backfill. Ensures the pack architecture is populated for
 * existing installs WITHOUT disturbing their current plan or weights:
 * builds the catalog + a pack from whatever program already exists (and folds
 * workoutLog exercise names into the catalog), then registers it active.
 *
 * Fresh installs (no program yet) are left alone — onboarding seeds them.
 */
export async function ensureProgramSystem() {
  const packCount = await db.programPack.count()
  if (packCount > 0) return // already migrated

  const existing = await db.program.toArray()
  if (existing.length === 0) return // fresh install; onboarding will seed

  const program = existing[0]
  const { pack, catalogEntries } = legacyProgramToPack(program, {
    rules: program.progressionRules || DEFAULT_PROGRESSION_RULES,
    packId: program.packId
  })

  await upsertCatalogExercises(catalogEntries)
  await foldWorkoutLogIntoCatalog()
  await savePack(pack)
  await setActivePackId(pack.packId)
  // Intentionally do NOT re-hydrate db.program here: leaving the existing row
  // untouched preserves the user's exact current weights.
}

/**
 * Best-effort: make sure every exercise that appears in the workout log has a
 * catalog entry (as an alias/identity anchor for the ledger).
 */
async function foldWorkoutLogIntoCatalog() {
  const [workouts, catalog] = await Promise.all([
    db.workoutLog.toArray(),
    getCatalogMap()
  ])
  const seen = new Set()
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      if (!ex.exerciseId || catalog[ex.exerciseId] || seen.has(ex.exerciseId)) continue
      seen.add(ex.exerciseId)
      await upsertCatalogExercise({
        canonicalId: ex.exerciseId,
        displayName: ex.name || ex.exerciseId,
        aliases: ex.name ? [ex.name] : []
      })
    }
  }
}

/**
 * Packs available to switch between, with which one is active.
 * @returns {Promise<{ packs: Object[], activePackId: string|null }>}
 */
export async function getAvailablePacks() {
  const [packs, activePackId] = await Promise.all([listPacks(), getActivePackId()])
  return { packs, activePackId }
}
