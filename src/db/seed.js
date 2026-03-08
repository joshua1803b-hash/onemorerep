import { db } from './db'
import { saveProgram } from './program'

/**
 * Seed a program into the database
 * @param {Object} program - { name, sessions: [{ label, exercises: [...] }] }
 */
export async function seedProgram(program) {
  try {
    await saveProgram(program)
    console.log('Program seeded:', program.name)
  } catch (err) {
    console.error('Failed to seed program:', err)
    throw err
  }
}

/**
 * Example program structure (for reference)
 */
export const EXAMPLE_PROGRAM = {
  name: 'PPL Split',
  sessions: [
    {
      label: 'Push',
      exercises: [
        {
          exerciseId: 'barbell_bench_press',
          name: 'Barbell Bench Press',
          sets: 4,
          targetReps: 8,
          startingWeight: 80,
          muscleGroup: 'chest',
          movementType: 'compound_upper',
          alternatives: [
            { exerciseId: 'dumbbell_bench_press', name: 'Dumbbell Bench Press' },
            { exerciseId: 'machine_chest_press', name: 'Machine Chest Press' }
          ]
        },
        {
          exerciseId: 'overhead_press',
          name: 'Overhead Press',
          sets: 3,
          targetReps: 10,
          startingWeight: 50,
          muscleGroup: 'shoulders',
          movementType: 'compound_upper',
          alternatives: [
            { exerciseId: 'dumbbell_shoulder_press', name: 'Dumbbell Shoulder Press' },
            { exerciseId: 'machine_shoulder_press', name: 'Machine Shoulder Press' }
          ]
        },
        {
          exerciseId: 'tricep_pushdown',
          name: 'Tricep Pushdown',
          sets: 3,
          targetReps: 12,
          startingWeight: 30,
          muscleGroup: 'triceps',
          movementType: 'isolation',
          alternatives: [
            { exerciseId: 'skull_crusher', name: 'Skull Crusher' },
            { exerciseId: 'rope_tricep_extension', name: 'Rope Tricep Extension' }
          ]
        }
      ]
    },
    {
      label: 'Pull',
      exercises: [
        {
          exerciseId: 'barbell_row',
          name: 'Barbell Row',
          sets: 4,
          targetReps: 8,
          startingWeight: 100,
          muscleGroup: 'back',
          movementType: 'compound_upper',
          alternatives: [
            { exerciseId: 'dumbbell_row', name: 'Dumbbell Row' },
            { exerciseId: 'machine_row', name: 'Machine Row' }
          ]
        },
        {
          exerciseId: 'pull_ups',
          name: 'Pull Ups',
          sets: 3,
          targetReps: 10,
          startingWeight: 0,
          muscleGroup: 'back',
          movementType: 'compound_upper',
          alternatives: [
            { exerciseId: 'assisted_pull_ups', name: 'Assisted Pull Ups' },
            { exerciseId: 'lat_pulldown', name: 'Lat Pulldown' }
          ]
        },
        {
          exerciseId: 'barbell_curl',
          name: 'Barbell Curl',
          sets: 3,
          targetReps: 10,
          startingWeight: 40,
          muscleGroup: 'biceps',
          movementType: 'isolation',
          alternatives: [
            { exerciseId: 'dumbbell_curl', name: 'Dumbbell Curl' },
            { exerciseId: 'cable_curl', name: 'Cable Curl' }
          ]
        }
      ]
    },
    {
      label: 'Legs',
      exercises: [
        {
          exerciseId: 'barbell_squat',
          name: 'Barbell Squat',
          sets: 4,
          targetReps: 8,
          startingWeight: 120,
          muscleGroup: 'quads',
          movementType: 'compound_lower',
          alternatives: [
            { exerciseId: 'dumbbell_squat', name: 'Dumbbell Squat' },
            { exerciseId: 'leg_press', name: 'Leg Press' }
          ]
        },
        {
          exerciseId: 'romanian_deadlift',
          name: 'Romanian Deadlift',
          sets: 3,
          targetReps: 8,
          startingWeight: 140,
          muscleGroup: 'hamstrings',
          movementType: 'compound_lower',
          alternatives: [
            { exerciseId: 'leg_curl', name: 'Leg Curl' },
            { exerciseId: 'smith_machine_rdl', name: 'Smith Machine RDL' }
          ]
        },
        {
          exerciseId: 'leg_extension',
          name: 'Leg Extension',
          sets: 3,
          targetReps: 12,
          startingWeight: 80,
          muscleGroup: 'quads',
          movementType: 'isolation',
          alternatives: [
            { exerciseId: 'hack_squat', name: 'Hack Squat' },
            { exerciseId: 'v_squat', name: 'V-Squat' }
          ]
        }
      ]
    }
  ]
}

