import { db } from './db'
import { epley1RM } from '../program/transform'
import { resolveToCanonical } from './exerciseCatalog'

/**
 * The performance ledger — a PROJECTION of workoutLog, never authored directly.
 * For each canonical movement it summarises what the user has actually lifted,
 * so any plan (or manual swap) can seed the right working weight from history.
 *
 * Because it is derived, it can be rebuilt at any time and can never drift from
 * the ground-truth log.
 *
 * Entry shape:
 *   { canonicalId, lastWeight, lastReps, lastDate, bestWeight, est1RM, sessions }
 */

/**
 * Build the full ledger from workoutLog.
 * @returns {Promise<Object>} - { canonicalId: entry }
 */
export async function buildLedger() {
  const [workouts, catalogList] = await Promise.all([
    db.workoutLog.orderBy('date').toArray(), // ascending
    db.exerciseCatalog.toArray()
  ])

  const ledger = {}

  for (const workout of workouts) {
    for (const ex of workout.exercises || []) {
      // Resolve to a canonical id so history logged under an old/aliased id
      // still counts toward the current catalog entry. Falls back to the raw
      // id when the catalog has no match yet.
      const cid = (await resolveToCanonical(ex.exerciseId, catalogList)) || ex.exerciseId
      if (!cid) continue

      const completed = (ex.sets || []).filter(s => s.completed && (s.weight ?? 0) > 0)
      if (completed.length === 0) continue

      const topSet = completed.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a))
      const workoutBest = topSet.weight ?? 0
      const workout1RM = Math.max(...completed.map(s => epley1RM(s.weight, s.actualReps)))

      const entry = ledger[cid] || {
        canonicalId: cid,
        lastWeight: 0,
        lastReps: null,
        lastDate: null,
        bestWeight: 0,
        est1RM: 0,
        sessions: 0
      }

      // workouts are ascending, so the last one seen is the most recent.
      entry.lastWeight = workoutBest
      entry.lastReps = topSet.actualReps ?? null
      entry.lastDate = workout.date
      entry.bestWeight = Math.max(entry.bestWeight, workoutBest)
      entry.est1RM = Math.max(entry.est1RM, workout1RM)
      entry.sessions += 1

      ledger[cid] = entry
    }
  }

  return ledger
}

/**
 * Get the ledger entry for a single movement.
 * @param {string} canonicalId
 * @returns {Promise<Object|null>}
 */
export async function getLedgerEntry(canonicalId) {
  const ledger = await buildLedger()
  return ledger[canonicalId] || null
}
