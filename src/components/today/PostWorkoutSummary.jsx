import { useState } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import { logWorkout } from '../../db/workoutLog'
import { updateProgressionState } from '../../db/progression'
import { updateProgressionAfterWorkout } from '../../utils/progressionEngine'
import { db } from '../../db/db'

export default function PostWorkoutSummary({ exercises, sessionLabel, startTime, onDone }) {
  const [saving, setSaving] = useState(false)
  const { displayWeight } = useSettings()

  const durationSeconds = Math.round((Date.now() - startTime) / 1000)
  const minutes = Math.floor(durationSeconds / 60)

  async function handleSave() {
    setSaving(true)
    try {
      // Prepare workout log entry
      const workoutEntry = {
        date: new Date().toISOString(),
        sessionLabel,
        durationSeconds,
        exercises: exercises.filter(ex => !ex.isBonus).map(ex => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          sets: ex.sets.map(s => ({
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            actualReps: s.actualReps,
            weight: s.weight,
            rpe: s.rpe,
            completed: s.completed
          })),
          wasSwapped: ex.wasSwapped || false,
          swappedFrom: ex.swappedFrom || null
        }))
      }

      // Save workout log
      await logWorkout(workoutEntry)

      // Update progression states (skip bonus exercises)
      const program = await db.program.toArray().then(p => p[0])
      if (program) {
        for (const exercise of exercises) {
          // Skip bonus exercises - they're not in the program
          if (exercise.isBonus) continue

          const programExercise = program.sessions
            ?.flatMap(s => s.exercises)
            .find(e => e.exerciseId === exercise.exerciseId)

          if (programExercise) {
            const updated = updateProgressionAfterWorkout(
              {
                exerciseId: exercise.exerciseId,
                currentWeight: exercise.sets[exercise.sets.length - 1].weight
              },
              programExercise,
              exercise.sets.filter(s => s.completed)
            )

            await updateProgressionState(exercise.exerciseId, updated)
          }
        }
      }

      // Save last session label
      await db.settings.put({ key: 'lastSessionLabel', value: sessionLabel })

      // Done
      onDone()
    } catch (err) {
      console.error('Failed to save workout:', err)
      alert('Error saving workout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-2xl p-6 pb-10 max-h-[80vh] overflow-y-auto animate-slide-up">
        <h2 className="text-2xl font-bold mb-6">Workout Complete!</h2>

        {/* Duration */}
        <div className="mb-6 p-4 bg-divider rounded">
          <div className="text-sm text-secondary">Duration</div>
          <div className="text-2xl font-bold">{minutes} min</div>
        </div>

        {/* Exercise Summary */}
        <div className="mb-6 space-y-3">
          <h3 className="font-semibold">Exercises</h3>
          {exercises
            .filter(ex => !ex.isBonus)
            .map(ex => (
              <div key={ex.exerciseId} className="p-3 border border-divider rounded">
                <div className="font-medium">{ex.name}</div>
                <div className="text-sm text-secondary mt-1">
                  {ex.sets.length}×{ex.targetReps} @ {displayWeight(ex.sets[0].weight)}
                </div>
                <div className="text-xs text-secondary mt-1">
                  Avg RPE: {(ex.sets.reduce((sum, s) => sum + (s.rpe || 0), 0) / ex.sets.length).toFixed(1)}
                </div>
              </div>
            ))}
        </div>

        {/* Bonus rounds */}
        {exercises.filter(ex => ex.isBonus).length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="font-semibold">Bonus Rounds</h3>
            {exercises
              .filter(ex => ex.isBonus)
              .map((ex, idx) => (
                <div key={idx} className="p-3 border border-divider rounded opacity-75">
                  <div className="font-medium text-sm">{ex.name}</div>
                </div>
              ))}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-black text-white font-semibold rounded transition-colors hover:bg-[#333333] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Workout'}
        </button>
      </div>
    </div>
  )
}
