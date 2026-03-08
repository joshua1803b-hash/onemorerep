# Fitness Tracker — Setup & Usage

## Development

```bash
npm run dev          # Start dev server at localhost:5173
npm run build        # Build for production
npm run preview      # Preview production build
```

The dev server auto-reloads on file changes.

---

## Seeding Your Program

The app requires a **program** (training plan with exercises and sessions) to function. You can seed it using the browser console.

### Option 1: Manual via Console

Open the browser DevTools console at `localhost:5173` and run:

```javascript
import { seedProgram } from './src/db/seed.js'

const myProgram = {
  name: 'My PPL Split',
  sessions: [
    {
      label: 'Push',
      exercises: [
        {
          exerciseId: 'barbell_bench_press',
          name: 'Barbell Bench Press',
          sets: 4,
          targetReps: 8,
          startingWeight: 80,
          muscleGroup: 'chest',
          movementType: 'compound_upper',
          alternatives: [
            { exerciseId: 'dumbbell_bench_press', name: 'Dumbbell Bench Press' },
            { exerciseId: 'machine_chest_press', name: 'Machine Chest Press' }
          ]
        }
        // ... more exercises
      ]
    },
    // ... more sessions (Pull, Legs, etc.)
  ]
}

await seedProgram(myProgram)
```

### Option 2: Use the Example Program

```javascript
import { seedProgram, EXAMPLE_PROGRAM } from './src/db/seed.js'
await seedProgram(EXAMPLE_PROGRAM)
```

This seeds a full PPL (Push/Pull/Legs) split with sample exercises.

---

## Exercise Object Structure

Each exercise in a session needs:

```javascript
{
  exerciseId: 'string_id',                              // Unique, lowercase with underscores
  name: 'Exercise Name',
  sets: 4,                                              // Number of sets
  targetReps: 8,                                        // Target reps per set
  startingWeight: 80,                                   // Starting weight in kg
  muscleGroup: 'chest',                                 // chest|back|shoulders|biceps|triceps|quads|hamstrings|calves|etc
  movementType: 'compound_upper',                       // 'compound_upper'|'compound_lower'|'isolation'
  alternatives: [                                       // 2 alternative exercises for swapping
    { exerciseId: 'alt_1_id', name: 'Alt 1 Name' },
    { exerciseId: 'alt_2_id', name: 'Alt 2 Name' }
  ]
}
```

### Key Details

- **exerciseId**: Unique slug, lowercase, underscores. Used to track progression across sessions.
- **sets & targetReps**: Controls session structure. Use different reps for different muscle groups.
- **movementType**: Affects rest timer duration and weight progression increments:
  - `compound_upper`: 180s rest, +2.5kg progression
  - `compound_lower`: 180s rest, +5kg progression
  - `isolation`: 90s rest, +1.25kg progression
- **alternatives**: Show when you tap "Swap" during a workout. Optional but recommended.

---

## Sessions

Three main sessions:
- **Push**: Chest, shoulders, triceps
- **Pull**: Back, biceps
- **Legs**: Quads, hamstrings, calves

You can add custom session labels if needed (e.g., "Upper", "Lower", "Full Body").

---

## Onboarding Flow

1. **First launch**: App shows "Your training. Nothing else." welcome screen
2. **Tap "Get Started"**: Proceeds to "You're ready to go" screen
3. **Tap "Let's go"**: Opens the app
4. **Go to Me tab**: (future) Add exercises via CSV import or the plan editor

For now, seed the program via console before opening the app, or use the Me tab to add them.

---

## Progression Algorithm (RPE Auto-Regulation)

### During a Workout
- After each set, enter the **number of reps completed** and your **RPE (Rate of Perceived Exertion)** on a 6–10 scale
- RPE 8.5 = you could do 1-2 more reps
- If `actualReps > targetReps` OR `rpe < 8.5` → app suggests weight increase for next set

### Between Sessions
- When you next load an exercise:
  - If your **last session's average RPE was < 8.5** → weight increases automatically (with a note: "Weight increased — last session felt easy")
  - Otherwise → keep current weight

This means the app self-regulates intensity without needing fixed rules. You control the pace via RPE.

---

## Usage Tips

- **Always pick a session**: No automatic day-based selection. Tap "Pick a session" on the Today tab.
- **Swapping exercises**: Tap "⇄ Swap" on any exercise to pick an alternative (for the session only).
- **Bonus round**: After all sets, a "Bonus Round" button appears if you want 2 extra sets of a complementary exercise.
- **Rest timer**: Appears at the bottom after each set; dismiss anytime with ✕.
- **History**: All completed workouts appear in the History tab with details.
- **Body weight**: Log daily weight in the Me tab.
- **Units**: Switch between kg/lbs in the Me tab.

---

## Database (IndexedDB)

All data is stored offline in your browser's IndexedDB. No backend, no sync. The PWA works completely offline after first load.

**Tables:**
- `program`: Your training plan
- `workoutLog`: Completed workouts
- `progressionState`: Current weight/RPE per exercise
- `bodyWeight`: Body weight entries
- `settings`: Unit preference, onboarding flag

---

## Deployment (Vercel)

```bash
vercel deploy
```

The app is a static SPA — Vercel will host it immediately. iOS users can add it to the home screen via "Share → Add to Home Screen" in Safari.

---

## Next Steps

1. **Build the program**: Decide your exercises, sessions, starting weights, alternatives
2. **Seed the database** with your program (see above)
3. **Open the app** and pick a session
4. **Log a workout** — enter reps and RPE for each set
5. **Watch progression**: Let RPE guide your weight changes

Enjoy indefinite program use without needing CSV files or external program builders!
