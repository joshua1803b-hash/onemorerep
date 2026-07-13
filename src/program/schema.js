/**
 * Program Pack schema — the swappable unit of "a training plan".
 *
 * A pack is REFERENCE-BASED: each exercise points at a canonical catalog id
 * rather than baking in a name/weight. Weights are resolved at hydration time
 * from the performance ledger (see src/db/ledger.js), so any imported plan
 * inherits the user's history. `seedWeightKg` is an optional cold-start hint
 * used only when there is no prior history for that movement.
 *
 * Pure module — no database imports — so it can be unit-tested in isolation.
 */

export const PROGRAM_PACK_VERSION = 1

/**
 * Default RPE auto-regulation rules. These match the values that were
 * previously hardcoded in progressionEngine.js, so behaviour is unchanged
 * for the default pack. A pack may override them via `progressionRules`.
 */
export const DEFAULT_PROGRESSION_RULES = {
  rpeIncreaseThreshold: 8.5,
  incrementsKg: {
    compound_upper: 2.5,
    compound_lower: 5.0,
    isolation: 1.25
  }
}

/**
 * Normalise an exercise name for alias/identity matching:
 * lowercase, drop parentheticals like "(Heavy)", collapse to single spaces.
 * @param {string} name
 * @returns {string}
 */
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const VALID_MOVEMENT_TYPES = ['compound_upper', 'compound_lower', 'isolation']

/**
 * Validate a Program Pack. Fail-closed: returns every problem found so an
 * import can be rejected before it touches the database.
 * @param {Object} pack
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProgramPack(pack) {
  const errors = []

  if (!pack || typeof pack !== 'object') {
    return { valid: false, errors: ['Pack must be an object'] }
  }

  if (!isNonEmptyString(pack.packId)) errors.push('packId is required')
  if (!isNonEmptyString(pack.name)) errors.push('name is required')

  if (!Array.isArray(pack.sessions) || pack.sessions.length === 0) {
    errors.push('sessions must be a non-empty array')
  } else {
    pack.sessions.forEach((session, si) => {
      const where = `sessions[${si}]`
      if (!isNonEmptyString(session?.label)) errors.push(`${where}.label is required`)
      if (!Array.isArray(session?.exercises) || session.exercises.length === 0) {
        errors.push(`${where}.exercises must be a non-empty array`)
        return
      }
      session.exercises.forEach((ex, ei) => {
        const exWhere = `${where}.exercises[${ei}]`
        if (!isNonEmptyString(ex?.canonicalId)) errors.push(`${exWhere}.canonicalId is required`)
        if (!isPositiveInt(ex?.sets)) errors.push(`${exWhere}.sets must be a positive integer`)
        if (!isPositiveNumber(ex?.targetReps)) errors.push(`${exWhere}.targetReps must be a positive number`)
        if (ex?.alternatives != null && !isArrayOfStrings(ex.alternatives)) {
          errors.push(`${exWhere}.alternatives must be an array of catalog ids`)
        }
      })
    })
  }

  if (pack.progressionRules != null) {
    const r = pack.progressionRules
    if (typeof r !== 'object') {
      errors.push('progressionRules must be an object')
    } else {
      if (r.rpeIncreaseThreshold != null && typeof r.rpeIncreaseThreshold !== 'number') {
        errors.push('progressionRules.rpeIncreaseThreshold must be a number')
      }
      if (r.incrementsKg != null && typeof r.incrementsKg !== 'object') {
        errors.push('progressionRules.incrementsKg must be an object')
      }
    }
  }

  if (pack.catalog != null && !Array.isArray(pack.catalog)) {
    errors.push('catalog (if present) must be an array of catalog entries')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate a single catalog entry (used when importing packs that carry their
 * own catalog additions).
 * @param {Object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCatalogEntry(entry) {
  const errors = []
  if (!entry || typeof entry !== 'object') return { valid: false, errors: ['entry must be an object'] }
  if (!isNonEmptyString(entry.canonicalId)) errors.push('canonicalId is required')
  if (!isNonEmptyString(entry.displayName)) errors.push('displayName is required')
  if (entry.movementType != null && !VALID_MOVEMENT_TYPES.includes(entry.movementType)) {
    errors.push(`movementType must be one of ${VALID_MOVEMENT_TYPES.join(', ')}`)
  }
  return { valid: errors.length === 0, errors }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}
function isPositiveNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}
function isPositiveInt(v) {
  return isPositiveNumber(v) && Number.isInteger(v)
}
function isArrayOfStrings(v) {
  return Array.isArray(v) && v.every(x => typeof x === 'string')
}
