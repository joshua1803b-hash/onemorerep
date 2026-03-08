# Fitness App — Claude Code Project Brief

## What You Are Building

A minimalist offline-first Progressive Web App (PWA) for iOS Safari. The user adds it to their iPhone home screen. It works completely offline. No backend, no server, no accounts. All data lives on the device using IndexedDB.

The design is pure black and white. Notion-style. No colour, no decoration, no unnecessary elements. Every pixel earns its place.

---

## Tech Stack

- **Framework:** React + Vite
- **PWA:** vite-plugin-pwa (service worker, offline, installable)
- **Storage:** IndexedDB via Dexie.js
- **Styling:** Tailwind CSS (black/white only)
- **CSV parsing:** PapaParse
- **Deployment:** Vercel (free tier)

---

## Design System

```
Background:       #FFFFFF
Primary text:     #111111
Secondary text:   #999999
Dividers:         #F0F0F0
Accent:           NONE — no colour anywhere
Font:             System font stack (-apple-system, BlinkMacSystemFont)
```

### Typography Scale
```
Exercise name:    17px  Regular
Weight / Reps:    28px  600 weight  ← large for gym readability
Secondary info:   13px  Regular  #999999
PR badge:         12px  600 weight  border: 1px solid #111
```

### Rules
- No shadows
- No gradients
- No icons unless absolutely essential
- No animations except functional transitions
- Generous whitespace
- One action per screen moment
- Every screen readable with one hand, sweaty fingers, gym lighting

---

## Navigation

Three tabs fixed at the bottom:

```
[ Today ]  [ History ]  [ Me ]
```

No hamburger menus. No nested navigation beyond one level deep.

---

## Data Models (IndexedDB via Dexie.js)

```javascript
// Program — the imported training plan
program: {
  id,
  name,           // e.g. "PPL Plan"
  createdAt,
  sessions: [     // array of session objects
    {
      label,      // "Push" | "Pull" | "Legs"
      exercises: [
        {
          exerciseId,     // unique slug e.g. "barbell_bench_press"
          name,           // "Barbell Bench Press"
          sets,           // number
          targetReps,     // number
          startingWeight, // kg
          muscleGroup,    // "chest" | "back" | "legs" | "shoulders" | "biceps" | "triceps" | "core"
          movementType,   // "compound" | "isolation"
          restSeconds,    // 180 for compound, 90 for isolation
          alternatives: [
            { exerciseId, name },
            { exerciseId, name }
          ]
        }
      ]
    }
  ]
}

// WorkoutLog — one completed workout session
workoutLog: {
  id,
  date,           // ISO string
  sessionLabel,   // "Push"
  durationSeconds,
  exercises: [
    {
      exerciseId,
      name,
      sets: [
        {
          setNumber,
          targetReps,
          actualReps,
          weight,         // kg
          completed       // boolean
        }
      ],
      wasSwapped,         // boolean
      swappedFrom         // exerciseId if swapped
    }
  ]
}

// ProgressionState — tracks current working weight per exercise
progressionState: {
  exerciseId,
  currentWeight,    // kg
  repRange,         // e.g. "8" — progression is per exercise + rep range
  history: [        // last 3 sessions of this exact exercise
    {
      date,
      allSetsCompleted,   // boolean — did all sets hit target reps?
      weight
    }
  ],
  lastUpdated
}

// BodyWeight — optional body weight log
bodyWeight: {
  id,
  date,
  weight    // kg
}
```

---

## CSV Import Format

The user uploads a CSV with this structure:

```
Exercise,Sets,Reps,Weight,MuscleGroup,MovementType,Session
Barbell Bench Press,4,8,80,chest,compound,Push
Overhead Press,3,10,50,shoulders,compound,Push
Tricep Pushdown,3,12,30,triceps,isolation,Push
Barbell Row,4,8,70,back,compound,Pull
...
```

### Import Processing (Claude handles this before app is built)

When the user uploads their CSV, Claude (in a separate conversation) will:
1. Parse all exercises
2. For each exercise, generate 2 alternative exercises — same muscle group, same movement pattern
3. Assign `exerciseId` slugs (lowercase, underscores)
4. Assign `movementType` (compound = 180s rest, isolation = 90s rest)
5. Output an enriched CSV with columns: `Exercise, Alt1Name, Alt1Id, Alt2Name, Alt2Id, Sets, Reps, Weight, MuscleGroup, MovementType, Session`

