# Opponent AI Framework

This directory contains opponent decision trees for poker AI. Create custom opponents by exporting a `exampleOpponent` object with three decision functions.

## Structure

Each opponent module must export an object with the following format:

```javascript
export const exampleOpponent = {
  call: (gameInfo) => boolean,
  fold: (gameInfo) => boolean,
  raise: (gameInfo) => { shouldRaise: boolean, amount: number }
};
```

## Game Info Object

All decision functions receive a `gameInfo` object containing:

- **myCards**: `string[]` - Your two hole cards (e.g., `["A-H", "K-D"]`)
- **myChips**: `number` - Your remaining chip count
- **boardCards**: `string[]` - Community cards on table (0-5 cards depending on street)
- **potSize**: `number` - Total chips in the pot
- **currentBet**: `number` - Amount you need to match to call
- **street**: `string` - Current betting round (`"pre-flop"`, `"flop"`, `"turn"`, `"river"`, `"final-bet"`)
- **myPosition**: `number` - Your position (0 = small blind, 1 = big blind)
- **opponentChips**: `number` - Opponent's remaining chips

## Decision Functions

### `call(gameInfo): boolean`
Return `true` to call the current bet, `false` otherwise.

```javascript
call: (gameInfo) => {
  return gameInfo.currentBet < gameInfo.potSize * 0.1;
}
```

### `fold(gameInfo): boolean`
Return `true` to fold your hand, `false` otherwise.

```javascript
fold: (gameInfo) => {
  return gameInfo.currentBet > gameInfo.myChips * 0.5;
}
```

### `raise(gameInfo): { shouldRaise, amount }`
Return an object with `shouldRaise` (boolean) and `amount` (number in chips).
The `amount` is only used if `shouldRaise` is `true`.

```javascript
raise: (gameInfo) => {
  return {
    shouldRaise: true,
    amount: gameInfo.potSize * 0.5
  };
}
```

## Usage in Game Code

```javascript
import { exampleOpponent } from "@/app/opponents/example";
import { getOpponentAction } from "@/app/opponents/opponentAI";

// Get opponent's decision
const decision = getOpponentAction(exampleOpponent, gameInfo);
// Returns: { action: 'fold'|'call'|'raise', amount?: number }
```

## Creating Your Own Opponent

1. Create a new file in this directory (e.g., `aggressive.js`)
2. Export an opponent object with the three decision functions
3. Import and use it in your game code

Example:

```javascript
// app/opponents/aggressive.js
export const exampleOpponent = {
  call: (gameInfo) => gameInfo.currentBet < gameInfo.potSize * 0.05,
  fold: (gameInfo) => false, // Never fold
  raise: (gameInfo) => ({
    shouldRaise: true,
    amount: gameInfo.potSize * 0.5
  })
};
```

Then in your game:

```javascript
import { exampleOpponent as aggressiveOpponent } from "@/app/opponents/aggressive";

const decision = getOpponentAction(aggressiveOpponent, gameInfo);
```

## Card String Format

Cards are represented as `"RANK-SUIT"`:
- Rank: `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `J`, `Q`, `K`, `A`
- Suit: `H` (Hearts), `D` (Diamonds), `C` (Clubs), `S` (Spades)

Examples: `"A-H"`, `"K-D"`, `"10-C"`, `"2-S"`
