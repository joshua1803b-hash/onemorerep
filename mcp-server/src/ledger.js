/**
 * The performance ledger — a PROJECTION of workout_log, never authored directly.
 *
 * Mirrors the app's src/db/ledger.js `buildLedger`, but pure/synchronous: it
 * takes the raw rows instead of querying, so the MCP server can build the same
 * per-movement history summary from Supabase `workout_log` rows.
 *
 * Entry shape (per canonicalId):
 *   { canonicalId, lastWeight, bestWeight, est1RM, lastReps, lastDate, sessions }
 */

import { resolveToCanonical } from './resolver.js'

/**
 * Epley estimated 1RM: weight * (1 + reps / 30). Lets working weights be
 * compared across different rep ranges. Matches the app's epley1RM.
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
 * Build the performance ledger from workout_log rows.
 *
 * @param {Object[]} workoutRows - Supabase workout_log rows:
 *   { date, exercises: [{ exerciseId, name, sets: [{ weight, actualReps, completed, ... }] }] }
 * @param {Object[]} catalogList - camelCase catalog entries (for canonical resolution)
 * @returns {Object} - { canonicalId: entry }
 */
export function buildLedger(workoutRows, catalogList) {
  const ledger = {}

  // Process ascending by date so the last workout seen for a movement is the
  // most recent one (drives lastWeight / lastReps / lastDate).
  const workouts = [...(workoutRows || [])].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
  )

  for (const workout of workouts) {
    for (const ex of workout.exercises || []) {
      // Fold logged history onto the current catalog identity; fall back to the
      // raw logged id when the catalog has no match yet.
      const cid = resolveToCanonical(ex.exerciseId, catalogList) || ex.exerciseId
      if (!cid) continue

      const completed = (ex.sets || []).filter((s) => s.completed && (s.weight ?? 0) > 0)
      if (completed.length === 0) continue

      const topSet = completed.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a))
      const workoutBest = topSet.weight ?? 0
      const workout1RM = Math.max(...completed.map((s) => epley1RM(s.weight, s.actualReps)))

      const entry = ledger[cid] || {
        canonicalId: cid,
        lastWeight: 0,
        lastReps: null,
        lastDate: null,
        bestWeight: 0,
        est1RM: 0,
        sessions: 0
      }

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
