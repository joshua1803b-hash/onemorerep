/**
 * Progression Engine — RPE-driven auto-regulation
 * Pure functions, no side effects
 */

/**
 * Check if a single completed set warrants a weight increase for the next set
 * @param {Object} completedSet - { targetReps, actualReps, rpe, weight, setNumber }
 * @param {number} totalSetsForExercise - to know if this is the last set
 * @param {number} currentSetNumber - 1-indexed
 * @returns {boolean}
 */
export function shouldSuggestWeightIncrease(completedSet, totalSetsForExercise, currentSetNumber) {
  // Don't suggest on the last set
  if (currentSetNumber >= totalSetsForExercise) {
    return false
  }

  const { targetReps, actualReps, rpe } = completedSet

  // Suggest if RPE < 8.5 OR if actual reps exceeded target
  return rpe < 8.5 || actualReps > targetReps
}

/**
 * Compute the weight increment for the next set
 * @param {number} currentWeight
 * @param {string} movementType - 'compound_upper' | 'compound_lower' | 'isolation'
 * @returns {number}
 */
export function computeNextSetWeight(currentWeight, movementType) {
  let increment = 0

  switch (movementType) {
    case 'compound_upper':
      increment = 2.5
      break
    case 'compound_lower':
      increment = 5.0
      break
    case 'isolation':
      increment = 1.25
      break
    default:
      increment = 2.5
  }

  return Number((currentWeight + increment).toFixed(2))
}

/**
 * Compute weight for the next session based on last session RPE
 * @param {Object} progressionState - current progression state
 * @param {Object} lastExerciseData - { exercise, sets } from last workout log
 * @returns {{ weight: number, reason: string | null }}
 */
export function computeSessionWeight(progressionState, lastExerciseData) {
  if (!lastExerciseData) {
    // No previous workout for this exercise
    return {
      weight: progressionState.currentWeight,
      reason: null
    }
  }

  const { exercise, sets } = lastExerciseData

  // Calculate average RPE from last session
  const avgRpe = getAvgRpe(sets)

  // If last session's avg RPE was below 8.5, increase weight
  if (avgRpe < 8.5) {
    const newWeight = computeNextSetWeight(
      progressionState.currentWeight,
      exercise.movementType
    )

    return {
      weight: newWeight,
      reason: 'Weight increased — last session felt easy'
    }
  }

  // Keep current weight
  return {
    weight: progressionState.currentWeight,
    reason: null
  }
}

/**
 * Calculate average RPE from a set of sets
 * @param {Array<Object>} sets - [{ rpe, ... }, ...]
 * @returns {number}
 */
export function getAvgRpe(sets) {
  if (!sets || sets.length === 0) return 8.5

  const total = sets.reduce((sum, set) => sum + (set.rpe || 8.5), 0)
  return total / sets.length
}

/**
 * Check if a weight is a new PR (personal record)
 * @param {number} newWeight
 * @param {Array<Object>} history - progression state history
 * @returns {boolean}
 */
export function checkPR(newWeight, history) {
  if (!history || history.length === 0) {
    return true // First weight is always a PR
  }

  const maxWeight = Math.max(...history.map(h => h.weight || 0))
  return newWeight > maxWeight
}

/**
 * Update progression state after a workout is saved
 * @param {Object} progressionState - current state
 * @param {Object} exercise - from program
 * @param {Array<Object>} completedSets - sets that were just logged
 * @returns {Object} - updated progression state
 */
export function updateProgressionAfterWorkout(progressionState, exercise, completedSets) {
  // Calculate average RPE from this session
  const sessionAvgRpe = getAvgRpe(completedSets)

  // Return updated state (do NOT mutate)
  return {
    ...progressionState,
    lastSessionAvgRpe: sessionAvgRpe,
    lastSessionDate: new Date().toISOString()
  }
}

/**
 * Format RPE for display
 * @param {number} rpe - 6-10
 * @returns {string}
 */
export function formatRPE(rpe) {
  return rpe.toFixed(1)
}

/**
 * Get weight increment label
 * @param {string} movementType
 * @returns {string}
 */
export function getIncrementLabel(movementType) {
  switch (movementType) {
    case 'compound_upper':
      return '+2.5 kg'
    case 'compound_lower':
      return '+5 kg'
    case 'isolation':
      return '+1.25 kg'
    default:
      return '+2.5 kg'
  }
}