The app's import screen accepts this enriched CSV and builds the full program data model from it.

---

## Progression Algorithm

### Core Rule
> Progression is tracked per `exerciseId + repRange` combination only.
> Swapping to an alternative exercise starts fresh progression for that alternative.

### Algorithm

```
On each workout completion for a given exercise:

1. Fetch progressionState for this exerciseId + repRange
2. Check if ALL sets hit targetReps
   - Yes → mark session as allSetsCompleted: true
   - No  → mark session as allSetsCompleted: false
3. Add this session to history (keep last 3 only)
4. Check last 3 sessions:
   - All 3 allSetsCompleted = true → PROGRESS: add increment to currentWeight
   - Any false → HOLD: keep currentWeight same
5. Save updated progressionState

Weight increments:
  compound upper body:   +2.5 kg
  compound lower body:   +5.0 kg
  isolation:             +1.25 kg
```

### Progression Display

Before each exercise, show:
```
Last time: 80kg × 8 reps ✓
Today's target: 80kg × 8 reps
(Progress unlocks next session if you hit this 3x)
```

After completing all sets, show quietly:
```
2/3 sessions completed at target → 1 more to unlock +2.5kg
```
or
```
3/3 ✓ — next session: 82.5kg
```

---

## Today Tab

### Session Selection
- On open, app shows a session picker screen with left/right arrows to cycle through available sessions
- Automatically loads the next session in rotation based on the last completed workout
- Press "Start Workout" button to begin the selected session
- Simple cycling interface — no dropdown or list picker

### Default View: Current Set Only
- After starting workout, shows only the current exercise and its active set
- Minimalist focus on the exercise at hand
- Hides completed exercises and future exercises
- Session progress shown in header (e.g. "3/8 exercises")

### Overview Mode
- Press "Overview" button (top right) to see all exercises in the session
- In overview mode, can reorder exercises using up/down arrow buttons on each exercise
- Useful when machines are occupied or need to adjust workout sequence
- Collapse overview with close button (✕) to return to focused view

### Logging a Set
- Tap a set row to open the logging form
- Shows two inputs: reps and weight (adjustable via kg button)
- Weight is pre-filled from progressionState.currentWeight
- **kg button:** Toggle between reps input and weight adjustment (0.25kg increments)
- Enter reps completed and press "Done"
- RPE slider (6-10, 0.5 increments) with black fill gradient
- RPE slider thumb is black

### Rest Timer (Integrated into Done Button)
- When "Done" is clicked, the button transforms into a rest timer
- Timer animates from white (start) to black (end) using a linear gradient
- Shows MM:SS countdown, with text color automatically switching for contrast
- Rest duration: 180s for compound exercises, 90s for isolation
- Click the timer button to skip the rest period
- Automatically advances to next set when timer completes
- No separate timer bar — all contained in the button

### Swap Exercise
- Each exercise has a "⇄ Swap" button
- Tapping shows 2 pre-loaded alternatives inline (no navigation)
- Selecting a swap replaces the exercise for this session only
- Logs it with wasSwapped: true
- Progression for the swap is tracked independently

### Bonus Round
- After the last set of the last exercise is logged, a "Bonus Round" button appears
- Tapping adds 2 extra sets of the last exercise at the same weight
- No confirmation, no prompt — immediate

### Post-Workout Summary
- Slides up automatically after all sets are logged (including bonus)
- Shows:
  - Total session duration
  - Volume per muscle group vs. weekly target (simple bar)
  - PRs hit today (any weight or rep PR per exerciseId)
  - Progression status per exercise (hold / progress / unlocked)
- Press "Save Workout" to commit to database and move to next session
- One tap to dismiss

---

## History Tab

A reverse-chronological feed. No filters, no tabs — just scroll.

### Feed Item Types

**Workout Entry**
```
Push — Mon 3 March                    42 min
Barbell Bench Press  80kg × 4×8  ↑ PR
Overhead Press       50kg × 3×10
Tricep Pushdown      30kg × 3×12
```
Tap to expand full session detail.

**PR Badge** (inline in feed)
```
🏆 Barbell Bench Press — New PR: 82.5kg
```

