import { createContext, useContext, useReducer, useEffect } from 'react'

const RestTimerContext = createContext(null)

const initialState = {
  active: false,
  secondsRemaining: 0,
  totalSeconds: 0,
  exerciseName: '',
  movementType: null
}

function timerReducer(state, action) {
  switch (action.type) {
    case 'START':
      return {
        active: true,
        secondsRemaining: action.payload.seconds,
        totalSeconds: action.payload.seconds,
        exerciseName: action.payload.exerciseName,
        movementType: action.payload.movementType
      }
    case 'TICK':
      return {
        ...state,
        secondsRemaining: Math.max(0, state.secondsRemaining - 1),
        active: state.secondsRemaining > 1
      }
    case 'DISMISS':
      return initialState
    default:
      return state
  }
}

export function RestTimerProvider({ children }) {
  const [state, dispatch] = useReducer(timerReducer, initialState)

  // Run timer interval
  useEffect(() => {
    if (!state.active) return

    const interval = setInterval(() => {
      dispatch({ type: 'TICK' })
    }, 1000)

    return () => clearInterval(interval)
  }, [state.active])

  const startTimer = (seconds, exerciseName, movementType) => {
    dispatch({
      type: 'START',
      payload: { seconds, exerciseName, movementType }
    })
  }

  const dismissTimer = () => {
    dispatch({ type: 'DISMISS' })
  }

  return (
    <RestTimerContext.Provider value={{ ...state, startTimer, dismissTimer }}>
      {children}
    </RestTimerContext.Provider>
  )
}

export function useRestTimer() {
  const context = useContext(RestTimerContext)
  if (!context) {
    throw new Error('useRestTimer must be used within RestTimerProvider')
  }
  return context
}
