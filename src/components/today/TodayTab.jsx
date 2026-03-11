import { useReducer, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getProgressionState, getProgressionStates, initializeProgressionState } from '../../db/progression'
import { getLastWorkoutForExercise } from '../../db/workoutLog'
import { computeSessionWeight, updateProgressionAfterWorkout } from '../../utils/progressionEngine'
import ExerciseCard from './ExerciseCard'
import PostWorkoutSummary from './PostWorkoutSummary'

const initialState = {
  mode: 'picking', // 'picking' | 'logging' | 'summary'
  selectedSession: null,
  currentSessionIndex: 0,
  exercises: [],
  startTime: null,
  isOverviewMode: false
}

function workoutReducer(state, action) {
  switch (action.type) {
    case 'CYCLE_SESSION':
      return {
        ...state,
        currentSessionIndex: action.payload.nextIndex
      }

    case 'SELECT_SESSION':
      return {
        ...state,
        selectedSession: action.payload.sessionLabel,
        exercises: action.payload.exercises,
        mode: 'logging',
        startTime: Date.now()
      }

    case 'UPDATE_EXERCISE_SET': {
      const { exerciseIndex, setIndex, reps, rpe, weight } = action.payload
      const updated = [...state.exercises]
      if (updated[exerciseIndex]) {
        updated[exerciseIndex].sets[setIndex] = {
          ...updated[exerciseIndex].sets[setIndex],
          actualReps: reps,
          rpe,
          weight,
          completed: true
        }
        updated[exerciseIndex].setsCompleted = updated[exerciseIndex].sets.filter(s => s.completed).length
      }
      return { ...state, exercises: updated }
    }

    case 'SUGGEST_WEIGHT': {
      const { exerciseIndex, setIndex, newWeight } = action.payload
      const updated = [...state.exercises]
      if (updated[exerciseIndex] && updated[exerciseIndex].sets[setIndex + 1]) {
        updated[exerciseIndex].sets[setIndex + 1].weight = newWeight
      }
      return { ...state, exercises: updated }
    }

    case 'SWAP_EXERCISE': {
      const { exerciseIndex, newExercise } = action.payload
      const updated = [...state.exercises]
      updated[exerciseIndex] = {
        ...newExercise,
        sets: updated[exerciseIndex].sets.map((s, i) => ({
          setNumber: i + 1,
          targetReps: newExercise.targetReps,
          actualReps: null,
          weight: newExercise.startingWeight || 0,
          rpe: null,
          completed: false
        })),
        wasSwapped: true,
        swappedFrom: updated[exerciseIndex].exerciseId,
        setsCompleted: 0
      }
      return { ...state, exercises: updated }
    }

    case 'ADD_BONUS_ROUND': {
      const { bonusExercise } = action.payload
      const newExercise = {
        ...bonusExercise,
        sets: [
          { setNumber: 1, targetReps: bonusExercise.targetReps, actualReps: null, weight: bonusExercise.startingWeight || 0, rpe: null, completed: false },
          { setNumber: 2, targetReps: bonusExercise.targetReps, actualReps: null, weight: bonusExercise.startingWeight || 0, rpe: null, completed: false }
        ],
        setsCompleted: 0,
        isBonus: true
      }
      return {
        ...state,
        exercises: [...state.exercises, newExercise]
      }
    }

    case 'FINISH_WORKOUT':
      return {
        ...state,
        mode: 'summary'
      }

    case 'TOGGLE_OVERVIEW':
      return {
        ...state,
        isOverviewMode: !state.isOverviewMode
      }

    case 'REORDER_EXERCISES': {
      const { fromIndex, toIndex } = action.payload
      const updated = [...state.exercises]
      const [removed] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, removed)
      return { ...state, exercises: updated }
    }

    case 'SET_SESSION_INDEX':
      return {
        ...state,
        currentSessionIndex: action.payload.index
      }

    case 'SKIP_WORKOUT':
      return initialState

    case 'RESET':
      return initialState

    default:
      return state
  }
}