/**
 * Helper to create an exercise object
 */
export function createExercise(
  exerciseId,
  name,
  sets,
  targetReps,
  startingWeight,
  muscleGroup,
  movementType,
  alternatives = []
) {
  return {
    exerciseId,
    name,
    sets,
    targetReps,
    startingWeight,
    muscleGroup,
    movementType,
    alternatives
  }
}

/**
 * Helper to create a session
 */
export function createSession(label, exercises = []) {
  return {
    label,
    exercises
  }
}

/**
 * Jeff Nippard Essentials 4x Program (Upper/Lower Split)
 * Based on user's actual logged weights from their training spreadsheet
 */
export const JEFF_NIPPARD_4X = {
  name: 'Jeff Nippard Essentials 4x',
  sessions: [
    // Upper A
    createSession('Upper A', [
      createExercise('flat_db_press_heavy', 'Flat DB Press (Heavy)', 1, 5, 30, 'chest', 'compound_upper', [
        { exerciseId: 'machine_chest_press', name: 'Machine Chest Press' },
        { exerciseId: 'weighted_dip', name: 'Weighted Dip' }
      ]),
      createExercise('flat_db_press_backoff', 'Flat DB Press (Back off)', 1, 9, 28, 'chest', 'compound_upper', [
        { exerciseId: 'machine_chest_press', name: 'Machine Chest Press' },
        { exerciseId: 'weighted_dip', name: 'Weighted Dip' }
      ]),
      createExercise('lat_pulldown_2grip', '2-Grip Lat Pulldown', 2, 11, 77, 'back', 'compound_upper', [
        { exerciseId: 'pullup_2grip', name: '2-Grip Pull-up' },
        { exerciseId: 'machine_pulldown', name: 'Machine Pulldown' }
      ]),
      createExercise('db_shoulder_press_seated', 'Seated DB Shoulder Press', 2, 11, 18, 'shoulders', 'compound_upper', [
        { exerciseId: 'machine_shoulder_press', name: 'Machine Shoulder Press' },
        { exerciseId: 'db_arnold_press', name: 'Standing DB Arnold Press' }
      ]),
      createExercise('cable_row_seated', 'Seated Cable Row', 2, 11, 67, 'back', 'compound_upper', [
        { exerciseId: 'chest_supported_db_row', name: 'Incline Chest-Supported DB Row' },
        { exerciseId: 'chest_supported_tbar_row', name: 'Chest-Supported T-Bar Row' }
      ]),
      createExercise('ez_bar_skull_crusher', 'EZ Bar Skull Crusher', 2, 13, 35, 'triceps', 'isolation', [
        { exerciseId: 'cable_triceps_extension_overhead', name: 'Overhead Cable Triceps Extension' },
        { exerciseId: 'db_french_press', name: 'DB French Press' }
      ]),
      createExercise('ez_bar_curl', 'EZ Bar Curl', 2, 13, 35, 'biceps', 'isolation', [
        { exerciseId: 'db_curl', name: 'DB Curl' },
        { exerciseId: 'cable_curl', name: 'Cable EZ Curl' }
      ])
    ]),
    // Lower A
    createSession('Lower A', [
      createExercise('hack_squat_heavy', 'Hack Squat (Heavy)', 1, 5, 82.5, 'quads', 'compound_lower', [
        { exerciseId: 'machine_squat', name: 'Machine Squat' },
        { exerciseId: 'leg_press', name: 'Leg Press' }
      ]),
      createExercise('hack_squat_backoff', 'Hack Squat (Back off)', 1, 9, 72.5, 'quads', 'compound_lower', [
        { exerciseId: 'machine_squat', name: 'Machine Squat' },
        { exerciseId: 'leg_press', name: 'Leg Press' }
      ]),
      createExercise('hamstring_curl_seated', 'Seated Hamstring Curl', 1, 11, 65, 'hamstrings', 'isolation', [
        { exerciseId: 'nordic_ham_curl', name: 'Nordic Ham Curl' },
        { exerciseId: 'leg_curl_lying', name: 'Lying Leg Curl' }
      ]),
      createExercise('calf_raise_seated', 'Seated Calf Raise', 2, 11, 40, 'calves', 'isolation', [
        { exerciseId: 'calf_raise_standing', name: 'Standing Calf Raise' },
        { exerciseId: 'leg_press_toe_press', name: 'Leg Press Toe Press' }
      ]),
      createExercise('leg_raise_hanging', 'Hanging Leg Raise', 2, 11, 0, 'core', 'isolation', [
        { exerciseId: 'roman_chair_crunch', name: 'Roman Chair Crunch' },
        { exerciseId: 'crunch_reverse', name: 'Reverse Crunch' }
      ])
    ]),
    // Upper B
    createSession('Upper B', [
      createExercise('pendlay_row', 'Pendlay Row', 2, 9, 60, 'back', 'compound_upper', [
        { exerciseId: 'tbar_row', name: 'T-Bar Row' },
        { exerciseId: 'cable_row_seated', name: 'Seated Cable Row' }
      ]),
      createExercise('machine_shoulder_press', 'Machine Shoulder Press', 2, 11, 42.5, 'shoulders', 'compound_upper', [
        { exerciseId: 'db_shoulder_press_seated', name: 'Seated DB Shoulder Press' },
        { exerciseId: 'db_arnold_press', name: 'Standing DB Arnold Press' }
      ]),
      createExercise('pullup_weighted', 'Weighted Pullup', 2, 9, 10, 'back', 'compound_upper', [
        { exerciseId: 'lat_pulldown', name: 'Lat Pulldown' },
        { exerciseId: 'pullup_neutral_grip', name: 'Neutral-Grip Pullup' }
      ]),
      createExercise('machine_chest_press', 'Machine Chest Press', 2, 11, 50, 'chest', 'compound_upper', [
        { exerciseId: 'weighted_dip', name: 'Weighted Dip' },
        { exerciseId: 'flat_db_press_heavy', name: 'Flat DB Press' }
      ]),
      createExercise('cable_curl_bayesian', 'Bayesian Cable Curl', 2, 13, 12.5, 'biceps', 'isolation', [
        { exerciseId: 'db_curl_incline', name: 'DB Incline Curl' },
        { exerciseId: 'db_curl', name: 'DB Curl' }
      ]),
      createExercise('triceps_pressdown', 'Triceps Pressdown', 2, 13, 30, 'triceps', 'isolation', [
        { exerciseId: 'cable_triceps_kickback', name: 'Cable Triceps Kickback' },
        { exerciseId: 'db_triceps_kickback', name: 'DB Triceps Kickback' }
      ]),
      createExercise('db_lateral_raise', 'DB Lateral Raise', 1, 13, 10, 'shoulders', 'isolation', [
        { exerciseId: 'cable_lateral_raise', name: 'Cable Lateral Raise' },
        { exerciseId: 'machine_lateral_raise', name: 'Machine Lateral Raise' }
      ])
    ]),
    // Lower B
    createSession('Lower B', [
      createExercise('romanian_deadlift', 'Romanian Deadlift', 2, 11, 90, 'hamstrings', 'compound_lower', [
        { exerciseId: 'db_romanian_deadlift', name: 'DB Romanian Deadlift' },
        { exerciseId: 'hyperextension_45deg', name: '45° Hyperextension' }
      ]),
      createExercise('leg_press', 'Leg Press', 3, 11, 160, 'quads', 'compound_lower', [
        { exerciseId: 'goblet_squat', name: 'Goblet Squat' },
        { exerciseId: 'db_lunge_walking', name: 'DB Walking Lunge' }
      ]),
      createExercise('leg_extension', 'Leg Extension', 1, 11, 60, 'quads', 'isolation', [
        { exerciseId: 'db_stepup', name: 'DB Step-Up' },
        { exerciseId: 'goblet_squat', name: 'Goblet Squat' }
      ]),
      createExercise('calf_raise_seated_b', 'Seated Calf Raise', 2, 13, 52.5, 'calves', 'isolation', [
        { exerciseId: 'calf_raise_standing', name: 'Standing Calf Raise' },
        { exerciseId: 'leg_press_toe_press', name: 'Leg Press Toe Press' }
      ]),
      createExercise('cable_crunch', 'Cable Crunch', 2, 13, 25, 'core', 'isolation', [
        { exerciseId: 'machine_crunch', name: 'Machine Crunch' },
        { exerciseId: 'crunch_plate_weighted', name: 'Plate-Weighted Crunch' }
      ])
    ])
  ]
}
