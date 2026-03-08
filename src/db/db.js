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

export default db