**Body Weight Entry**
```
⚖ 84.2kg — Mon 3 March
```

### Volume Trends
Below the feed, a section showing weekly volume per muscle group as a simple line or bar — minimal, black and white.

---

## Me Tab

### Weekly Schedule
Set which session (Push/Pull/Legs/Rest) maps to which day. Configurable. Defaults to a sensible PPL split.

### Import Plan
- Upload enriched CSV (processed by Claude beforehand)
- App parses and builds the full program
- Shows confirmation: "X exercises imported across Push / Pull / Legs"
- Replaces existing program (with warning)

### Edit Plan
After import, the user can:
- Swap which alternative exercises are assigned to each exercise
- Reorder exercises within a session
- Remove exercises from a session
- Cannot change sets/reps/weight — re-import for structural changes

### Body Weight Log
- Simple input: today's weight in kg
- Tap to save — appears in History feed

### Friends
- Add a friend by username
- See their PRs in your History feed as a minimal badge
- No likes, no comments, no activity feed
- Keep it extremely minimal

### Settings
- Units: kg / lbs toggle
- Reset all data (with confirmation)

---

## Onboarding (First Launch Only)

1. Welcome screen — one line: "Your training. Nothing else."
2. Upload your plan (CSV import)
3. Set your weekly schedule (which day = which session)
4. Done — Today tab loads immediately

---

## PWA Configuration

- Installable on iOS Safari via "Add to Home Screen"
- Fully offline after first load (service worker caches all assets)
- App icon: simple black square, white text "FIT" or similar
- No splash screen animations
- Standalone display mode (no browser chrome)
- All data stored in IndexedDB — persists indefinitely unless user resets

---

## Out of Scope (Do Not Build)

- Dark mode
- Backend / cloud sync
- Push notifications
- Apple Health integration
- AI coach or chat interface
- Social features beyond PR sharing
- In-app program builder (CSV import only)
- Video exercise guides
- Calorie or nutrition tracking

---

## File Structure

```
/src
  /components
    /today
      TodayTab.jsx           ← session cycling, overview mode toggle
      ExerciseCard.jsx       ← displays exercise with sets
      SetRow.jsx             ← handles set logging and rest timer
      SwapDrawer.jsx         ← exercise alternatives
      BonusRound.jsx         ← bonus set selection
      PostWorkoutSummary.jsx ← workout completion summary
    /history
      HistoryTab.jsx
      WorkoutEntry.jsx
      PRBadge.jsx
      VolumeChart.jsx
    /me
      MeTab.jsx
      ImportPlan.jsx
      PlanEditor.jsx
      ScheduleEditor.jsx
      BodyWeightLog.jsx
      Friends.jsx
    TabBar.jsx
    Onboarding.jsx
  /db
    db.js              ← Dexie.js schema and setup
    program.js         ← program CRUD
    workoutLog.js      ← logging functions
    progression.js     ← progression algorithm
    bodyWeight.js      ← body weight log
  /contexts
    SettingsContext.jsx
    RestTimerContext.jsx (kept for future use, no longer actively used)
  /hooks
    useSettings.js
    useRestTimer.js
  /utils
    csvParser.js       ← PapaParse CSV import logic
    progressionEngine.js ← pure progression algorithm logic
    muscleGroups.js    ← muscle group metadata
  App.jsx
  main.jsx
/public
  manifest.json
  service-worker.js
```

---

## Notes for Claude Code

- Use Dexie.js for all IndexedDB operations — do not use localStorage for workout data
- The progression engine in `/utils/progressionEngine.js` should be pure functions — no side effects, easy to test
- All weights stored internally in kg — convert to lbs in display layer only if user has lbs setting enabled
- Rest timer is integrated into the Done button at SetRow level — no global timer bar
- CSV import must be tolerant of minor formatting differences (extra spaces, different capitalisation)
- Do not use any external UI component libraries — build all components from scratch using Tailwind utility classes only
- Every screen must work on iPhone SE screen size (375px wide) and above
- No required props without defaults — every component must render without crashing if data is missing
- Session selection uses arrow cycling, not list picker — stateless and minimal UI
- Overview mode allows exercise reordering via up/down arrows
- Last completed session is stored in settings to auto-load next session
