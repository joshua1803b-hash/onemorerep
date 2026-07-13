# Fitness Tracker MCP Server

An [MCP](https://modelcontextprotocol.io) server that lets an agent (Claude)
ingest a training plan — from a PDF/Excel the user provides, or one Claude
generates — and publish it into the fitness app by writing to the app's Supabase
database.

The plan is treated as a thin, replaceable *view*. The durable value — your
**logged history and per-exercise weights** (`workout_log`) — is never written
by this server. Working weights come from history, not from the plan.

## What it exposes

**Resources** (read context for the agent)

| URI | Contents |
| --- | --- |
| `catalog://exercises` | Current `exercise_catalog` rows (canonical movements) as JSON. |
| `plan://active` | The active `program_pack` (`is_active = true`), or `null`. |
| `history://performance` | Performance ledger derived from `workout_log`: per `canonicalId` `{ lastWeight, bestWeight, est1RM (Epley), lastReps, lastDate, sessions }`. Completed sets with `weight > 0` only. |

**Tools**

| Tool | Purpose |
| --- | --- |
| `list_catalog()` | Enumerate canonical catalog entries. |
| `resolve_exercise(name, hints?)` | Match one free-text name → `{ status: 'matched'\|'ambiguous'\|'new', candidates:[{ canonicalId, displayName, score }] }`. |
| `get_exercise_history(canonicalId)` | The ledger entry for one movement, or `null`. |
| `preview_import(planDraft)` | **Dry run, no writes.** Resolution report per exercise: status, chosen/candidate ids, and the working weight it would inherit (history `lastWeight`, else `seedWeightKg`). |
| `commit_import(pack)` | Validate the pack fail-closed, then upsert catalog additions (aliases unioned, never dropped), upsert the `program_pack`, mark it active and clear `is_active` on all others. Returns `{ packId, version }`. On invalid input it writes nothing and returns the errors. |

`preview_import` and `commit_import` are split on purpose: the human reviews the
mapping in chat and confirms before `commit_import` writes anything.

## Database schema

The two tables this server writes to (`exercise_catalog`, `program_pack`) plus
the read-only `workout_log` are defined in
[`../docs/supabase-schema.sql`](../docs/supabase-schema.sql). Apply that SQL to
your Supabase project before running the server.

## Setup

```bash
cd mcp-server
npm install
```

### Required environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | **yes** | Your Supabase project URL. |
| `SUPABASE_SERVICE_KEY` | recommended | Service role key. Preferred for **writes** — it bypasses RLS. |
| `SUPABASE_ANON_KEY` | fallback | Used if no service key is set. Reads always work; **writes may be blocked by RLS**. |

For **writes** (`commit_import`), the anon key may be blocked by row-level
security, so a **service role key (`SUPABASE_SERVICE_KEY`) is recommended** for
the server. If both are set, the service key is used.

If `SUPABASE_URL` (or any usable key) is missing, the server exits immediately
with a clear message instead of failing mid-request.

### Run

```bash
npm start          # = node src/index.js
```

The server speaks MCP over **stdio**. It logs status/errors to stderr (stdout is
reserved for the MCP protocol).

## Claude Desktop / Claude Code MCP config

Add a server entry pointing at `src/index.js` with an **absolute path**. For
Claude Desktop this goes in `claude_desktop_config.json`; Claude Code uses the
same `mcpServers` shape (e.g. via `.mcp.json` or `claude mcp add`).

```json
{
  "mcpServers": {
    "fitness-tracker": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/src/index.js"],
      "env": {
        "SUPABASE_URL": "https://YOUR-PROJECT.supabase.co",
        "SUPABASE_SERVICE_KEY": "YOUR-SERVICE-ROLE-KEY"
      }
    }
  }
}
```

Replace `/absolute/path/to/` with the real path to this directory.

## Typical flow

1. **User shares a plan** — a PDF or Excel file (or asks Claude to generate one).
2. **Claude extracts a draft** — reading `catalog://exercises` and
   `history://performance` for context, it produces a `planDraft`:
   `{ name, source?, sessions:[{ label, exercises:[{ rawName|canonicalId, sets, targetReps, seedWeightKg?, alternatives? }] }] }`.
3. **`preview_import(planDraft)`** — a dry-run mapping report: each exercise's
   resolution status (`matched`/`ambiguous`/`new`), candidate canonical ids, and
   the working weight it would inherit from history or its seed. **No writes.**
4. **User confirms in chat** — correcting any ambiguous/new matches. Claude
   assembles the final reference-based `pack` (canonical ids, plus any new
   `catalog` entries with aliases).
5. **`commit_import(pack)`** — validates fail-closed, upserts catalog additions
   (aliases unioned), writes the `program_pack`, and flips it active. The app
   reads the new active pack and hydrates weights from your history.

Because history lives in `workout_log` and is never touched here, swapping the
plan keeps every past workout and carries the right weights forward.
