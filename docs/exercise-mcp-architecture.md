# Exercise MCP Architecture — Design Spec

Status: **Draft for review** · Scope: architecture only, no code yet
Source of truth: **Supabase** · Import safety: **always preview & confirm**

---

## 1. Goal

Make the *training plan* a swappable, disposable input while the app's real
value — **your logged history and per-exercise weights** — persists forever and
is reused by every future plan.

Concretely, the user wants to:

1. Build an **MCP server** that can ingest a training plan from a **PDF or
   Excel file**, or generate one from scratch with Claude.
2. Have that plan **written into the app** (replacing the current plan).
3. **Keep all past data** — every workout, every weight, untouched.
4. Maintain a **canonical database of all exercises + weights ever done**, so
   a new plan (or a manual exercise swap) automatically inherits the right
   starting weight and history.

The design below centres on that canonical database. The plan becomes a thin,
replaceable *view* over it.

---

## 2. Core principle: separate the record from the plan

The single invariant that makes "swap the plan, keep the data" work:

> A plan swap **only ever replaces the plan definition.** It never writes to
> the tables that hold what you actually did.

Today's schema already half-enforces this (`src/db/db.js`):

| Table | Role | Touched by a plan swap? |
| --- | --- | --- |
| `workoutLog` | Denormalised snapshot of every set performed (`src/db/workoutLog.js:8`) — **ground truth** | **Never** |
| `bodyWeight` | Body-weight log | **Never** |
| `progressionState` | Current weight/RPE per exercise, keyed by `exerciseId` | Re-seeded from ledger (carry-forward), never wiped |
| `program` | The current plan | **Replaced** — this is the only "swap" |

The new work is to insert a **canonical exercise layer** between the plan and
the record, so identity is stable across plans.

---

## 3. Data model

### 3.1 New: `exercise_catalog` (canonical movements)

The "database of all past exercises." One row per real-world movement,
independent of any plan.

```jsonc
{
  "canonical_id": "flat_db_press",        // stable slug, never reused
  "display_name": "Flat Dumbbell Press",
  "aliases": ["Flat DB Press", "DB Bench", "Dumbbell Bench Press"],
  "muscle_group": "chest",
  "movement_type": "compound_upper",       // drives progression increment
  "equipment": "dumbbell",                  // optional, aids matching
  "default_increment_kg": 2.5,              // fallback if plan omits rules
  "created_at": "2026-07-13T...",
  "updated_at": "2026-07-13T..."
}
```

- `aliases` grows every time the user confirms/corrects a match during import —
  the catalog gets smarter with use.
- `canonical_id` is the join key for history and progression.

### 3.2 New: `program_pack` (reference-based, versioned plan)

Replaces the inline, weight-baked plan in `src/db/seed.js`. Exercises are
**references** into the catalog; weights are **not** stored here — they come
from the ledger at load time.

```jsonc
{
  "pack_id": "jeff_nippard_4x",
  "version": 3,
  "name": "Jeff Nippard Essentials 4x",
  "source": { "kind": "pdf", "filename": "plan.pdf", "imported_at": "..." },
  "progression_rules": {                    // moved off progressionEngine.js
    "rpe_increase_threshold": 8.5,
    "increments_kg": { "compound_upper": 2.5, "compound_lower": 5, "isolation": 1.25 }
  },
  "sessions": [
    {
      "label": "Upper A",
      "exercises": [
        {
          "canonical_id": "flat_db_press",  // reference, NOT a copy
          "sets": 1,
          "target_reps": 5,
          "note": "Heavy",
          "alternatives": ["machine_chest_press", "weighted_dip"]  // catalog ids
        }
      ]
    }
  ]
}
```

Note the two changes vs. `createExercise()` in `src/db/seed.js:162`:
`startingWeight` is gone (ledger owns it), and `alternatives` are catalog ids
rather than inline `{exerciseId, name}` blobs.

### 3.3 Existing tables — unchanged shape

- `workout_log` / `workoutLog` — untouched. Still the per-set ground truth.
- `progression_state` / `progressionState` — same shape, but seeded/aliased
  from the ledger instead of from a plan's baked `startingWeight`.
- `body_weight` / `bodyWeight` — untouched.

### 3.4 The ledger is a **projection**, not a table you write to

