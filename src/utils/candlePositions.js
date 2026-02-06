// Candle position generation utilities
// Used both when creating offerings (to store position) and when rendering

// Priority zones - candles positioned in front of camera (looking at negative Z)
// Camera is at [0, 0, 15], phone/hands at [0, -1, -6], Mary at z=-8 to -12
// Zone 0 keeps the first few candles clustered tight beside the phone
// so even with 2-3 candles the scene doesn't look sparse
export const PRIORITY_ZONES = [
  { capacity: 10, x: { min: -4, max: 4 }, y: { min: 0, max: 3 }, z: { min: -11, max: -9.5 } },    // Zone 0: Central cluster IN FRONT of body corridor (z < -9), can use x≈0
  { capacity: 15, x: { min: -7, max: 7 }, y: { min: -1, max: 3 }, z: { min: -8, max: -4 } },      // Zone 1: Flanking phone (inside corridor, will get x-pushed)
  { capacity: 40, x: { min: -10, max: 10 }, y: { min: -2, max: 5 }, z: { min: -10, max: -3 } },   // Zone 2: Good visibility
  { capacity: 60, x: { min: -14, max: 14 }, y: { min: -3, max: 8 }, z: { min: -14, max: -2 } },   // Zone 3: Peripheral
  { capacity: Infinity, x: { min: -20, max: 20 }, y: { min: -5, max: 12 }, z: { min: -20, max: 0 } } // Zone 4: Overflow
]

// Body corridor exclusion (viewer's body area)
export const BODY_CORRIDOR = {
  centerX: 0, centerY: -1,
  zMin: -9, zMax: 6,
  halfWidth: 4, halfHeight: 5
}

// Simple hash function for consistent random values from string IDs
export const hashCode = (str) => {
  if (!str) return 0
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Seeded random generator for deterministic positions
export const seededRandom = (seed, min = 0, max = 1) => {
  const x = Math.sin(seed) * 10000
  return min + (x - Math.floor(x)) * (max - min)
}

// Get appropriate zone for candle index
export const getZone = (index) => {
  let count = 0
  for (const zone of PRIORITY_ZONES) {
    count += zone.capacity
    if (index < count) return zone
  }
  return PRIORITY_ZONES[PRIORITY_ZONES.length - 1]
}

// Apply body corridor exclusion
export const applyBodyExclusion = (x, y, z, seed) => {
  if (z >= BODY_CORRIDOR.zMin && z <= BODY_CORRIDOR.zMax) {
    const inXRange = Math.abs(x - BODY_CORRIDOR.centerX) < BODY_CORRIDOR.halfWidth
    const inYRange = Math.abs(y - BODY_CORRIDOR.centerY) < BODY_CORRIDOR.halfHeight
    if (inXRange && inYRange) {
      // Push outward
      const pushDir = x >= 0 ? 1 : -1
      x = pushDir * (BODY_CORRIDOR.halfWidth + 1 + seededRandom(seed + 10, 0, 2))
    }
  }
  return { x, y, z }
}

/**
 * Generate a position for a candle based on its ID and index
 * @param {string} offeringId - The offering document ID
 * @param {number} index - The index in the sorted offerings array (determines zone)
 * @param {Array} usedPositions - Optional array of already-used positions to avoid overlap
 * @returns {{ x: number, y: number, z: number }}
 */
export const generateCandlePosition = (offeringId, index = 0, usedPositions = []) => {
  const seed = hashCode(offeringId)
  const zone = getZone(index)

  let x, y, z

  // Try multiple attempts to find non-overlapping position
  for (let attempt = 0; attempt < 10; attempt++) {
    const attemptSeed = seed + attempt * 100
    x = seededRandom(attemptSeed + 1, zone.x.min, zone.x.max)
    y = seededRandom(attemptSeed + 2, zone.y.min, zone.y.max)
    z = seededRandom(attemptSeed + 3, zone.z.min, zone.z.max)

    // Apply body corridor exclusion
    const adjusted = applyBodyExclusion(x, y, z, attemptSeed)
    x = adjusted.x
    y = adjusted.y
    z = adjusted.z

    // Check minimum distance from other candles
    // Tighter packing for early candles (Zone 0) so they cluster nicely
    const minDist = index < 10 ? 1.5 : 2.0
    const tooClose = usedPositions.some(pos => {
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2 + (z - pos.z) ** 2)
      return dist < minDist
    })

    if (!tooClose) break
  }

  return { x, y, z }
}

/**
 * Generate rotation for a candle based on its ID
 * @param {string} offeringId - The offering document ID
 * @returns {number} Rotation in radians
 */
export const generateCandleRotation = (offeringId) => {
  const seed = hashCode(offeringId)
  return seededRandom(seed + 4, 0, Math.PI * 2)
}

/**
 * Generate scale for a candle based on its ID
 * @param {string} offeringId - The offering document ID
 * @returns {number} Scale factor
 */
export const generateCandleScale = (offeringId) => {
  const seed = hashCode(offeringId)
  return seededRandom(seed + 5, 0.8, 1.2)
}
