/**
 * Get rest duration based on movement type
 * @param {string} movementType - 'compound_upper' | 'compound_lower' | 'isolation'
 * @returns {number} - seconds
 */
export function getRestDuration(movementType) {
  switch (movementType) {
    case 'compound_upper':
    case 'compound_lower':
      return 180 // 3 minutes for compounds
    case 'isolation':
      return 90 // 1.5 minutes for isolation
    default:
      return 180
  }
}

/**
 * Get muscle groups that qualify for bonus exercises
 * @param {string} sessionLabel - 'Push' | 'Pull' | 'Legs'
 * @returns {Array<string>}
 */
export function getBonusExerciseMuscleGroups(sessionLabel) {
  switch (sessionLabel) {
    case 'Push':
      return ['shoulders', 'triceps', 'arms']
    case 'Pull':
      return ['biceps', 'rear_delts']
    case 'Legs':
      return ['quads', 'calves']
    default:
      return []
  }
}

/**
 * Check if a session is upper body
 * @param {string} sessionLabel
 * @returns {boolean}
 */
export function isUpperBodySession(sessionLabel) {
  return sessionLabel === 'Push' || sessionLabel === 'Pull'
}

/**
 * Check if a session is lower body
 * @param {string} sessionLabel
 * @returns {boolean}
 */
export function isLowerBodySession(sessionLabel) {
  return sessionLabel === 'Legs'
}

/**
 * Get all valid muscle groups
 */
export const MUSCLE_GROUPS = {
  CHEST: 'chest',
  BACK: 'back',
  SHOULDERS: 'shoulders',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  FOREARMS: 'forearms',
  QUADS: 'quads',
  HAMSTRINGS: 'hamstrings',
  CALVES: 'calves',
  CORE: 'core',
  GLUTES: 'glutes',
  REAR_DELTS: 'rear_delts',
  ARMS: 'arms'
}

/**
 * Get all valid movement types
 */
export const MOVEMENT_TYPES = {
  COMPOUND_UPPER: 'compound_upper',
  COMPOUND_LOWER: 'compound_lower',
  ISOLATION: 'isolation'
}
