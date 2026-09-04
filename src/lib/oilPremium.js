// ── Premium Upgrade Registry ─────────────────────────────────────────────────
// All premium item definitions, prices, and helper functions for the oil game.

// Prices per category — USD only; RL80 equivalent calculated dynamically from pool price
export const PREMIUM_PRICES = {
  theme:      { usdc: 5 },
  fence:      { usdc: 3 },
  accessory:  { usdc: 5 },
  addon:      { usdc: 3 },
  slotUnlock: { usdc: 5 },
};

// ── Free item sets ───────────────────────────────────────────────────────────

export const FREE_THEME_KEYS = new Set([
  "stock",          // Factory Default
  "goldRush",       // Gold Rush
  "rusty",          // Abandoned Field
  "murdered",       // Murdered Out
  "cyberpunk",      // Cyberpunk
  "toxic",          // Biohazard
  "hellforged",     // Hellforged
  "sanctified",     // Sanctified Extraction
  "arctic",         // Arctic Industrial
  "desert",         // Mad Max
  "tokyoNoir",      // Tokyo Noir
  "texas",          // Lone Star
  "solarFlare",     // Solar Flare
  "crimsonCharge",  // Red Bull
  "atomicSurge",    // Monster Energy
  "myLittlePony",      // My Little Pony
  "whiteGold",      // White Gold
  // Premium: chrome, dragonforge, celestial, midnightSovereign, metalAF
]);

export const FREE_FENCE_IDS = new Set([
  "chainlink",  // Chain Link
]);

export const FREE_ADDON_IDS = new Set([
  "flamingo",
  "bearRug",
  "gravestone",
  "sunflowers",
  "gnome",
  "goldRocks",
  "palmTree",
  "pumpkinPatch",
  "skeleton",
  "scarecrow",
  "forSaleSign",
]);

// Accessories: sign toggle + image upload are free; security camera is premium
export const FREE_ACCESSORY_IDS = new Set([
  "sign",
  "signImage",
]);

// ── Helper functions ─────────────────────────────────────────────────────────

export function isPremiumTheme(key) {
  return !FREE_THEME_KEYS.has(key);
}

export function isPremiumFence(id) {
  return !FREE_FENCE_IDS.has(id);
}

export function isPremiumAddon(id) {
  return !FREE_ADDON_IDS.has(id);
}

export function isPremiumAccessory(id) {
  return !FREE_ACCESSORY_IDS.has(id);
}

// Get the category + price for a given item ID
export function getItemCategory(itemId) {
  if (itemId.startsWith("slotUnlock_")) return "slotUnlock";
  if (itemId.startsWith("theme_")) return "theme";
  if (itemId.startsWith("fence_")) return "fence";
  if (itemId.startsWith("addon_")) return "addon";
  if (itemId === "camera") return "accessory";
  return null;
}

export function getItemPrice(itemId) {
  const category = getItemCategory(itemId);
  return category ? PREMIUM_PRICES[category] : null;
}

// Build a purchase item ID from category + key
export function makePurchaseId(category, key) {
  if (category === "accessory") return key; // e.g. "camera"
  if (category === "slotUnlock") return key; // e.g. "slotUnlock_4"
  return `${category}_${key}`; // e.g. "theme_cyberpunk", "fence_iron"
}
