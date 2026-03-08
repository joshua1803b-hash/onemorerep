import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import WorkoutEntry from './WorkoutEntry'

export default function HistoryTab({ onBack }) {
  const workouts = useLiveQuery(() => db.workoutLog.orderBy('date').reverse().toArray())

  if (!workouts) {
    return <div className="px-4 py-4">Loading...</div>
  }

  if (workouts.length === 0) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">History</h1>
          <button
            onClick={() => onBack?.()}
            className="text-sm font-medium hover:bg-divider rounded px-3 py-2 transition-colors"
          >
            Back
          </button>
        </div>
        <p className="text-secondary">No workouts yet. Start your first workout.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">History</h1>
        <button
          onClick={() => onBack?.()}
          className="text-sm font-medium hover:bg-divider rounded px-3 py-2 transition-colors"
        >
          Back
        </button>
      </div>
      <div>
        {workouts.map((workout, idx) => (
          <WorkoutEntry key={idx} entry={workout} />
        ))}
      </div>
    </div>
  )
}
