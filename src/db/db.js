import Dexie from 'dexie'

export const db = new Dexie('FitnessTracker')

db.version(1).stores({
  program: '++id, name, createdAt',
  workoutLog: '++id, date, sessionLabel',
  progressionState: 'exerciseId, lastUpdated',
  settings: 'key'
})

db.version(2).stores({
  program: '++id, name, createdAt',
  workoutLog: '++id, date, sessionLabel',
  progressionState: 'exerciseId, lastUpdated',
  settings: 'key',
  exerciseLibrary: 'exerciseId, parentExerciseId'
})

db.version(3).stores({
  program: '++id, name, createdAt',
  workoutLog: '++id, date, sessionLabel',
  progressionState: 'exerciseId, lastUpdated',
  settings: 'key',
  exerciseLibrary: 'exerciseId, parentExerciseId',
  activeWorkout: '++id'
})

// v4: introduce the swappable Program Pack architecture.
// - exerciseCatalog: canonical, plan-independent movements (identity + aliases)
// - programPack: reference-based, versioned training plans (the swap unit)
// - bodyWeight: declare the table the app already reads/writes (was missing)
// program/workoutLog/progressionState remain the ground-truth data and are
// intentionally left untouched by a pack swap.
db.version(4).stores({
  program: '++id, name, createdAt',
  workoutLog: '++id, date, sessionLabel',
  progressionState: 'exerciseId, lastUpdated',
  settings: 'key',
  exerciseLibrary: 'exerciseId, parentExerciseId',
  activeWorkout: '++id',
  bodyWeight: '++id, date',
  exerciseCatalog: 'canonicalId, muscleGroup, movementType',
  programPack: 'packId, name, updatedAt'
})

export default db
