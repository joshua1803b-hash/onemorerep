import { useState, useEffect } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import { getRestDuration } from '../../utils/muscleGroups'

export default function SetRow({ set, setIndex, exerciseIndex, exercise, onComplete }) {
  const [logging, setLogging] = useState(false)
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState(set.weight)
  const [rpe, setRpe] = useState(8.5)
  const [mode, setMode] = useState('reps') // 'reps' or 'weight'
  const [resting, setResting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const { displayWeight } = useSettings()

  // Prevent scrolling when logging set
  useEffect(() => {
    if (logging) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [logging])

  useEffect(() => {
    if (!resting || timeLeft <= 0) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1
        if (newTime <= 0) {
          setResting(false)
          onComplete(parseInt(reps), rpe, weight)
          setLogging(false)
          setReps('')
          setWeight(set.weight)
          setMode('reps')
          setRpe(8.5)
          return 0
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [resting, timeLeft, reps, rpe, weight, onComplete, set.weight])

  if (!logging && !resting) {
    return (
      <button
        onClick={() => setLogging(true)}
        className={`w-full p-3 rounded border transition-all ${
          set.completed
            ? 'border-divider bg-divider/50 opacity-60'
            : 'border-divider hover:border-black hover:bg-divider/30'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Set {set.setNumber}</span>
          <div className="flex items-center gap-3">
            {set.completed ? (
              <>
                <span className="text-sm text-secondary">{set.actualReps}×{set.weight} kg</span>
                <span className="text-lg">✓</span>
              </>
            ) : (
              <span className="text-sm text-secondary">{displayWeight(set.weight)} × {set.targetReps}</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  function handleSubmit() {
    if (!reps || reps === '') {
      alert('Enter reps')
      return
    }

    // Start rest timer
    const duration = getRestDuration(exercise.movementType)
    setTotalTime(duration)
    setTimeLeft(duration)
    setResting(true)
  }

  function skipTimer() {
    setResting(false)
    onComplete(parseInt(reps), rpe, weight)
    setLogging(false)
    setReps('')
    setWeight(set.weight)
    setMode('reps')
    setRpe(8.5)
  }

  if (resting) {
    const progress = (totalTime - timeLeft) / totalTime
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60

    return (
      <div className="p-3 border border-black rounded-lg bg-white">
        <button
          onClick={skipTimer}
          className="w-full py-4 text-white font-semibold rounded transition-all"
          style={{
            background: `linear-gradient(to right, white 0%, white ${progress * 100}%, black ${progress * 100}%, black 100%)`
          }}
        >
          <span style={{ color: progress > 0.5 ? 'black' : 'white', fontWeight: 'bold' }}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 border border-black rounded-lg bg-white space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Set {set.setNumber}</span>
        <span className="text-xs text-secondary">{displayWeight(set.weight)} × {set.targetReps}</span>
      </div>

      {/* Reps/Weight input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium">
            {mode === 'reps' ? 'Reps' : 'Weight (kg)'}
          </label>
          <button
            onClick={() => setMode(mode === 'reps' ? 'weight' : 'reps')}
            className="text-xs font-medium px-2 py-1 hover:bg-divider rounded transition-colors"
          >
            kg
          </button>
        </div>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={mode === 'reps' ? reps : weight}
          onChange={e => mode === 'reps' ? setReps(e.target.value) : setWeight(parseFloat(e.target.value) || 0)}
          placeholder={mode === 'reps' ? '0' : '0'}
          className="w-full px-3 py-2 border border-divider rounded text-lg font-semibold text-center"
          autoFocus
          step={mode === 'weight' ? '0.25' : '1'}
        />
      </div>

      {/* RPE slider */}
      <div>
        <label className="block text-xs font-medium mb-2">RPE: {rpe.toFixed(1)}</label>
        <input
          type="range"
          min="6"
          max="10"
          step="0.5"
          value={rpe}
          onChange={e => setRpe(parseFloat(e.target.value))}
          className="w-full h-2 rounded appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, black 0%, black ${((rpe - 6) / 4) * 100}%, #f0f0f0 ${((rpe - 6) / 4) * 100}%, #f0f0f0 100%)`,
            WebkitAppearance: 'none',
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: black;
            cursor: pointer;
            border: none;
          }
          input[type="range"]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: black;
            cursor: pointer;
            border: none;
          }
        `}</style>
        <div className="text-xs text-secondary mt-1 flex justify-between">
          <span>Easy</span>
          <span>Hard</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          className="flex-1 py-2 bg-black text-white font-medium rounded transition-colors hover:bg-[#333333]"
        >
          Done
        </button>
        <button
          onClick={() => {
            setLogging(false)
            setReps('')
            setWeight(set.weight)
            setMode('reps')
            setRpe(8.5)
          }}
          className="px-3 py-2 border border-divider rounded text-secondary hover:bg-divider transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
