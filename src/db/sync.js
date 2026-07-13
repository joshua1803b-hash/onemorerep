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
 * Push catalog entries to Supabase (camel -> snake). No-op on empty.
 * @param {Object[]} entries
 */
export async function pushCatalog(entries) {
  if (!entries?.length) return

  const rows = entries.map(e => ({
    canonical_id: e.canonicalId,
    display_name: e.displayName,
    aliases: e.aliases ?? [],
    muscle_group: e.muscleGroup,
    movement_type: e.movementType,
    equipment: e.equipment ?? null,
    default_increment_kg: e.defaultIncrementKg ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt
  }))

  const { error } = await supabase
    .from('exercise_catalog')
    .upsert(rows, { onConflict: 'canonical_id' })

  if (error) console.error('Sync: failed to push catalog', error)
}

/**
 * Push a single program pack to Supabase (camel -> snake). When `active` is set,
 * first clear is_active on every other row so exactly one pack is active.
 * @param {Object} pack
 * @param {{ active?: boolean }} [opts]
 */
export async function pushPack(pack, { active = false } = {}) {
  if (!pack?.packId) return

  if (active) {
    const { error: clearError } = await supabase
      .from('program_pack')
      .update({ is_active: false })
      .neq('pack_id', pack.packId)
    if (clearError) console.error('Sync: failed to clear active packs', clearError)
  }

  const { error } = await supabase
    .from('program_pack')
    .upsert({
      pack_id: pack.packId,
      version: pack.version ?? 1,
      name: pack.name,
      source: pack.source ?? null,
      progression_rules: pack.progressionRules ?? null,
      sessions: pack.sessions,
      is_active: active,
      updated_at: pack.updatedAt || new Date().toISOString()
    }, { onConflict: 'pack_id' })

  if (error) console.error('Sync: failed to push pack', error)
}

/**
 * Pull the catalog + packs from Supabase into local IndexedDB (snake -> camel).
 * @returns {Promise<string|null>} the remote active pack_id, or null
 */
export async function pullPacks() {
  try {
    const [
      { data: catalog },
      { data: packs }
    ] = await Promise.all([
      supabase.from('exercise_catalog').select('*'),
      supabase.from('program_pack').select('*')
    ])

    await db.transaction('rw', [db.exerciseCatalog, db.programPack], async () => {
      if (catalog?.length) {
        await db.exerciseCatalog.bulkPut(catalog.map(mapCatalogRow))
      }
      if (packs?.length) {
        await db.programPack.bulkPut(packs.map(mapPackRow))
      }
    })

    const activeRow = packs?.find(p => p.is_active)
    return activeRow?.pack_id ?? null
  } catch (err) {
    console.error('Sync: pullPacks failed', err)
    return null
  }
}

function mapCatalogRow(c) {
  return {
    canonicalId: c.canonical_id,
    displayName: c.display_name,
    aliases: c.aliases ?? [],
    muscleGroup: c.muscle_group,
    movementType: c.movement_type,
    equipment: c.equipment ?? null,
    defaultIncrementKg: c.default_increment_kg ?? null,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }
}

function mapPackRow(p) {
  return {
    packId: p.pack_id,
    version: p.version,
    name: p.name,
    source: p.source,
    progressionRules: p.progression_rules,
    sessions: p.sessions,
    updatedAt: p.updated_at
  }
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
      { data: exercises },
      { data: catalog },
      { data: packs }
    ] = await Promise.all([
      supabase.from('workout_log').select('*').order('date', { ascending: true }),
      supabase.from('progression_state').select('*'),
      supabase.from('program').select('*').limit(1),
      supabase.from('exercise_library').select('*'),
      supabase.from('exercise_catalog').select('*'),
      supabase.from('program_pack').select('*')
    ])

    await db.transaction('rw', [db.workoutLog, db.progressionState, db.program, db.exerciseLibrary, db.exerciseCatalog, db.programPack], async () => {
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

      if (catalog?.length) {
        await db.exerciseCatalog.bulkPut(catalog.map(mapCatalogRow))
      }

      if (packs?.length) {
        await db.programPack.bulkPut(packs.map(mapPackRow))
      }
    })

    return true
  } catch (err) {
    console.error('Sync: restore failed', err)
    return false
  }
}
