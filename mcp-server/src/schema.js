/**
 * Program Pack validator — fail-closed.
 *
 * Mirrors the app's src/program/schema.js so a pack rejected here would be
 * rejected by the app too. `commit_import` runs this before any write, and on
 * failure returns every problem found and writes nothing.
 */

const VALID_MOVEMENT_TYPES = ['compound_upper', 'compound_lower', 'isolation']

/**
 * Validate a Program Pack. Returns every problem found so an import can be
 * rejected before it touches the database.
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

  if (pack.catalog != null) {
    if (!Array.isArray(pack.catalog)) {
      errors.push('catalog (if present) must be an array of catalog entries')
    } else {
      pack.catalog.forEach((entry, ci) => {
        const res = validateCatalogEntry(entry)
        if (!res.valid) {
          for (const e of res.errors) errors.push(`catalog[${ci}].${e}`)
        }
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate a single catalog entry (for packs that carry their own catalog
 * additions).
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
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}
