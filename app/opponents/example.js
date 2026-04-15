/**
 * Example Opponent Decision Tree
 * 
 * This is a template for creating custom opponent AI.
 * Implement the three decision functions below to define opponent behavior.
 * 
 * Each function receives gameInfo with:
 * - myCards: [card1, card2] (e.g., ["A-H", "K-D"])
 * - myChips: number (remaining chips)
 * - boardCards: [card1, card2, ...] (0-5 cards depending on street)
 * - potSize: number
 * - currentBet: number (amount needed to call)
 * - street: string ("pre-flop", "flop", "turn", "river", "final-bet")
 * - myPosition: number (0 = small blind, 1 = big blind)
 * - opponentChips: number (opponent's remaining chips)
 */

export const exampleOpponent = {
  /**
   * Determine whether to call the current bet
   * @param {Object} gameInfo - Game state information
   * @returns {boolean} - true to call, false to not call
   */
  call: (gameInfo) => {
    // Example: Call if the current bet is small relative to pot
    const betToCallRatio = gameInfo.currentBet / (gameInfo.potSize + gameInfo.currentBet);
    
    // Your custom logic here
    return false;
  },

  /**
   * Determine whether to fold
   * @param {Object} gameInfo - Game state information
   * @returns {boolean} - true to fold, false to not fold
   */
  fold: (gameInfo) => {
    // Example: Fold if staring at a large bet
    const isFacingLargeBet = gameInfo.currentBet > gameInfo.myChips * 0.3;
    
    // Your custom logic here
    return false;
  },

  /**
   * Determine whether to raise and by how much
   * @param {Object} gameInfo - Game state information
   * @returns {Object} - { shouldRaise: boolean, amount: number }
   *                     amount is ignored if shouldRaise is false
   */
  raise: (gameInfo) => {
    // Example: Raise 20% of pot if we have good cards
    const potPercent = Math.round((gameInfo.potSize * 0.2) / gameInfo.potSize * 100);
    
    // Your custom logic here
    return {
      shouldRaise: false,
      amount: 0
    };
  }
};
