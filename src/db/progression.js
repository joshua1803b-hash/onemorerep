import { db } from './db'

/**
 * Get progression state for an exercise
 * @param {string} exerciseId
 * @returns {Promise<Object|undefined>}
 */
export async function getProgressionState(exerciseId) {
  return db.progressionState.get(exerciseId)
}

/**
 * Get progression states for multiple exercises
 * @param {Array<string>} exerciseIds
 * @returns {Promise<Object>} - { exerciseId: state }
 */
export async function getProgressionStates(exerciseIds) {
  const states = await db.progressionState
    .where('exerciseId')
    .anyOf(exerciseIds)
    .toArray()

  const map = {}
  states.forEach(s => {
    map[s.exerciseId] = s
  })
  return map
}

/**
 * Update (upsert) progression state
 * @param {string} exerciseId
 * @param {Object} state
 * @returns {Promise<void>}
 */
export async function updateProgressionState(exerciseId, state) {
  await db.progressionState.put({
    ...state,
    exerciseId,
    lastUpdated: new Date().toISOString()
  })
}

/**
 * Get all progression states
 * @returns {Promise<Array>}
 */
export async function getAllProgressionStates() {
  return db.progressionState.toArray()
}

/**
 * Initialize progression state for an exercise
 * @param {string} exerciseId
 * @param {Object} exercise - from program
 * @returns {Promise<void>}
 */
export async function initializeProgressionState(exerciseId, exercise) {
  const existing = await getProgressionState(exerciseId)
  if (existing) return

  await updateProgressionState(exerciseId, {
    exerciseId,
    currentWeight: exercise.startingWeight || 0,
    repRange: exercise.targetReps,
    lastSessionAvgRpe: null,
    lastSessionDate: null,
    lastUpdated: new Date().toISOString()
  })
}

/**
 * Clear all progression states (for reset)
 * @returns {Promise<void>}
 */
export async function clearProgressionStates() {
  await db.progressionState.clear()
}
