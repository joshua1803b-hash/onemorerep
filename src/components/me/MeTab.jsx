import { useState } from 'react'
import { db } from '../../db/db'
import { activateDefaultPack, importPack } from '../../program/localProvider'
import { useSettings } from '../../contexts/SettingsContext'

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, '0')}`
}

export default function MeTab({ onBack }) {
  const [loading, setLoading] = useState(false)
  const { compoundRest, isolationRest, saveRestTimers } = useSettings()
  const [compound, setCompound] = useState(null)
  const [isolation, setIsolation] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState(null)
  const [importing, setImporting] = useState(false)

  // Use local state if edited, otherwise fall back to context values
  const compoundVal = compound ?? compoundRest
  const isolationVal = isolation ?? isolationRest

  function adjust(type, delta) {
    if (type === 'compound') {
      setCompound(Math.max(30, compoundVal + delta))
    } else {
      setIsolation(Math.max(30, isolationVal + delta))
    }
  }

  async function handleSaveTimers() {
    await saveRestTimers(compoundVal, isolationVal)
    setCompound(null)
    setIsolation(null)
  }

  async function handleLoadProgram() {
    setLoading(true)
    try {
      await activateDefaultPack()
      window.location.reload()
    } catch (err) {
      console.error('Failed to load program:', err)
      setLoading(false)
    }
  }

  async function handleImport() {
    setImporting(true)
    setImportError(null)
    try {
      await importPack(importText)
      window.location.reload()
    } catch (err) {
      console.error('Failed to import plan:', err)
      setImportError(err.message || 'Import failed')
      setImporting(false)
    }
  }

  async function handleReset() {
    if (confirm('This will delete all data. Are you sure?')) {
      try {
        await Promise.all([
          db.program.clear(),
          db.workoutLog.clear(),
          db.progressionState.clear(),
          db.programPack.clear(),
          db.exerciseCatalog.clear(),
          db.settings.clear()
        ])
        window.location.reload()
      } catch (err) {
        console.error('Failed to reset data:', err)
      }
    }
  }

  return (
    <div className="px-4 space-y-6 max-w-md mx-auto" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={() => onBack?.()}
          className="text-sm font-medium hover:bg-divider rounded px-3 py-2 transition-colors"
        >
          Back
        </button>
      </div>

      {/* Rest Timers */}
      <div className="border-t border-divider pt-4 space-y-4">
        <h2 className="text-sm font-semibold">Rest Timers</h2>

        {[
          { label: 'Compound', type: 'compound', val: compoundVal },
          { label: 'Isolation', type: 'isolation', val: isolationVal }
        ].map(({ label, type, val }) => (
          <div key={type} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjust(type, -15)}
                className="w-8 h-8 flex items-center justify-center border border-divider rounded hover:bg-divider transition-colors text-lg"
              >
                −
              </button>
              <span className="text-sm font-medium w-10 text-center">{formatDuration(val)}</span>
              <button
                onClick={() => adjust(type, 15)}
                className="w-8 h-8 flex items-center justify-center border border-divider rounded hover:bg-divider transition-colors text-lg"
              >
                +
              </button>
            </div>
          </div>
        ))}

        {(compound !== null || isolation !== null) && (
          <button
            onClick={handleSaveTimers}
            className="w-full py-2 bg-black text-white rounded font-medium transition-colors hover:bg-[#333333] text-sm"
          >
            Save
          </button>
        )}
      </div>

      {/* Load Program */}
      <div className="border-t border-divider pt-4">
        <button
          onClick={handleLoadProgram}
          disabled={loading}
          className="w-full py-3 bg-black text-white rounded font-medium transition-colors hover:bg-[#333333] disabled:opacity-50"
        >
          {loading ? 'Loading Program...' : 'Load Default Program'}
        </button>
      </div>

      {/* Import Plan (JSON) */}
      <div className="border-t border-divider pt-4 space-y-3">
        {!showImport ? (
          <button
            onClick={() => setShowImport(true)}
            className="w-full py-3 border border-black text-black rounded font-medium transition-colors hover:bg-black hover:text-white"
          >
            Import Plan (JSON)
          </button>
        ) : (
          <div className="space-y-3">
            <label className="text-sm font-semibold block">Paste a Program Pack</label>
            <p className="text-xs text-secondary">
              Swaps in a new plan. Your workout history and weights are kept — matching
              exercises carry their weight forward.
            </p>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='{"packId":"my_plan","name":"My Plan","sessions":[...]}'
              rows={6}
              className="w-full px-2 py-2 border border-divider rounded text-xs font-mono"
            />
            {importError && (
              <p className="text-xs text-black border border-black rounded p-2 break-words">{importError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="flex-1 py-2 bg-black text-white rounded font-medium text-sm transition-colors hover:bg-[#333333] disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import & Activate'}
              </button>
              <button
                onClick={() => { setShowImport(false); setImportError(null) }}
                className="flex-1 py-2 border border-divider rounded text-sm transition-colors hover:bg-divider"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
