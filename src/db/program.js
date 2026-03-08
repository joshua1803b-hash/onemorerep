import { db } from './db'

/**
 * Get the single program
 * @returns {Promise<Object|null>}
 */
export async function getProgram() {
  const programs = await db.program.toArray()
  return programs.length > 0 ? programs[0] : null
}

/**
 * Save a program (full replace)
 * @param {Object} program
 * @returns {Promise<void>}
 */
export async function saveProgram(program) {
  await db.program.clear()
  await db.program.add({
    ...program,
    createdAt: program.createdAt || new Date().toISOString()
  })
}

/**
 * Update exercises in a session
 * @param {string} sessionLabel - e.g. 'Push'
 * @param {Array} exercises
 * @returns {Promise<void>}
 */
export async function updateSessionExercises(sessionLabel, exercises) {
  const program = await getProgram()
  if (!program) return

  const updated = {
    ...program,
    sessions: program.sessions.map(session =>
      session.label === sessionLabel
        ? { ...session, exercises }
        : session
    )
  }
  await db.program.update(program.id, updated)
}

/**
 * Reorder exercises within a session
 * @param {string} sessionLabel
 * @param {Array<Object>} reorderedExercises
 * @returns {Promise<void>}
 */
export async function reorderExercises(sessionLabel, reorderedExercises) {
  await updateSessionExercises(sessionLabel, reorderedExercises)
}

/**
 * Remove an exercise from a session
 * @param {string} sessionLabel
 * @param {string} exerciseId
 * @returns {Promise<void>}
 */
export async function removeExercise(sessionLabel, exerciseId) {
  const program = await getProgram()
  if (!program) return

  const updated = {
    ...program,
    sessions: program.sessions.map(session =>
      session.label === sessionLabel
        ? {
            ...session,
            exercises: session.exercises.filter(ex => ex.exerciseId !== exerciseId)
          }
        : session
    )
  }
  await db.program.update(program.id, updated)
}
