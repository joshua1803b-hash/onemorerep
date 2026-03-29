import { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../db/db'

const SettingsContext = createContext(null)

const DEFAULT_COMPOUND_REST = 180
const DEFAULT_ISOLATION_REST = 90

export function SettingsProvider({ children }) {
  const [compoundRest, setCompoundRest] = useState(DEFAULT_COMPOUND_REST)
  const [isolationRest, setIsolationRest] = useState(DEFAULT_ISOLATION_REST)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function loadTimerSettings() {
      const compound = await db.settings.get('restTimer_compound')
      const isolation = await db.settings.get('restTimer_isolation')
      if (compound?.value) setCompoundRest(compound.value)
      if (isolation?.value) setIsolationRest(isolation.value)
      setLoaded(true)
    }
    loadTimerSettings()
  }, [])

  async function saveRestTimers(compound, isolation) {
    await db.settings.put({ key: 'restTimer_compound', value: compound })
    await db.settings.put({ key: 'restTimer_isolation', value: isolation })
    setCompoundRest(compound)
    setIsolationRest(isolation)
  }

  // Display weight in kg
  function displayWeight(kg, decimals = 1) {
    if (!kg && kg !== 0) return '0 kg'
    return `${(kg).toFixed(decimals)} kg`
  }

  return (
    <SettingsContext.Provider value={{ displayWeight, compoundRest, isolationRest, saveRestTimers, loaded }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
