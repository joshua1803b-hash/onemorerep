import { useState } from 'react'
import { db } from '../db/db'
import { seedProgram, JEFF_NIPPARD_4X } from '../db/seed'

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)
    try {
      // Seed the Jeff Nippard program
      await seedProgram(JEFF_NIPPARD_4X)

      // Mark onboarding as complete
      await db.settings.put({ key: 'onboardingComplete', value: true })
      onComplete()
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <div className="max-w-md w-full px-6">
        {step === 0 && (
          <div className="text-center space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Your training.</h1>
              <p className="text-lg text-secondary mt-2">Nothing else.</p>
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-3 bg-black text-white font-medium rounded transition-colors hover:bg-[#333333]"
            >
              Get Started
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="text-center space-y-8">
            <div>
              <h2 className="text-2xl font-bold">You're ready to go.</h2>
              <p className="text-secondary mt-2">Loading your training program...</p>
            </div>

            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-3 bg-black text-white font-medium rounded transition-colors hover:bg-[#333333] disabled:opacity-50"
            >
              {loading ? 'Setting up...' : "Let's go"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
