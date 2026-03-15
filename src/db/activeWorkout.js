import { db } from './db'

/**
 * Save active workout state to database
 * @param {Object} workoutState - The reducer state to persist
 * @returns {Promise<void>}
 */
export async function saveActiveWorkout(workoutState) {
  // Only save if actively logging (not in picking or summary mode)
  if (workoutState.mode === 'logging') {
    await db.activeWorkout.clear()
    await db.activeWorkout.add({
      state: workoutState,
      savedAt: new Date().toISOString()
    })
  }
}

/**
 * Load active workout state from database
 * @returns {Promise<Object|null>} - The saved reducer state, or null if none
 */
export async function loadActiveWorkout() {
  const records = await db.activeWorkout.toArray()
  if (records.length > 0) {
    return records[0].state
  }
  return null
}

/**
 * Clear the active workout (called on workout completion)
 * @returns {Promise<void>}
 */
export async function clearActiveWorkout() {
  await db.activeWorkout.clear()
}
