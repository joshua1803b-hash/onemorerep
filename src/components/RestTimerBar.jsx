import { useRestTimer } from '../contexts/RestTimerContext'

export default function RestTimerBar() {
  const { active, secondsRemaining, totalSeconds, exerciseName, dismissTimer } = useRestTimer()

  if (!active) return null

  const progress = totalSeconds > 0 ? (1 - secondsRemaining / totalSeconds) * 100 : 0
  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60

  return (
    <div
      className="fixed bottom-14 left-0 right-0 border-t border-divider bg-white z-40 px-3 pt-3"
      style={{ paddingBottom: 'max(0.75rem, calc(0.75rem + env(safe-area-inset-bottom)))' }}
    >
      <div className="flex items-center gap-3">
        {/* Progress bar */}
        <div className="flex-1 h-1 bg-divider rounded-full overflow-hidden">
          <div
            className="h-full bg-black transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time display */}
        <div className="w-12 text-right text-sm font-medium">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>

        {/* Dismiss button */}
        <button
          onClick={dismissTimer}
          className="px-3 py-1 text-sm font-medium text-black hover:bg-divider rounded transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Exercise name */}
      {exerciseName && (
        <div className="text-xs text-secondary mt-2">
          {exerciseName}
        </div>
      )}
    </div>
  )
}
