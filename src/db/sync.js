import { supabase } from './supabase'
import { db } from './db'

/**
 * Push a single workout log entry to Supabase
 */
export async function pushWorkout(workout) {
  const { error } = await supabase
    .from('workout_log')
    .upsert({
      local_id: workout.id,
      date: workout.date,
      session_label: workout.sessionLabel,
      duration_seconds: workout.durationSeconds,
      exercises: workout.exercises
    }, { onConflict: 'local_id' })

  if (error) {
    console.error('Sync: failed to push workout', error)
    alert(`Sync error: ${error.message}`)
  }
}

/**
 * Push all progression states to Supabase
 */
export async function pushProgressionStates(states) {
  const rows = states.map(s => ({
    exercise_id: s.exerciseId,
    current_weight: s.currentWeight,
    rep_range: s.repRange,
    last_session_avg_rpe: s.lastSessionAvgRpe,
    last_session_date: s.lastSessionDate,
    last_updated: s.lastUpdated
  }))

  const { error } = await supabase
    .from('progression_state')
    .upsert(rows, { onConflict: 'exercise_id' })

  if (error) console.error('Sync: failed to push progression states', error)
}

/**
 * Push the active program to Supabase
 */
export async function pushProgram(program) {
  const { error } = await supabase
    .from('program')
    .upsert({
      id: 1,
      name: program.name,
      sessions: program.sessions,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

  if (error) console.error('Sync: failed to push program', error)
}

/**
 * Push all custom exercises to Supabase
 */
export async function pushExerciseLibrary(exercises) {
  if (!exercises.length) return

  const rows = exercises.map(e => ({
    exercise_id: e.exerciseId,
    name: e.name,
    parent_exercise_id: e.parentExerciseId,
    movement_type: e.movementType,
    muscle_group: e.muscleGroup,
    starting_weight: e.startingWeight,
    is_custom: e.isCustom,
    created_at: e.createdAt
  }))

  const { error } = await supabase
    .from('exercise_library')
    .upsert(rows, { onConflict: 'exercise_id' })

  if (error) console.error('Sync: failed to push exercise library', error)
}

/**
 * Pull everything from Supabase and restore into local IndexedDB.
 * Only called when local DB is empty (new device restore).
 */
export async function restoreFromSupabase() {
  try {
    const [
      { data: workouts },
      { data: progressions },
      { data: programs },
      { data: exercises }
    ] = await Promise.all([
      supabase.from('workout_log').select('*').order('date', { ascending: true }),
      supabase.from('progression_state').select('*'),
      supabase.from('program').select('*').limit(1),
      supabase.from('exercise_library').select('*')
    ])

    await db.transaction('rw', [db.workoutLog, db.progressionState, db.program, db.exerciseLibrary], async () => {
      if (workouts?.length) {
        await db.workoutLog.bulkAdd(workouts.map(w => ({
          id: w.local_id,
          date: w.date,
          sessionLabel: w.session_label,
          durationSeconds: w.duration_seconds,
          exercises: w.exercises
        })))
      }

      if (progressions?.length) {
        await db.progressionState.bulkPut(progressions.map(p => ({
          exerciseId: p.exercise_id,
          currentWeight: p.current_weight,
          repRange: p.rep_range,
          lastSessionAvgRpe: p.last_session_avg_rpe,
          lastSessionDate: p.last_session_date,
          lastUpdated: p.last_updated
        })))
      }

      if (programs?.length) {
        const p = programs[0]
        await db.program.add({
          name: p.name,
          sessions: p.sessions,
          createdAt: p.created_at
        })
      }

      if (exercises?.length) {
        await db.exerciseLibrary.bulkPut(exercises.map(e => ({
          exerciseId: e.exercise_id,
          name: e.name,
          parentExerciseId: e.parent_exercise_id,
          movementType: e.movement_type,
          muscleGroup: e.muscle_group,
          startingWeight: e.starting_weight,
          isCustom: e.is_custom,
          createdAt: e.created_at
        })))
      }
    })

    return true
  } catch (err) {
    console.error('Sync: restore failed', err)
    return false
  }
}
