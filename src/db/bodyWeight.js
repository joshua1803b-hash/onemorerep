import { db } from './db'

/**
 * Log body weight
 * @param {Object} entry - { date, weight }
 * @returns {Promise<number>} - returns the id
 */
export async function logBodyWeight(entry) {
  const id = await db.bodyWeight.add({
    ...entry,
    date: entry.date || new Date().toISOString()
  })
  return id
}

/**
 * Get body weight entries (paginated, reverse chronological)
 * @param {Object} options - { limit = 50, offset = 0 }
 * @returns {Promise<Array>}
 */
export async function getBodyWeightEntries({ limit = 50, offset = 0 } = {}) {
  return db.bodyWeight
    .orderBy('date')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray()
}

/**
 * Get all body weight entries
 * @returns {Promise<Array>}
 */
export async function getAllBodyWeightEntries() {
  return db.bodyWeight.orderBy('date').reverse().toArray()
}

/**
 * Get latest body weight
 * @returns {Promise<Object|undefined>}
 */
export async function getLatestBodyWeight() {
  const entries = await db.bodyWeight
    .orderBy('date')
    .reverse()
    .limit(1)
    .toArray()

  return entries.length > 0 ? entries[0] : null
}
