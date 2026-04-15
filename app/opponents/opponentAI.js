/**
 * Opponent AI Loader and Executor
 * 
 * Handles dynamic loading of opponent decision trees and execution of decisions.
 */

/**
 * Load an opponent from a module
 * @param {Object} opponentModule - Imported opponent module with exampleOpponent export
 * @returns {Object} - The opponent decision tree
 */
export function loadOpponent(opponentModule) {
  if (!opponentModule || !opponentModule.exampleOpponent) {
    throw new Error("Invalid opponent module: must export 'exampleOpponent'");
  }
  return opponentModule.exampleOpponent;
}

/**
 * Execute opponent decision-making logic
 * @param {Object} opponent - The opponent decision tree
 * @param {Object} gameInfo - Current game state
 * @returns {Object} - { action: 'fold'|'call'|'raise', amount?: number }
 */
export function getOpponentAction(opponent, gameInfo) {
  if (!opponent) {
    // Fallback to simple random strategy
    return getRandomOpponentAction(gameInfo);
  }

  try {
    // First, check if opponent wants to fold
    if (opponent.fold && opponent.fold(gameInfo)) {
      return { action: "fold" };
    }

    // Check if opponent wants to raise
    if (opponent.raise) {
      const raiseDecision = opponent.raise(gameInfo);
      if (raiseDecision && raiseDecision.shouldRaise && raiseDecision.amount > 0) {
        const raisedAmount = Math.min(raiseDecision.amount, gameInfo.myChips);
        return { action: "raise", amount: raisedAmount };
      }
    }

    // Check if opponent wants to call
    if (opponent.call && opponent.call(gameInfo)) {
      return { action: "call" };
    }

    // Default to folding if no decision made
    return { action: "fold" };
  } catch (error) {
    console.error("Error in opponent decision tree:", error);
    // Fallback to safe action on error
    return { action: "fold" };
  }
}

/**
 * Fallback random opponent strategy (used when no custom opponent loaded)
 * @private
 */
export function getRandomOpponentAction(gameInfo) {
  const foldChance = 0.3;
  const callChance = 0.5;

  if (Math.random() < foldChance) {
    return { action: "fold" };
  }

  if (Math.random() < callChance) {
    return { action: "call" };
  }

  return {
    action: "raise",
    amount: Math.min(gameInfo.myChips, Math.max(gameInfo.currentBet + 20, gameInfo.potSize * 0.2))
  };
}