`exercise_performance` (last weight, top set, est. 1RM, last date per
`canonical_id`) is **derived from `workout_log`**, never authored directly.
This is deliberate: it can never drift from ground truth, and it's fully
rebuildable. Materialise it as a Supabase view (or a cached Dexie table
recomputed on sync). Pseudocode:

```
for each workout in workoutLog (chronological):
  for each ex in workout.exercises:
    cid = resolveToCanonical(ex.exerciseId)      // via alias/identity map
    ledger[cid].lastWeight   = topSetWeight(ex.sets)
    ledger[cid].lastDate     = workout.date
    ledger[cid].bestWeight   = max(ledger[cid].bestWeight, topSetWeight(ex.sets))
    ledger[cid].est1RM       = max(..., epley(ex.sets))
```

---

## 4. Identity resolution — the hard part

A PDF/Excel gives free-text names ("Flat DB Press (Heavy)"). The system's real
job is mapping each parsed row to a `canonical_id` so history carries forward —
or creating a new catalog entry when it's genuinely new.

### 4.1 Resolver algorithm (ranked, highest confidence first)

1. **Exact `canonical_id`** match (generated plans can emit ids directly).
2. **Exact alias** match (case/space-normalised) against `exercise_catalog.aliases`.
3. **Normalised name** match — lowercase, strip parentheticals/qualifiers
   ("(Heavy)", "(Back off)"), collapse whitespace, singularise.
4. **Fuzzy** match (token-set ratio) above a threshold → *candidate*, not auto-accept.
5. **LLM judgement** (inside the MCP) for the remainder, returning
   `{canonical_id | NEW, confidence, rationale}`.

Each parsed exercise resolves to one of:

```
MATCHED   (confidence ≥ high)  → bind to canonical_id, carry history
AMBIGUOUS (candidates found)   → needs user choice
NEW       (no good candidate)  → propose new catalog entry
```

### 4.2 Always preview & confirm

No import mutates state until the user approves a **mapping diff**:

```
Upper A
  Flat DB Press (Heavy)   → flat_db_press        ✓ carries 30 kg (last: Jun 2)
  Seated Cable Row        → cable_row_seated      ✓ carries 67 kg
  Pec Deck                → NEW catalog entry      · start weight?
  DB Bench                → ⚠ 2 candidates: flat_db_press / incline_db_press
```

Every correction the user makes is written back as a new **alias**, so the next
import of the same plan resolves cleanly. This confirm step is the mechanism
that guarantees weight history is never silently mislinked.

---

## 5. Import pipeline (PDF/Excel → live plan)

```
 PDF / Excel / "generate one"
        │  (Claude parses file → structured draft)
        ▼
 plan draft  { name, sessions:[ {label, exercises:[ {rawName, sets, reps} ] } ] }
        │  resolve_exercise() per row against exercise_catalog
        ▼
 resolution report  (MATCHED / AMBIGUOUS / NEW  +  ledger weights)
        │  ← user confirms / corrects in preview
        ▼
 commit_import():
   1. upsert new catalog rows + new aliases
   2. write program_pack (reference-based, versioned)
   3. seed progression_state per exercise FROM LEDGER (aliased carry-forward)
   4. set active pack_id
        │
        ▼
 app syncs pack from Supabase → Dexie → TodayTab renders it
```

`workout_log` and `body_weight` are never in this write path.

---

## 6. MCP server contract

The MCP server is the ingestion/authoring surface. It talks to **Supabase**;
the PWA reads the results from Supabase and caches to Dexie (offline-first).
The browser never speaks MCP directly.

### 6.1 Resources (read context for the agent)

- `catalog://exercises` — full canonical catalog (for matching/generation).
- `plan://active` — the current `program_pack`.
- `history://performance` — the ledger (last/best weights per movement).

### 6.2 Tools

| Tool | Signature | Purpose |
| --- | --- | --- |
| `list_catalog` | `() → Exercise[]` | Enumerate canonical movements. |
| `resolve_exercise` | `(name, hints?) → {status, candidates[]}` | Match one free-text name. |
| `preview_import` | `(planDraft) → ResolutionReport` | Dry-run: full mapping diff + ledger weights, **no writes**. |
| `commit_import` | `(resolvedPlan) → {pack_id, version}` | Apply after user confirmation. |
| `get_exercise_history` | `(canonical_id) → LedgerEntry` | Weight/rep history for one movement (also powers manual swap). |
| `add_alias` | `(canonical_id, alias)` | Teach the catalog a name variant. |

