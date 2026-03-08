import { useState } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import SetRow from './SetRow'
import SwapDrawer from './SwapDrawer'
import BonusRound from './BonusRound'

export default function ExerciseCard({
  exercise,
  exerciseIndex,
  onSetComplete,
  onSuggestWeight,
  onSwap,
  onBonusRound,
  isAllDone
}) {
  const [expanded, setExpanded] = useState(true)
  const [showSwap, setShowSwap] = useState(false)
  const { displayWeight } = useSettings()

  const isComplete = exercise.setsCompleted === exercise.sets.length
  const lastSetIndex = exercise.sets.findIndex((s, i) => i === exercise.sets.length - 1)

  return (
    <>
      <div className={`border border-divider rounded-lg p-4 transition-opacity ${
        isComplete ? 'opacity-60' : ''
      }`}>
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left hover:opacity-70 transition-opacity"
        >
          <h3 className="font-semibold text-lg">{exercise.name}</h3>

          {exercise.weightReason && (
            <p className="text-xs text-secondary mt-1">{exercise.weightReason}</p>
          )}
        </button>

        {/* Sets */}
        {expanded && (
          <div className="mt-4 space-y-2">
            {exercise.sets.map((set, setIdx) => (
              <SetRow
                key={setIdx}
                set={set}
                setIndex={setIdx}
                exerciseIndex={exerciseIndex}
                exercise={exercise}
                onComplete={(reps, rpe, weight) => {
                  onSetComplete(exerciseIndex, setIdx, reps, rpe, weight)

                  // Check if should suggest weight increase
                  const { shouldSuggestWeightIncrease } = require('../../utils/progressionEngine')
                  if (shouldSuggestWeightIncrease(set, exercise.sets.length, setIdx + 1)) {
                    const { computeNextSetWeight } = require('../../utils/progressionEngine')
                    const newWeight = computeNextSetWeight(set.weight, exercise.movementType)
                    onSuggestWeight(setIdx, newWeight)
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* Swap button */}
        {expanded && exercise.alternatives?.length > 0 && (
          <button
            onClick={() => setShowSwap(true)}
            className="mt-4 w-full py-2 text-sm font-medium text-secondary hover:bg-divider rounded transition-colors"
          >
            ⇄ Swap
          </button>
        )}

        {/* Bonus round button - only on last exercise when all done */}
        {expanded && isAllDone && exercise === exercise && lastSetIndex >= 0 && (
          <BonusRound
            onSelect={onBonusRound}
            sessionLabel={exercise.sessionLabel}
          />
        )}
      </div>

      {showSwap && (
        <SwapDrawer
          exercise={exercise}
          onSelect={(newExercise) => {
            onSwap(newExercise)
            setShowSwap(false)
          }}
          onClose={() => setShowSwap(false)}
          onSaveCustom={(newAlt) => {
            // Append custom alternative to exercise and then swap to it
            exercise.alternatives = [...(exercise.alternatives || []), { exerciseId: newAlt.exerciseId, name: newAlt.name }]
            onSwap({
              ...exercise,
              exerciseId: newAlt.exerciseId,
              name: newAlt.name,
              movementType: newAlt.movementType
            })
            setShowSwap(false)
          }}
        />
      )}
    </>
  )
}
