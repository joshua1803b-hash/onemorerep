/**
 * Pure exercise-name resolution — no database, no I/O.
 *
 * Mirrors the app's identity layer (src/program/schema.js `normalizeName` and
 * src/db/exerciseCatalog.js `resolveToCanonical`) so the MCP server matches
 * free-text exercise names to catalog `canonicalId`s exactly the way the app
 * does. Reused by both the `resolve_exercise` tool and `preview_import`.
 *
 * Catalog entries are the camelCase shape the app uses internally:
 *   { canonicalId, displayName, aliases[], muscleGroup, movementType,
 *     equipment?, defaultIncrementKg? }
 */

/**
 * Normalise an exercise name for identity matching: lowercase, drop
 * parentheticals like "(Heavy)", collapse every run of non-alphanumeric
 * characters to a single space, trim. Identical to the app's normalizeName.
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

/**
 * Union of alias lists, preserving first-seen order and never dropping a known
 * variant. The display name is folded in so it is always resolvable as an alias.
 * @param {string[]} [existing]
 * @param {string[]} [incoming]
 * @param {string} [displayName]
 * @returns {string[]}
 */
export function unionAliases(existing, incoming, displayName) {
  const out = []
  const seen = new Set()
  const push = (v) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (!t) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }
  for (const a of existing || []) push(a)
  for (const a of incoming || []) push(a)
  push(displayName)
  return out
}

// Confidence scores per match tier.
const SCORE_EXACT_ID = 1.0
const SCORE_EXACT_ALIAS = 0.95
const SCORE_NORMALIZED = 0.85

/**
 * Resolve a raw id-or-name to a canonical id, returning null if nothing matches.
 * Matching order: exact canonical_id, exact alias/display_name, normalized-name.
 * Used by the ledger to fold logged history onto the current catalog identity.
 * @param {string} idOrName
 * @param {Object[]} catalogList - camelCase catalog entries
 * @returns {string|null}
 */
export function resolveToCanonical(idOrName, catalogList) {
  if (!idOrName) return null
  const list = catalogList || []

  const byId = list.find((e) => e.canonicalId === idOrName)
  if (byId) return byId.canonicalId

  const byAlias = list.find(
    (e) => e.displayName === idOrName || (e.aliases || []).includes(idOrName)
  )
  if (byAlias) return byAlias.canonicalId

  const norm = normalizeName(idOrName)
  if (!norm) return null
  const byNorm = list.find(
    (e) =>
      normalizeName(e.displayName) === norm ||
      (e.aliases || []).some((a) => normalizeName(a) === norm)
  )
  if (byNorm) return byNorm.canonicalId

  return null
}

/**
 * Rank catalog matches for a single free-text name.
 *
 * @param {string} name - raw name or canonical id from a plan
 * @param {Object[]} catalogList - camelCase catalog entries
 * @param {Object} [hints] - optional { muscleGroup, movementType, equipment }
 *   used only to break ties between otherwise-equal candidates
 * @returns {{ status: 'matched'|'ambiguous'|'new', candidates: Array<{ canonicalId: string, displayName: string, score: number }> }}
 */
export function resolveExercise(name, catalogList, hints = {}) {
  const list = catalogList || []
  const query = String(name || '')

  // Best score per canonicalId across all tiers.
  const best = new Map() // canonicalId -> { canonicalId, displayName, score }
  const consider = (entry, score) => {
    const prev = best.get(entry.canonicalId)
    if (!prev || score > prev.score) {
      best.set(entry.canonicalId, {
        canonicalId: entry.canonicalId,
        displayName: entry.displayName || entry.canonicalId,
        score
      })
    }
  }

  const norm = normalizeName(query)
  for (const entry of list) {
    if (entry.canonicalId === query) {
      consider(entry, SCORE_EXACT_ID)
      continue
    }
    if (entry.displayName === query || (entry.aliases || []).includes(query)) {
      consider(entry, SCORE_EXACT_ALIAS)
      continue
    }
    if (norm) {
      const normHit =
        normalizeName(entry.displayName) === norm ||
        (entry.aliases || []).some((a) => normalizeName(a) === norm)
      if (normHit) consider(entry, SCORE_NORMALIZED)
    }
  }

  let candidates = Array.from(best.values()).sort((a, b) => b.score - a.score)

  if (candidates.length === 0) {
    return { status: 'new', candidates: [] }
  }

  // Keep only the highest-confidence tier — a lower-tier fuzzy hit should not
  // make an otherwise-clean exact match look ambiguous.
  const topScore = candidates[0].score
  let top = candidates.filter((c) => c.score === topScore)

  // Optional hint-based tie-break when several equal-score candidates remain.
  if (top.length > 1 && hints && (hints.equipment || hints.muscleGroup || hints.movementType)) {
    const byId = new Map(list.map((e) => [e.canonicalId, e]))
    const hintMatch = top.filter((c) => {
      const e = byId.get(c.canonicalId) || {}
      if (hints.equipment && e.equipment && e.equipment !== hints.equipment) return false
      if (hints.muscleGroup && e.muscleGroup && e.muscleGroup !== hints.muscleGroup) return false
      if (hints.movementType && e.movementType && e.movementType !== hints.movementType) return false
      return true
    })
    if (hintMatch.length === 1) top = hintMatch
  }

  if (top.length === 1) {
    return { status: 'matched', candidates }
  }
  return { status: 'ambiguous', candidates }
}
