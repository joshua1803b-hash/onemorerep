import { db } from './db'

/**
 * Log a completed workout
 * @param {Object} entry - { date, sessionLabel, durationSeconds, exercises: [...] }
 * @returns {Promise<number>} - returns the id
 */
export async function logWorkout(entry) {
  const id = await db.workoutLog.add({
    ...entry,
    date: entry.date || new Date().toISOString()
  })
  return id
}

/**
 * Get workouts (paginated, reverse chronological)
 * @param {Object} options - { limit = 50, offset = 0 }
 * @returns {Promise<Array>}
 */
export async function getWorkouts({ limit = 50, offset = 0 } = {}) {
  return db.workoutLog
    .orderBy('date')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray()
}

/**
 * Get all workouts (for full history)
 * @returns {Promise<Array>}
 */
export async function getAllWorkouts() {
  return db.workoutLog.orderBy('date').reverse().toArray()
}

/**
 * Get a specific workout by id
 * @param {number} id
 * @returns {Promise<Object|undefined>}
 */
export async function getWorkoutById(id) {
  return db.workoutLog.get(id)
}

/**
 * Get last workout for a specific exercise
 * @param {string} exerciseId
 * @returns {Promise<Object|undefined>}
 */
export async function getLastWorkoutForExercise(exerciseId) {
  const workouts = await db.workoutLog.orderBy('date').reverse().toArray()

  for (const workout of workouts) {
    const exercise = workout.exercises?.find(ex => ex.exerciseId === exerciseId)
    if (exercise) {
      return { workout, exercise }
    }
  }

  return null
}

/**
 * Get all workouts containing a specific exercise
 * @param {string} exerciseId
 * @returns {Promise<Array>}
 */
export async function getWorkoutsForExercise(exerciseId) {
  const workouts = await getAllWorkouts()
  return workouts.filter(w =>
    w.exercises?.some(ex => ex.exerciseId === exerciseId)
  )
}
