import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getBonusExerciseMuscleGroups } from '../../utils/muscleGroups'

export default function BonusRound({ onSelect, sessionLabel }) {
  const program = useLiveQuery(() => db.program.toArray().then(p => p[0]))

  if (!program) return null

  const bonusMuscleGroups = getBonusExerciseMuscleGroups(sessionLabel)
  if (bonusMuscleGroups.length === 0) return null

  // Find exercises matching bonus muscle groups
  const bonusExercises = program.sessions
    ?.flatMap(s => s.exercises || [])
    .filter(ex => bonusMuscleGroups.includes(ex.muscleGroup))
    .filter((ex, idx, arr) => arr.findIndex(e => e.exerciseId === ex.exerciseId) === idx) // dedup

  if (bonusExercises.length === 0) return null

  function handleAddBonus() {
    // Pick a random bonus exercise
    const bonus = bonusExercises[Math.floor(Math.random() * bonusExercises.length)]
    onSelect(bonus)
  }

  return (
    <button
      onClick={handleAddBonus}
      className="w-full mt-4 py-3 border-2 border-black rounded font-semibold transition-all hover:bg-black hover:text-white animate-fade-in"
    >
      Add Bonus Round
    </button>
  )
}