export default function TodayTab({ onBack }) {
  const program = useLiveQuery(() => db.program.toArray().then(p => p[0]))
  const [state, dispatch] = useReducer(workoutReducer, initialState)

  const sessions = program?.sessions || []

  // Auto-select and start next session on mount or when returning from summary
  useEffect(() => {
    if (sessions.length === 0) return
    // Only auto-start if in picking mode (initial load or after reset)
    if (state.mode !== 'picking') return

    async function autoStartWorkout() {
      const lastSessionSetting = await db.settings.get('lastSessionLabel')
      const lastSessionLabel = lastSessionSetting?.value

      let nextSessionLabel = sessions[0].label
      if (lastSessionLabel) {
        const lastSessionIdx = sessions.findIndex(s => s.label === lastSessionLabel)
        if (lastSessionIdx >= 0) {
          nextSessionLabel = sessions[(lastSessionIdx + 1) % sessions.length].label
        }
      }

      // Auto-start the selected session
      const session = sessions.find(s => s.label === nextSessionLabel)
      if (session) {
        // Initialize progression states for all exercises
        for (const exercise of session.exercises) {
          await initializeProgressionState(exercise.exerciseId, exercise)
        }

        // Get progression states and compute weights
        const progressionMap = await getProgressionStates(
          session.exercises.map(e => e.exerciseId)
        )

        // Build exercises with computed weights
        const exercisesWithWeights = await Promise.all(
          session.exercises.map(async exercise => {
            const progression = progressionMap[exercise.exerciseId]
            const lastWorkoutData = await getLastWorkoutForExercise(exercise.exerciseId)

            let sessionWeight = progression?.currentWeight || exercise.startingWeight || 0
            let weightReason = null

            if (lastWorkoutData) {
              const { weight, reason } = computeSessionWeight(progression, {
                exercise,
                sets: lastWorkoutData.exercise.sets
              })
              sessionWeight = weight
              weightReason = reason
            }

            return {
              exerciseId: exercise.exerciseId,
              name: exercise.name,
              movementType: exercise.movementType,
              targetReps: exercise.targetReps,
              startingWeight: sessionWeight,
              sets: Array.from({ length: exercise.sets }, (_, i) => ({
                setNumber: i + 1,
                targetReps: exercise.targetReps,
                actualReps: null,
                weight: sessionWeight,
                rpe: null,
                completed: false
              })),
              setsCompleted: 0,
              weightReason,
              alternatives: exercise.alternatives || []
            }
          })
        )

        dispatch({
          type: 'SELECT_SESSION',
          payload: {
            sessionLabel: nextSessionLabel,
            exercises: exercisesWithWeights
          }
        })
      }
    }

    autoStartWorkout()
  }, [sessions.length, state.mode])


  function handleSetComplete(exerciseIndex, setIndex, reps, rpe, weight) {
    dispatch({
      type: 'UPDATE_EXERCISE_SET',
      payload: { exerciseIndex, setIndex, reps, rpe, weight }
    })
  }

  async function handleSwap(exerciseIndex, newExercise) {
    const parentExercise = state.exercises[exerciseIndex]

    // Initialize progression state if first time
    await initializeProgressionState(newExercise.exerciseId, {
      startingWeight: parentExercise.startingWeight,
      targetReps: parentExercise.targetReps,
      muscleGroup: parentExercise.muscleGroup || 'general',
      movementType: newExercise.movementType || parentExercise.movementType
    })

    // Get progression state for this alternative
    const progression = await getProgressionState(newExercise.exerciseId)
    const lastWorkout = await getLastWorkoutForExercise(newExercise.exerciseId)

    let sessionWeight = progression?.currentWeight || parentExercise.startingWeight || 0
    let weightReason = null

    if (lastWorkout && progression) {
      const result = computeSessionWeight(progression, {
        exercise: newExercise,
        sets: lastWorkout.exercise.sets
      })
      sessionWeight = result.weight
      weightReason = result.reason
    }

    dispatch({
      type: 'SWAP_EXERCISE',
      payload: {
        exerciseIndex,
        newExercise: {
          ...parentExercise,
          exerciseId: newExercise.exerciseId,
          name: newExercise.name,
          movementType: newExercise.movementType || parentExercise.movementType,
          startingWeight: sessionWeight,
          weightReason
        }
      }
    })
  }

  const isAllDone = state.exercises.length > 0 &&
    state.exercises.every(ex => ex.setsCompleted === ex.sets.length)

  if (!program) {
    return (
      <div className="pb-20 px-4 py-4 flex items-center justify-center min-h-screen">
        <p className="text-secondary">No program loaded. Go to Me tab to add exercises.</p>
      </div>
    )
  }


  if (state.mode === 'summary') {
    return (
      <PostWorkoutSummary
        exercises={state.exercises}
        sessionLabel={state.selectedSession}
        startTime={state.startTime}
        onDone={() => dispatch({ type: 'RESET' })}
      />
    )
  }

  // Find the first incomplete exercise
  const firstIncompleteExIdx = state.exercises.findIndex(ex => ex.setsCompleted < ex.sets.length)
  const currentExercise = firstIncompleteExIdx >= 0 ? state.exercises[firstIncompleteExIdx] : state.exercises[0]

  if (state.isOverviewMode) {
    // Overview mode: show all exercises
    return (
      <div className="pb-20 px-4 py-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{state.selectedSession}</h2>
            <p className="text-sm text-secondary mt-1">
              {state.exercises.filter(ex => ex.setsCompleted === ex.sets.length).length}/{state.exercises.length} exercises done
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_OVERVIEW' })}
              className="px-3 py-2 text-sm font-medium hover:bg-divider rounded transition-colors"
            >
              ✕
            </button>
            {onBack && (
              <button
                onClick={() => onBack()}
                className="px-3 py-2 text-sm font-medium hover:bg-divider rounded transition-colors"
              >
                Back
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {state.exercises.map((exercise, idx) => (
            <div key={exercise.exerciseId} className="flex gap-2 items-start">
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={() => idx > 0 && dispatch({ type: 'REORDER_EXERCISES', payload: { fromIndex: idx, toIndex: idx - 1 } })}
                  disabled={idx === 0}
                  className="p-1 text-lg hover:bg-divider rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ↑
                </button>
                <button
                  onClick={() => idx < state.exercises.length - 1 && dispatch({ type: 'REORDER_EXERCISES', payload: { fromIndex: idx, toIndex: idx + 1 } })}
                  disabled={idx === state.exercises.length - 1}
                  className="p-1 text-lg hover:bg-divider rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ↓
                </button>
              </div>
              <div className="flex-1">
                <ExerciseCard
                  exercise={exercise}
                  exerciseIndex={idx}
                  onSetComplete={handleSetComplete}
                  onSuggestWeight={(setIdx, newWeight) =>
                    dispatch({
                      type: 'SUGGEST_WEIGHT',
                      payload: { exerciseIndex: idx, setIndex: setIdx, newWeight }
                    })
                  }
                  onSwap={(newExercise) => handleSwap(idx, newExercise)}
                  onBonusRound={(bonusEx) =>
                    dispatch({
                      type: 'ADD_BONUS_ROUND',
                      payload: { bonusExercise: bonusEx }
                    })
                  }
                  isAllDone={isAllDone && !state.exercises[idx].isBonus}
                />
              </div>
            </div>
          ))}

          {isAllDone && (
            <button
              onClick={() => dispatch({ type: 'FINISH_WORKOUT' })}
              className="w-full py-4 bg-black text-white font-semibold rounded transition-colors hover:bg-[#333333]"
            >
              View Summary
            </button>
          )}

          <button
            onClick={async () => {
              // Save current session as "last completed" before skipping
              await db.settings.put({ key: 'lastSessionLabel', value: state.selectedSession })
              dispatch({ type: 'SKIP_WORKOUT' })
            }}
            className="w-full py-3 bg-divider text-black font-semibold rounded transition-colors hover:bg-[#d0d0d0] mt-3"
          >
            Skip Workout
          </button>
        </div>
      </div>
    )
  }

  // Default view: show only current set
  return (
    <div className="pb-20 px-4 flex flex-col min-h-screen" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: '5rem' }}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <h2 className="text-lg font-bold">{state.selectedSession}</h2>
          <p className="text-sm text-secondary mt-1">
            {state.exercises.filter(ex => ex.setsCompleted === ex.sets.length).length}/{state.exercises.length} exercises
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_OVERVIEW' })}
            className="px-3 py-2 text-sm font-medium hover:bg-divider rounded transition-colors"
          >
            Overview
          </button>
          {onBack && (
            <button
              onClick={() => onBack()}
              className="px-3 py-2 text-sm font-medium hover:bg-divider rounded transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {currentExercise && (
        <div className="flex-1 flex flex-col justify-center">
          <ExerciseCard
            exercise={currentExercise}
            exerciseIndex={firstIncompleteExIdx >= 0 ? firstIncompleteExIdx : 0}
            onSetComplete={handleSetComplete}
            onSuggestWeight={(setIdx, newWeight) =>
              dispatch({
                type: 'SUGGEST_WEIGHT',
                payload: { exerciseIndex: firstIncompleteExIdx >= 0 ? firstIncompleteExIdx : 0, setIndex: setIdx, newWeight }
              })
            }
            onSwap={(newExercise) => handleSwap(firstIncompleteExIdx >= 0 ? firstIncompleteExIdx : 0, newExercise)}
            onBonusRound={(bonusEx) =>
              dispatch({
                type: 'ADD_BONUS_ROUND',
                payload: { bonusExercise: bonusEx }
              })
            }
            isAllDone={isAllDone && !currentExercise.isBonus}
          />
        </div>
      )}

      {isAllDone && (
        <button
          onClick={() => dispatch({ type: 'FINISH_WORKOUT' })}
          className="w-full py-4 bg-black text-white font-semibold rounded transition-colors hover:bg-[#333333]"
        >
          View Summary
        </button>
      )}
    </div>
  )
}