`preview_import` and `commit_import` are split precisely so the confirm step
sits between them.

---

## 7. Manual exercise swap (existing feature, upgraded)

`src/components/today/SwapDrawer.jsx` currently swaps to inline `alternatives`.
With the catalog it becomes "pick any catalog movement," and the chosen
exercise arrives with its own weight from the ledger via `get_exercise_history`
— no more guessing a starting weight (`SwapDrawer.jsx:13`). Custom exercises
created in the drawer become catalog entries instead of loose
`exerciseLibrary` rows.

---

## 8. Data-preservation guarantees

| Guarantee | Mechanism |
| --- | --- |
| No workout ever lost on a plan swap | `workout_log` is out of the import write path; plan holds references, not history |
| Weights carry to new plans | `progression_state` seeded from the ledger via canonical id + aliases |
| Ledger can't corrupt | It's a projection of `workout_log`; rebuildable at any time |
| Wrong matches don't silently mislink | Mandatory preview & confirm before `commit_import` |
| Old ids stay queryable | Legacy slugs become catalog entries/aliases during migration |

---

## 9. Migration / backfill (one-time)

Existing installs use hand-authored slugs. Backfill once:

1. Scan `seed.js`, `workoutLog`, and `exerciseLibrary` for every distinct
   `exerciseId` + name.
2. Create an `exercise_catalog` row per distinct movement; fold observed name
   variants into `aliases`.
3. Build the initial ledger projection from `workoutLog`.
4. Convert the current `JEFF_NIPPARD_4X` plan into the first `program_pack`
   (reference-based).

After backfill, every future imported plan binds onto real history.

---

## 10. App-side seam (kept minimal)

A provider indirection so UI stops importing the plan constant directly:

- `src/program/schema.js` — `program_pack` schema + validator (fail-closed).
- `src/program/ProgramProvider.js` — context: `getActivePack`, `listPacks`,
  `setActivePack`, `getExercise`, `getAlternatives`, `getProgressionRules`.
- `src/db/db.js` — v4 migration: add `exerciseCatalog`, `programPack`; keep all
  log tables.
- `src/utils/progressionEngine.js` — take `progression_rules` as a param
  instead of the hardcoded switch at `progressionEngine.js:31`.
- `src/db/sync.js` — add catalog + pack push/pull; **log-table sync unchanged**.
- `Onboarding.jsx` / `MeTab.jsx` / `TodayTab.jsx:146` — read via provider
  instead of importing `JEFF_NIPPARD_4X` / hitting `db.program` directly.

---

## 11. Sync & offline

Supabase is the source of truth for **catalog + packs**; Dexie is the
offline cache the app renders from (mirrors current `restoreFromSupabase` at
`src/db/sync.js:87`). The MCP can write a new pack while the phone is offline;
the app picks it up on next sync. Logs continue to sync device→Supabase exactly
as today.

---

## 12. Open questions for review

1. **Units** — ledger stores canonical **kg** (matches current app); display
   conversion stays in settings. Confirm kg as storage unit.
2. **Multiple concurrent plans** or strictly one active at a time? Schema
   supports many (`pack_id`); UI currently assumes one.
3. **Est. 1RM formula** for the ledger — Epley vs. Brzycki. Affects
   carry-forward when rep ranges differ between plans.
4. **Auth** — Supabase is currently anon-key/single-user (`src/db/supabase.js`).
   Multi-user would need RLS + per-user scoping before the MCP writes.
5. **PDF/Excel parsing** happens in the MCP (Claude), or a deterministic
   pre-parser (PapaParse for Excel/CSV) feeding Claude only for exercise-name
   resolution? Latter is cheaper/more reliable for tabular Excel.

---

## 13. Phasing

1. **Catalog + ledger + backfill + reference-based pack + provider seam**
   (pure app/DB; no MCP). Delivers "plans are swappable, history carries" with
   a paste-JSON import.
2. **Resolver + preview/confirm UI** (still no server) — the mapping diff and
   alias-learning loop.
3. **MCP server** wrapping 1–2 as tools/resources, enabling PDF/Excel ingestion
   and generation through Claude.

Each phase is independently shippable; step 2 already gives working
"load a plan, keep history" behaviour before any MCP infrastructure exists.
