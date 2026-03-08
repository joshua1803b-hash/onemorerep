import { createContext, useContext, useState } from 'react'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [loaded] = useState(true)

  // Display weight in kg
  function displayWeight(kg, decimals = 1) {
    if (!kg && kg !== 0) return '0 kg'
    return `${(kg).toFixed(decimals)} kg`
  }

  return (
    <SettingsContext.Provider value={{ displayWeight, loaded }}>
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
