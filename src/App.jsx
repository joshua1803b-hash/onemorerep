import { useEffect, useState } from 'react'
import { db } from './db/db'
import { SettingsProvider } from './contexts/SettingsContext'
import { RestTimerProvider } from './contexts/RestTimerContext'
import { useSettings } from './contexts/SettingsContext'
import HomeScreen from './components/HomeScreen'
import TodayTab from './components/today/TodayTab'
import HistoryTab from './components/history/HistoryTab'
import MeTab from './components/me/MeTab'
import Onboarding from './components/Onboarding'
import { restoreFromSupabase } from './db/sync'
import { ensureProgramSystem, syncPacksFromRemote } from './program/localProvider'

function AppContent() {
  const [activeTab, setActiveTab] = useState(null) // null means home screen
  const [onboarded, setOnboarded] = useState(null)
  const { loaded } = useSettings()

  // Check onboarding status on mount and when app resumes from standby or rotates
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const setting = await db.settings.get('onboardingComplete')
        setOnboarded(setting?.value === true)
      } catch (err) {
        console.error('Failed to check onboarding:', err)
        // Default to false if database fails, user can re-onboard
        setOnboarded(false)
      }
    }

    async function restoreIfEmpty() {
      const [workoutCount, programCount] = await Promise.all([
        db.workoutLog.count(),
        db.program.count()
      ])
      if (workoutCount === 0 && programCount === 0) {
        await restoreFromSupabase()
      }
    }

    restoreIfEmpty()
      .then(ensureProgramSystem)
      .then(checkOnboarding)
      // Pull any remotely-published packs (e.g. from the MCP server) after the
      // app has rendered. syncPacksFromRemote never throws, so a network failure
      // can't block load; the extra .catch guards the earlier chain steps too.
      .then(() => syncPacksFromRemote())
      .catch((err) => console.error('Startup chain failed:', err))

    // Re-check onboarding when app comes back from standby
    function handleVisibilityChange() {
      if (!document.hidden) {
        checkOnboarding()
      }
    }

    // Re-check onboarding when device orientation changes
    function handleOrientationChange() {
      checkOnboarding()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  if (!loaded || onboarded === null) {
    return <div className="w-full h-full flex items-center justify-center bg-white">Loading...</div>
  }

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  return (
    <div className="flex flex-col h-full w-full bg-white">
      <main className="flex-1 overflow-y-auto">
        {activeTab === null && <HomeScreen onNavigate={setActiveTab} />}
        {activeTab === 'today' && <TodayTab onBack={() => setActiveTab(null)} />}
        {activeTab === 'history' && <HistoryTab onBack={() => setActiveTab(null)} />}
        {activeTab === 'me' && <MeTab onBack={() => setActiveTab(null)} />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <RestTimerProvider>
        <AppContent />
      </RestTimerProvider>
    </SettingsProvider>
  )
}
