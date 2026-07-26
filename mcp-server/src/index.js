#!/usr/bin/env node
/**
 * Fitness Tracker MCP server.
 *
 * Lets an agent (Claude) ingest a training plan — from a PDF/Excel the user
 * provides, or one Claude generates — and publish it into the fitness app by
 * writing reference-based Program Packs and canonical exercise entries to the
 * app's Supabase database.
 *
 * The plan is a thin, replaceable view; the user's logged history and weights
 * (workout_log) are the durable value and are never written by this server.
 * Working weights come from history, not the plan.
 *
 * Transport: stdio. SDK: @modelcontextprotocol/sdk (McpServer, registerTool /
 * registerResource).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import {
  getSupabase,
  checkEnv,
  mapCatalogRow,
  mapPackRow,
  toCatalogRow
} from './supabase.js'
import { resolveExercise, unionAliases } from './resolver.js'
import { buildLedger } from './ledger.js'
import { validateProgramPack } from './schema.js'

// --- Data access ------------------------------------------------------------

async function fetchCatalog() {
  const { client } = getSupabase()
  const { data, error } = await client.from('exercise_catalog').select('*')
  if (error) throw new Error(`exercise_catalog read failed: ${error.message}`)
  return (data || []).map(mapCatalogRow)
}

async function fetchActivePack() {
  const { client } = getSupabase()
  const { data, error } = await client
    .from('program_pack')
    .select('*')
    .eq('is_active', true)
    .limit(1)
  if (error) throw new Error(`program_pack read failed: ${error.message}`)
  return data && data.length ? mapPackRow(data[0]) : null
}

async function fetchWorkouts() {
  const { client } = getSupabase()
  const { data, error } = await client
    .from('workout_log')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw new Error(`workout_log read failed: ${error.message}`)
  return data || []
}

/** Build the performance ledger { canonicalId: entry } from live data. */
async function buildLedgerFromDb() {
  const [workouts, catalog] = await Promise.all([fetchWorkouts(), fetchCatalog()])
  return buildLedger(workouts, catalog)
}

// --- Response helpers -------------------------------------------------------

