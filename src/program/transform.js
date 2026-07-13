/**
 * Pure transforms between the legacy inline program shape, the reference-based
 * Program Pack, and the hydrated program that the UI consumes.
 *
 * No database imports — unit-testable in isolation.
 */

import { DEFAULT_PROGRESSION_RULES } from './schema'

/**
 * Slugify a name into a stable id: "Jeff Nippard Essentials 4x" -> "jeff_nippard_essentials_4x".
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'pack'
}

/**
 * Epley estimated 1RM. Used by the performance ledger to compare working
 * weights across different rep ranges.
 * @param {number} weight
 * @param {number} reps
 * @returns {number}
 */
export function epley1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return w
  return w * (1 + r / 30)
}

/**
 * Convert a legacy inline program (the shape in seed.js / db.program) into a
 * reference-based Program Pack plus the catalog entries it implies.
 *
 * The legacy exercise shape:
 *   { exerciseId, name, sets, targetReps, startingWeight, muscleGroup,
 *     movementType, alternatives: [{ exerciseId, name }] }
 *
 * @param {Object} program - { name, sessions: [{ label, exercises: [...] }] }
 * @param {Object} [opts]
 * @param {Object} [opts.rules] - progression rules to attach to the pack
 * @param {string} [opts.packId] - override the derived pack id
 * @returns {{ pack: Object, catalogEntries: Object[] }}
 */
export function legacyProgramToPack(program, opts = {}) {
  const rules = opts.rules || program?.progressionRules || DEFAULT_PROGRESSION_RULES
  const packId = opts.packId || program?.packId || slugify(program?.name)

  const catalog = new Map()

  function ensureCatalogEntry(id, name, muscleGroup, movementType) {
    if (!id) return
    const existing = catalog.get(id)
    if (existing) {
      // Fold any newly-seen name in as an alias.
      if (name && !existing.aliases.includes(name)) existing.aliases.push(name)
      // Fill gaps if a later reference has more info.
      if (!existing.muscleGroup && muscleGroup) existing.muscleGroup = muscleGroup
      if (!existing.movementType && movementType) existing.movementType = movementType
      return
    }
    catalog.set(id, {
      canonicalId: id,
      displayName: name || id,
      aliases: name ? [name] : [],
      muscleGroup: muscleGroup || 'general',
      movementType: movementType || 'isolation',
      defaultIncrementKg: incrementFor(movementType, rules)
    })
  }

  const sessions = (program?.sessions || []).map(session => ({
    label: session.label,
    exercises: (session.exercises || []).map(ex => {
      ensureCatalogEntry(ex.exerciseId, ex.name, ex.muscleGroup, ex.movementType)
      const alternatives = (ex.alternatives || []).map(alt => {
        // Alternatives inherit the parent's movement type as a best guess,
        // matching the app's existing swap behaviour.
        ensureCatalogEntry(alt.exerciseId, alt.name, ex.muscleGroup, ex.movementType)
        return alt.exerciseId
      })
      return {
        canonicalId: ex.exerciseId,
        sets: ex.sets,
        targetReps: ex.targetReps,
        seedWeightKg: ex.startingWeight ?? 0,
        note: ex.note || undefined,
        alternatives
      }
    })
  }))

  const pack = {
    packId,
    version: 1,
    name: program?.name || 'Program',
    source: opts.source || { kind: 'builtin' },
    progressionRules: rules,
    sessions
  }

  return { pack, catalogEntries: Array.from(catalog.values()) }
}

/**
 * Resolve the increment for a movement type from a rules object.
 */
export function incrementFor(movementType, rules = DEFAULT_PROGRESSION_RULES) {
  const inc = rules?.incrementsKg || DEFAULT_PROGRESSION_RULES.incrementsKg
  return inc[movementType] ?? inc.isolation ?? 2.5
}

/**
 * Hydrate a single pack exercise into the legacy shape the UI expects, using
 * the catalog for identity and progression/ledger for the working weight.
 *
 * @param {Object} packExercise
 * @param {Object} ctx - { catalog: {id:entry}, progression: {id:state}, ledger: {id:entry} }
 * @returns {Object}
 */
export function hydrateExercise(packExercise, ctx) {
  const cat = ctx.catalog?.[packExercise.canonicalId] || {}
  const prog = ctx.progression?.[packExercise.canonicalId]
  const led = ctx.ledger?.[packExercise.canonicalId]

  // Prefer live progression state, then the ledger's last weight, then the
  // pack's cold-start hint. This preserves existing behaviour for known
  // exercises and carries history forward for newly-referenced ones.
  const startingWeight =
    prog?.currentWeight ??
    led?.lastWeight ??
    packExercise.seedWeightKg ??
    0

  return {
    exerciseId: packExercise.canonicalId,
    name: cat.displayName || packExercise.canonicalId,
    sets: packExercise.sets,
    targetReps: packExercise.targetReps,
    startingWeight,
    muscleGroup: cat.muscleGroup || 'general',
    movementType: cat.movementType || 'isolation',
    note: packExercise.note,
    alternatives: (packExercise.alternatives || []).map(id => ({
      exerciseId: id,
      name: ctx.catalog?.[id]?.displayName || id
    }))
  }
}

/**
 * Hydrate a full pack into the legacy program shape written to db.program.
 * @param {Object} pack
 * @param {Object} ctx - hydration context (catalog, progression, ledger)
 * @returns {Object}
 */
export function hydratePack(pack, ctx) {
  return {
    packId: pack.packId,
    name: pack.name,
    progressionRules: pack.progressionRules || DEFAULT_PROGRESSION_RULES,
    sessions: (pack.sessions || []).map(session => ({
      label: session.label,
      exercises: (session.exercises || []).map(ex => hydrateExercise(ex, ctx))
    }))
  }
}
