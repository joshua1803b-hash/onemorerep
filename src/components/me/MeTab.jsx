import { db } from '../../db/db'

export default function MeTab({ onBack }) {
  async function handleReset() {
    if (confirm('This will delete all data. Are you sure?')) {
      try {
        await db.program.clear()
        await db.workoutLog.clear()
        await db.progressionState.clear()
        await db.settings.clear()
        window.location.reload()
      } catch (err) {
        console.error('Failed to reset data:', err)
      }
    }
  }

  return (
    <div className="px-4 py-4 space-y-6 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={() => onBack?.()}
          className="text-sm font-medium hover:bg-divider rounded px-3 py-2 transition-colors"
        >
          Back
        </button>
      </div>

      {/* Reset */}
      <div className="border-t border-divider pt-4">
        <button
          onClick={handleReset}
          className="w-full py-3 bg-[#f0f0f0] text-black rounded font-medium transition-colors hover:bg-[#e0e0e0]"
        >
          Reset All Data
        </button>
      </div>
    </div>
  )
}
