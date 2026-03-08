import { useState } from 'react'
import { useSettings } from '../../contexts/SettingsContext'

export default function WorkoutEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const { displayWeight } = useSettings()

  const date = new Date(entry.date)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const minutes = Math.floor(entry.durationSeconds / 60)

  return (
    <div className="border-b border-divider py-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left hover:opacity-70 transition-opacity"
      >
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h3 className="font-semibold">{entry.sessionLabel}</h3>
            <p className="text-sm text-secondary mt-1">{dateStr}</p>
          </div>
          <span className="text-sm font-medium">{minutes} min</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {entry.exercises?.map((exercise, idx) => {
            const totalReps = exercise.sets?.length || 0
            const totalWeight = exercise.sets?.[exercise.sets.length - 1]?.weight || 0
            return (
              <div key={idx} className="p-2 bg-divider rounded text-sm">
                <div className="font-medium">{exercise.name}</div>
                <div className="text-secondary">
                  {displayWeight(totalWeight)} × {totalReps}×{exercise.sets?.[0]?.targetReps || '?'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
