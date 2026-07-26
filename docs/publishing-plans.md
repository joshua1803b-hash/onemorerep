# Publishing a training plan into the app

Two supported routes, same destination. Both write a **Program Pack** to
Supabase; the app picks it up on next launch and hydrates weights from your
logged history.

| Route | Where it works | Uses |
| --- | --- | --- |
| **A — Custom MCP server** | Claude Desktop (Mac) | `mcp-server/` (stdio, purpose-built tools) |
| **B — Supabase connector** | Claude web, Desktop, **and phone** | The official Supabase connector, raw SQL |

Route B exists because a stdio MCP server only runs as a local process on the
Mac — the phone app can't reach it. Custom *remote* connectors would require a
publicly-hosted server implementing OAuth 2.1, which is disproportionate for a
single-user app. Since the app reads its plan from Supabase anyway, writing
there directly with the Supabase connector achieves the same result on any
device.

---

## The invariant (both routes)

> Publishing a plan **only ever writes** `program_pack` and `exercise_catalog`.
> It must **never** write `workout_log`, `progression_state`, or `body_weight`.

That is what guarantees a plan swap keeps every logged workout and carries the
right weights forward.

---

## Route A — Claude Desktop, via the MCP server

Config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "fitness-tracker": {
      "command": "node",
      "args": ["/Users/joshuabiron/onemorerep/mcp-server/src/index.js"],
      "env": {
        "SUPABASE_URL": "https://gjuaecwlxurksqlmoiic.supabase.co",
        "SUPABASE_SERVICE_KEY": "<service_role key from Supabase → Settings → API>"
      }
    }
  }
}
```

Run `cd mcp-server && npm install` once, then restart Claude Desktop.

Flow: share the PDF/Excel → Claude drafts → `preview_import` → you confirm →
`commit_import`. See [`../mcp-server/README.md`](../mcp-server/README.md).

---

## Route B — Any device (incl. phone), via the Supabase connector

Requires the **Supabase connector** enabled in the chat. No local setup.

### Step 1 — Read context

```sql
select canonical_id, display_name, aliases, muscle_group, movement_type
from exercise_catalog order by display_name;
```

Then build the **performance ledger** — the working weights to inherit:

```sql
select
  ex->>'exerciseId'                as exercise_id,
  max((s->>'weight')::numeric)     as best_weight,
  max(w.date)                      as last_date
from workout_log w,
     jsonb_array_elements(w.exercises) ex,
     jsonb_array_elements(ex->'sets') s
where (s->>'completed')::boolean is true
  and (s->>'weight')::numeric > 0
group by 1
order by 1;
```

For the *most recent* weight per movement (what actually seeds a new plan):

```sql
select distinct on (ex->>'exerciseId')
  ex->>'exerciseId'            as exercise_id,
  (s->>'weight')::numeric      as last_weight,
  (s->>'actualReps')::int      as last_reps,
  w.date                       as last_date
from workout_log w,
     jsonb_array_elements(w.exercises) ex,
     jsonb_array_elements(ex->'sets') s
where (s->>'completed')::boolean is true
  and (s->>'weight')::numeric > 0
order by ex->>'exerciseId', w.date desc, (s->>'weight')::numeric desc;
```

### Step 2 — Resolve each plan exercise to a canonical id

Match in this order (same as the server's resolver):

1. exact `canonical_id`
2. exact alias or `display_name`
3. normalised name — lowercase, drop parentheticals (`"(Heavy)"`), collapse
   non-alphanumerics to single spaces, trim
4. otherwise → **new** catalog entry

### Step 3 — Present the mapping and get confirmation

**Do not write anything yet.** Show a table like:

```
Flat DB Press (Heavy)  → flat_db_press_heavy   ✓ carries 30 kg (last: Jun 2)
Seated Cable Row       → cable_row_seated       ✓ carries 67 kg
Pec Deck               → NEW catalog entry       · needs a starting weight
DB Bench               → ⚠ ambiguous: flat_db_press_heavy / machine_chest_press
```

Resolve every `⚠`/NEW with the user before proceeding. Fold each correction
back in as an **alias** so the next import resolves cleanly.

### Step 4 — Write catalog additions

Aliases must be **unioned, never replaced**:

```sql
insert into exercise_catalog
  (canonical_id, display_name, aliases, muscle_group, movement_type)
values
  ('pec_deck', 'Pec Deck', '["Pec Deck","Chest Fly Machine"]', 'chest', 'isolation')
on conflict (canonical_id) do update set
  display_name = excluded.display_name,
  aliases = (
    select jsonb_agg(distinct v)
    from jsonb_array_elements(exercise_catalog.aliases || excluded.aliases) v
  ),
  muscle_group = coalesce(excluded.muscle_group, exercise_catalog.muscle_group),
  movement_type = coalesce(excluded.movement_type, exercise_catalog.movement_type),
  updated_at = now();
```

### Step 5 — Write the pack and activate it

`sessions` is reference-based: `canonicalId` + `sets` + `targetReps`, **no
names, no weights** (weights come from history at hydration time).
`seedWeightKg` is only a cold-start hint for movements with no history.

```sql
insert into program_pack
  (pack_id, version, name, source, progression_rules, sessions, is_active)
values (
  'my_new_plan',
  1,
  'My New Plan',
  '{"kind":"pdf","filename":"plan.pdf"}',
  '{"rpeIncreaseThreshold":8.5,"incrementsKg":{"compound_upper":2.5,"compound_lower":5,"isolation":1.25}}',
  '[
     {"label":"Upper A","exercises":[
       {"canonicalId":"flat_db_press_heavy","sets":3,"targetReps":8,"alternatives":["machine_chest_press"]},
       {"canonicalId":"pec_deck","sets":3,"targetReps":12,"seedWeightKg":30,"alternatives":[]}
     ]}
   ]',
  true
)
on conflict (pack_id) do update set
  version = program_pack.version + 1,
  name = excluded.name,
  source = excluded.source,
  progression_rules = excluded.progression_rules,
  sessions = excluded.sessions,
  is_active = true,
  updated_at = now();

-- exactly one active pack
update program_pack set is_active = false where pack_id <> 'my_new_plan';
```

### Step 6 — Verify

```sql
select pack_id, name, version, is_active,
       jsonb_array_length(sessions) as sessions
from program_pack order by updated_at desc;
```

Then open the app — `syncPacksFromRemote()` runs on startup, pulls the pack,
and activates it. Existing weights and history are untouched.

---

## Validation rules (enforce before writing)

Fail closed — reject rather than write a malformed pack:

- `pack_id` — non-empty string
- `name` — non-empty string
- `sessions` — non-empty array; each has a non-empty `label` and non-empty
  `exercises`
- each exercise — `canonicalId` non-empty string, `sets` a **positive integer**,
  `targetReps` a **positive number**
- `alternatives` — if present, an array of catalog id strings
- every `canonicalId` and every id in `alternatives` must exist in
  `exercise_catalog` after step 4

These mirror `validateProgramPack()` in `src/program/schema.js` and
`mcp-server/src/schema.js`, so a pack accepted here behaves identically in the
app.

---

## Manual exercise swap

The same catalog + ledger powers swapping one exercise: any catalog movement can
be swapped in, and it arrives with its own weight from history rather than a
guess. No pack rewrite needed — the swap is per-session in the app.
