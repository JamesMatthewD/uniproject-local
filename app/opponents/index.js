/**
 * Opponent AI Index
 * 
 * Central registry of all available opponent decision trees.
 * Each entry maps an AI name to its module.
 */

import * as exampleOpponent from "@/app/opponents/example";

export const AVAILABLE_OPPONENTS = {
  example: {
    name: "Example",
    module: exampleOpponent
  }
};

/**
 * Get list of opponent names for dropdown
 * @returns {string[]} - Array of opponent AI names
 */
export function getOpponentNames() {
  return Object.keys(AVAILABLE_OPPONENTS);
}

/**
 * Get opponent module by name
 * @param {string} name - Opponent name
 * @returns {Object} - Opponent module or null if not found
 */
export function getOpponentByName(name) {
  const opponent = AVAILABLE_OPPONENTS[name];
  return opponent ? opponent.module : null;
}

/**
 * Get opponent's display name
 * @param {string} name - Opponent key
 * @returns {string} - Human-readable name
 */
export function getOpponentDisplayName(name) {
  const opponent = AVAILABLE_OPPONENTS[name];
  return opponent ? opponent.name : name;
}
