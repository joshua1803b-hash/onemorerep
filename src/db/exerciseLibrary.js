import { db } from './db'

/**
 * Save a custom exercise to the library
 * @param {Object} exercise - { exerciseId, name, parentExerciseId, movementType, startingWeight, isCustom }
 */
export async function saveCustomExercise(exercise) {
  await db.exerciseLibrary.put({
    ...exercise,
    createdAt: new Date().toISOString()
  })
}

/**
 * Get all custom exercises for a specific parent exercise
 * @param {string} parentExerciseId
 * @returns {Promise<Array>}
 */
export async function getCustomExercisesForParent(parentExerciseId) {
  return db.exerciseLibrary
    .where('parentExerciseId')
    .equals(parentExerciseId)
    .toArray()
}

/**
 * Get all exercises in the library
 * @returns {Promise<Array>}
 */
export async function getAllCustomExercises() {
  return db.exerciseLibrary.toArray()
}

/**
 * Delete a custom exercise from the library
 * @param {string} exerciseId
 */
export async function deleteCustomExercise(exerciseId) {
  await db.exerciseLibrary.delete(exerciseId)
}
