/**
 * Supabase client factory from environment variables.
 *
 * Required:
 *   SUPABASE_URL          - the project URL
 * One of (writes prefer the service key, which bypasses RLS):
 *   SUPABASE_SERVICE_KEY  - service role key (recommended for the server)
 *   SUPABASE_ANON_KEY     - anon key (reads always; writes only if RLS allows)
 *
 * The client is created once and memoised. Missing configuration throws a clear,
 * actionable error rather than failing deep inside a request handler.
 */

import { createClient } from '@supabase/supabase-js'

let cached = null

/**
 * @returns {{ client: import('@supabase/supabase-js').SupabaseClient, usingServiceKey: boolean }}
 * @throws {Error} when SUPABASE_URL or a usable key is missing
 */
export function getSupabase() {
  if (cached) return cached

  const url = process.env.SUPABASE_URL
  if (!url || !url.trim()) {
    throw new Error(
      'SUPABASE_URL is not set. Configure it (and SUPABASE_SERVICE_KEY, or ' +
        'SUPABASE_ANON_KEY) in the MCP server environment.'
    )
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY
  const key = serviceKey || anonKey
  if (!key || !key.trim()) {
    throw new Error(
      'No Supabase key found. Set SUPABASE_SERVICE_KEY (recommended for writes) ' +
        'or SUPABASE_ANON_KEY in the MCP server environment.'
    )
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  cached = { client, usingServiceKey: Boolean(serviceKey && serviceKey.trim()) }
  return cached
}

/**
 * Validate that the minimum required env var is present, without constructing a
 * client. Used at startup to fail fast with a clear message.
 * @returns {{ ok: boolean, error?: string }}
 */
export function checkEnv() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_URL.trim()) {
    return { ok: false, error: 'SUPABASE_URL is required but not set.' }
  }
  const hasKey =
    (process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_KEY.trim()) ||
    (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.trim())
  if (!hasKey) {
    return {
      ok: false,
      error: 'A Supabase key is required: set SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY.'
    }
  }
  return { ok: true }
}

// --- Row mappers: Supabase snake_case <-> app camelCase ---------------------

/** Map an exercise_catalog row to the camelCase shape used internally. */
export function mapCatalogRow(c) {
  return {
    canonicalId: c.canonical_id,
    displayName: c.display_name,
    aliases: c.aliases ?? [],
    muscleGroup: c.muscle_group,
    movementType: c.movement_type,
    equipment: c.equipment ?? null,
    defaultIncrementKg: c.default_increment_kg ?? null,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }
}

/** Map a program_pack row to the camelCase shape used internally. */
export function mapPackRow(p) {
  return {
    packId: p.pack_id,
    version: p.version,
    name: p.name,
    source: p.source,
    progressionRules: p.progression_rules,
    sessions: p.sessions,
    isActive: p.is_active,
    updatedAt: p.updated_at
  }
}

/** Map a camelCase catalog entry to an exercise_catalog row for upsert. */
export function toCatalogRow(e, now) {
  return {
    canonical_id: e.canonicalId,
    display_name: e.displayName,
    aliases: e.aliases ?? [],
    muscle_group: e.muscleGroup ?? null,
    movement_type: e.movementType ?? null,
    equipment: e.equipment ?? null,
    default_increment_kg: e.defaultIncrementKg ?? null,
    updated_at: now || new Date().toISOString()
  }
}