function jsonContent(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

function errorContent(message) {
  return { content: [{ type: 'text', text: message }], isError: true }
}

function resourceJson(uri, value) {
  return {
    contents: [
      { uri, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }
    ]
  }
}

// --- Server wiring ----------------------------------------------------------

const server = new McpServer({
  name: 'fitness-tracker-mcp',
  version: '1.0.0'
})

// ---- Resources -------------------------------------------------------------

server.registerResource(
  'catalog',
  'catalog://exercises',
  {
    title: 'Exercise catalog',
    description: 'Current exercise_catalog rows (canonical movements) as JSON.',
    mimeType: 'application/json'
  },
  async (uri) => {
    const catalog = await fetchCatalog()
    return resourceJson(uri.href, catalog)
  }
)

server.registerResource(
  'active-plan',
  'plan://active',
  {
    title: 'Active program pack',
    description: 'The program_pack row with is_active = true (or null).',
    mimeType: 'application/json'
  },
  async (uri) => {
    const pack = await fetchActivePack()
    return resourceJson(uri.href, pack)
  }
)

server.registerResource(
  'performance-history',
  'history://performance',
  {
    title: 'Performance ledger',
    description:
      'Per-canonical-id history derived from workout_log: lastWeight, bestWeight, ' +
      'est1RM (Epley), lastReps, lastDate, sessions. Completed sets with weight > 0 only.',
    mimeType: 'application/json'
  },
  async (uri) => {
    const ledger = await buildLedgerFromDb()
    return resourceJson(uri.href, ledger)
  }
)

// ---- Tools -----------------------------------------------------------------

server.registerTool(
  'list_catalog',
  {
    title: 'List catalog',
    description: 'Enumerate the canonical exercise catalog entries.',
    inputSchema: {}
  },
  async () => {
    try {
      const catalog = await fetchCatalog()
      return jsonContent(catalog)
    } catch (err) {
      return errorContent(String(err.message || err))
    }
  }
)

server.registerTool(
  'resolve_exercise',
  {
    title: 'Resolve exercise',
    description:
      'Match one free-text exercise name to catalog canonical ids. Returns ' +
      "{ status: 'matched'|'ambiguous'|'new', candidates: [{ canonicalId, displayName, score }] }. " +
      'Matching order: exact canonical_id, exact alias/display_name, normalized-name.',
    inputSchema: {
      name: z.string().describe('The exercise name (or canonical id) to resolve.'),
      hints: z
        .object({
          muscleGroup: z.string().optional(),
          movementType: z.string().optional(),
          equipment: z.string().optional()
        })
        .partial()
        .optional()
        .describe('Optional attributes used only to break ties between equal candidates.')
    }
  },
  async ({ name, hints }) => {
    try {
      const catalog = await fetchCatalog()
      return jsonContent(resolveExercise(name, catalog, hints || {}))
    } catch (err) {
      return errorContent(String(err.message || err))
    }
  }
)

server.registerTool(
  'get_exercise_history',
  {
    title: 'Get exercise history',
    description:
      'Return the performance ledger entry for one canonical id, or null if the ' +
      'movement has no completed history yet.',
    inputSchema: {
      canonicalId: z.string().describe('The catalog canonical id to look up.')
    }
  },
  async ({ canonicalId }) => {
    try {
      const ledger = await buildLedgerFromDb()
      return jsonContent(ledger[canonicalId] || null)
    } catch (err) {
      return errorContent(String(err.message || err))
    }
  }
)

// planDraft schema — loose by design so raw extractions can be previewed.
const draftExerciseShape = z
  .object({
    rawName: z.string().optional(),
    canonicalId: z.string().optional(),
    sets: z.number().optional(),
    targetReps: z.number().optional(),
    seedWeightKg: z.number().optional(),
    note: z.string().optional(),
    alternatives: z.array(z.string()).optional()
  })
  .passthrough()

const draftSessionShape = z.object({
  label: z.string(),
  exercises: z.array(draftExerciseShape)
})

server.registerTool(
  'preview_import',
  {
    title: 'Preview import (dry run)',
    description:
      'DRY RUN — no writes. For each draft exercise, report its resolution status, ' +
      'chosen/candidate canonical id(s), and the working weight it would inherit ' +
      "(history lastWeight, else seedWeightKg). The human reviews this mapping before commit_import.",
    inputSchema: {
      planDraft: z
        .object({
          name: z.string().optional(),
          source: z.any().optional(),
          sessions: z.array(draftSessionShape)
        })
        .passthrough()
        .describe('The draft plan: { name?, source?, sessions:[{label, exercises:[...]}] }.')
    }
  },
  async ({ planDraft }) => {
    try {
      const [catalog, ledger] = await Promise.all([fetchCatalog(), buildLedgerFromDb()])
      return jsonContent(previewImport(planDraft, catalog, ledger))
    } catch (err) {
      return errorContent(String(err.message || err))
    }
  }
)

server.registerTool(
  'commit_import',
  {
    title: 'Commit import',
    description:
      'Validate a Program Pack fail-closed, then (on success) upsert any catalog ' +
      'additions with unioned aliases, upsert the program_pack, mark it active and ' +
      'clear is_active on all others. On failure, writes nothing and returns the errors. ' +
      'Returns { packId, version } on success.',
    inputSchema: {
      pack: z
        .object({})
        .passthrough()
        .describe('The reference-based Program Pack to publish.')
    }
  },
  async ({ pack }) => {
    try {
      return jsonContent(await commitImport(pack))
    } catch (err) {
      return errorContent(String(err.message || err))
    }
  }
)

// --- Tool logic -------------------------------------------------------------

/**
 * Build the dry-run resolution report for a plan draft. No writes.
 */
function previewImport(planDraft, catalog, ledger) {
  const draft = planDraft || {}
  const report = {
    name: draft.name || null,
    source: draft.source ?? null,
    sessions: []
  }
  const summary = { matched: 0, ambiguous: 0, new: 0 }

  for (const session of draft.sessions || []) {
    const outSession = { label: session?.label ?? null, exercises: [] }
    for (const ex of session?.exercises || []) {
      const raw = ex?.canonicalId || ex?.rawName || ''
      const resolution = resolveExercise(raw, catalog, ex?.hints || {})
      summary[resolution.status] = (summary[resolution.status] || 0) + 1

      const chosenId =
        resolution.status === 'matched' ? resolution.candidates[0].canonicalId : null

      // Working weight: history first, else the cold-start seed, else none.
      const histEntry = chosenId ? ledger[chosenId] : null
      let workingWeight = null
      let weightSource = 'none'
      if (histEntry && (histEntry.lastWeight ?? 0) > 0) {
        workingWeight = histEntry.lastWeight
        weightSource = 'history'
      } else if (typeof ex?.seedWeightKg === 'number') {
        workingWeight = ex.seedWeightKg
        weightSource = 'seed'
      }

      outSession.exercises.push({
        rawName: ex?.rawName ?? null,
        requested: raw,
        status: resolution.status,
        chosenCanonicalId: chosenId,
        candidates: resolution.candidates,
        sets: ex?.sets ?? null,
        targetReps: ex?.targetReps ?? null,
        workingWeight,
        weightSource,
        history: histEntry || null,
        alternatives: (ex?.alternatives || []).map((alt) => {
          const r = resolveExercise(alt, catalog)
          return {
            requested: alt,
            status: r.status,
            chosenCanonicalId: r.status === 'matched' ? r.candidates[0].canonicalId : null,
            candidates: r.candidates
          }
        })
      })
    }
    report.sessions.push(outSession)
  }

  report.summary = summary
  report.readyToCommit = summary.ambiguous === 0 && summary.new === 0
  return report
}

/**
 * Validate + publish a Program Pack. Fail-closed. Returns { valid:false, errors }
 * (no writes) when invalid, or { packId, version } on success.
 */
async function commitImport(pack) {
  const { valid, errors } = validateProgramPack(pack)
  if (!valid) {
    return { ok: false, errors }
  }

  const { client } = getSupabase()
  const now = new Date().toISOString()

  // 1. Gather catalog additions: pack.catalog plus any inline entries carried on
  //    exercises (defensive — the canonical shape puts them in pack.catalog).
  const additions = new Map()
  const addEntry = (e) => {
    if (!e || !e.canonicalId) return
    const prev = additions.get(e.canonicalId)
    if (!prev) {
      additions.set(e.canonicalId, { ...e })
    } else {
      // Merge, preferring already-present non-empty fields, unioning aliases.
      additions.set(e.canonicalId, {
        ...prev,
        ...e,
        displayName: prev.displayName || e.displayName,
        aliases: unionAliases(prev.aliases, e.aliases, e.displayName || prev.displayName)
      })
    }
  }
  for (const e of pack.catalog || []) addEntry(e)
  for (const session of pack.sessions || []) {
    for (const ex of session.exercises || []) {
      if (ex && ex.catalogEntry) addEntry(ex.catalogEntry)
    }
  }

  // 2. Upsert catalog additions, merging aliases with any existing rows (union,
  //    never drop). Fetch existing rows for just these ids.
  if (additions.size > 0) {
    const ids = Array.from(additions.keys())
    const { data: existingRows, error: readErr } = await client
      .from('exercise_catalog')
      .select('*')
      .in('canonical_id', ids)
    if (readErr) throw new Error(`exercise_catalog read failed: ${readErr.message}`)
    const existingById = new Map((existingRows || []).map((r) => [r.canonical_id, mapCatalogRow(r)]))

    const rows = ids.map((id) => {
      const incoming = additions.get(id)
      const existing = existingById.get(id)
      const merged = {
        canonicalId: id,
        displayName: incoming.displayName || existing?.displayName || id,
        aliases: unionAliases(
          existing?.aliases,
          incoming.aliases,
          incoming.displayName || existing?.displayName
        ),
        muscleGroup: incoming.muscleGroup ?? existing?.muscleGroup ?? null,
        movementType: incoming.movementType ?? existing?.movementType ?? null,
        equipment: incoming.equipment ?? existing?.equipment ?? null,
        defaultIncrementKg: incoming.defaultIncrementKg ?? existing?.defaultIncrementKg ?? null
      }
      return toCatalogRow(merged, now)
    })

    const { error: upErr } = await client
      .from('exercise_catalog')
      .upsert(rows, { onConflict: 'canonical_id' })
    if (upErr) throw new Error(`exercise_catalog upsert failed: ${upErr.message}`)
  }

  // 3. Upsert the pack itself (active), then clear is_active on every other row
  //    so exactly one pack is active.
  const version = Number.isInteger(pack.version) ? pack.version : 1
  const packRow = {
    pack_id: pack.packId,
    version,
    name: pack.name,
    source: pack.source ?? null,
    progression_rules: pack.progressionRules ?? null,
    sessions: pack.sessions,
    is_active: true,
    updated_at: now
  }
  const { error: packErr } = await client
    .from('program_pack')
    .upsert(packRow, { onConflict: 'pack_id' })
  if (packErr) throw new Error(`program_pack upsert failed: ${packErr.message}`)

  const { error: clearErr } = await client
    .from('program_pack')
    .update({ is_active: false })
    .neq('pack_id', pack.packId)
  if (clearErr) throw new Error(`clearing other active packs failed: ${clearErr.message}`)

  return { ok: true, packId: pack.packId, version }
}

// --- Startup ----------------------------------------------------------------

async function main() {
  const env = checkEnv()
  if (!env.ok) {
    // Fail fast with a clear, actionable message rather than crashing later.
    console.error(`[fitness-tracker-mcp] ${env.error}`)
    console.error(
      '[fitness-tracker-mcp] Required: SUPABASE_URL. Keys: SUPABASE_SERVICE_KEY ' +
        '(recommended) or SUPABASE_ANON_KEY.'
    )
    process.exit(1)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[fitness-tracker-mcp] server running on stdio')
}

main().catch((err) => {
  console.error('[fitness-tracker-mcp] fatal:', err)
  process.exit(1)
})
