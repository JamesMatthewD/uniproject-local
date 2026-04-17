// API endpoint to test an agent in multi-way matches (4-player Texas Hold'em games)
// POST /api/agents/test-multi-way

import { 
  createDeck, 
  shuffle, 
  settleShowdown 
} from '../poker-utils.js';

const STARTING_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const STREETS = ["pre-flop", "flop", "turn", "river", "showdown"];

function executeAgent(agentCode, gameInfo, method) {
  try {
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
    }, 500);

    const codeWithoutExport = agentCode
      .replace(/^\s*export\s+default\s+/m, "")
      .replace(/^\s*export\s+(const|let|var|function)\s+/m, "$1 ");

    let exampleOpponent;
    try {
      const extractFunc = new Function(`
        ${codeWithoutExport}
        return exampleOpponent;
      `);
      exampleOpponent = extractFunc();
    } catch (e) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to parse agent code: ${e.message}`);
    }

    if (!exampleOpponent || typeof exampleOpponent[method] !== "function") {
      clearTimeout(timeoutId);
      throw new Error(`Invalid agent: missing ${method} function`);
    }

    const result = exampleOpponent[method](gameInfo);
    clearTimeout(timeoutId);

    if (timedOut) {
      throw new Error("Agent execution timeout");
    }

    return result;
  } catch (error) {
    console.error(`Agent execution error for ${method}:`, error.message);
    if (method === "raise") {
      return { shouldRaise: false, amount: 0 };
    }
    return method === "fold" ? true : false;
  }
}

// Run a single 4-player Texas Hold'em match
function runTexasHoldEmMatch(agentCodes) {
  if (agentCodes.length !== 4) {
    throw new Error("Must have exactly 4 agents");
  }

  const players = agentCodes.map((code, idx) => ({
    id: idx,
    chips: STARTING_CHIPS,
    cards: [],
    folded: false,
    agentCode: code,
    lastBet: 0
  }));

  const deck = shuffle(createDeck());

  // Deal hole cards
  for (let i = 0; i < 2; i++) {
    for (const player of players) {
      player.cards.push(deck.pop());
    }
  }

  // Deal board cards
  const boardCards = [];
  const flopCards = [deck.pop(), deck.pop(), deck.pop()];
  const turnCard = deck.pop();
  const riverCard = deck.pop();

  let pot = 0;
  let buttonPosition = 0;

  // Post blinds
  const smallBlindPos = (buttonPosition + 1) % 4;
  const bigBlindPos = (buttonPosition + 2) % 4;

  players[smallBlindPos].chips -= SMALL_BLIND;
  pot += SMALL_BLIND;
  players[bigBlindPos].chips -= BIG_BLIND;
  pot += BIG_BLIND;

  let streetIndex = 0;

  // Process each street
  for (const street of STREETS) {
    if (street === "pre-flop") {
      boardCards.length = 0;
    } else if (street === "flop") {
      boardCards.push(...flopCards);
    } else if (street === "turn") {
      boardCards.push(turnCard);
    } else if (street === "river") {
      boardCards.push(riverCard);
    } else if (street === "showdown") {
      break;
    }

    // Betting round
    let roundsWithoutChange = 0;
    let currentBet = streetIndex === 0 ? BIG_BLIND : 0;
    let firstToAct = (bigBlindPos + 1) % 4;
    let currentPlayer = streetIndex === 0 ? (smallBlindPos + 1) % 4 : firstToAct;

    while (roundsWithoutChange < 4) {
      const player = players[currentPlayer];

      // Skip folded players
      if (player.folded) {
        currentPlayer = (currentPlayer + 1) % 4;
        continue;
      }

      // Check if all other players folded
      const activePlayers = players.filter(p => !p.folded);
      if (activePlayers.length === 1) {
        break;
      }

      // Skip if out of chips
      if (player.chips === 0) {
        currentPlayer = (currentPlayer + 1) % 4;
        continue;
      }

      // Build game info
      const gameInfo = {
        myCards: player.cards,
        myChips: player.chips,
        boardCards: [...boardCards],
        potSize: pot,
        currentBet: Math.max(0, currentBet - player.lastBet),
        street: street,
        myPosition: currentPlayer,
        opponentChips: players
          .filter((p, i) => i !== currentPlayer && !p.folded)
          .reduce((sum, p) => sum + p.chips, 0)
      };

      try {
        if (currentBet > player.lastBet && player.chips > 0) {
          // Player must fold, call, or raise
          const shouldFold = executeAgent(player.agentCode, gameInfo, "fold");
          if (shouldFold) {
            player.folded = true;
            break;
          }

          const raiseResult = executeAgent(player.agentCode, gameInfo, "raise");
          if (raiseResult.shouldRaise && raiseResult.amount > 0 && player.chips > 0) {
            const raiseAmount = Math.min(raiseResult.amount, player.chips);
            player.chips -= raiseAmount;
            pot += raiseAmount;
            currentBet += raiseAmount;
            player.lastBet = currentBet;
            roundsWithoutChange = 0;
          } else {
            const callAmount = Math.min(currentBet - player.lastBet, player.chips);
            player.chips -= callAmount;
            pot += callAmount;
            player.lastBet = currentBet;
            roundsWithoutChange++;
          }
        } else if (player.chips > 0) {
          const canCall = executeAgent(player.agentCode, gameInfo, "call");
          
          if (!canCall) {
            const raiseResult = executeAgent(player.agentCode, gameInfo, "raise");
            if (raiseResult.shouldRaise && raiseResult.amount > 0 && player.chips > 0) {
              const raiseAmount = Math.min(raiseResult.amount, player.chips);
              player.chips -= raiseAmount;
              pot += raiseAmount;
              currentBet += raiseAmount;
              player.lastBet = currentBet;
              roundsWithoutChange = 0;
            }
          } else if (currentBet > player.lastBet && player.chips > 0) {
            const callAmount = Math.min(currentBet - player.lastBet, player.chips);
            player.chips -= callAmount;
            pot += callAmount;
            player.lastBet = currentBet;
            roundsWithoutChange++;
          }
        }
      } catch (error) {
        console.error("Error executing agent:", error);
        player.folded = true;
        break;
      }

      currentPlayer = (currentPlayer + 1) % 4;
    }

    // Reset for next street
    players.forEach(p => p.lastBet = 0);
    streetIndex++;
  }

  // Determine winner
  const activePlayers = players.filter(p => !p.folded);

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += pot;
    return winner.id;
  }

  // Showdown - compare hands
  const result = settleShowdown(
    activePlayers.map(p => ({ 
      id: p.id, 
      cards: p.cards 
    })), 
    boardCards
  );

  const winner = result.winners[0];
  if (winner) {
    players[winner.id].chips += pot;
    return winner.id;
  }

  return 0;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { agentCode, opponentCodes, matchCount = 20 } = body;

    if (!agentCode || !Array.isArray(opponentCodes) || opponentCodes.length === 0) {
      return Response.json(
        { error: "Missing agent code or opponent codes" },
        { status: 400 }
      );
    }

    if (opponentCodes.length > 3) {
      return Response.json(
        { error: "Maximum 3 opponents (4 total players including main agent)" },
        { status: 400 }
      );
    }

    if (matchCount < 1 || matchCount > 100) {
      return Response.json(
        { error: "Match count must be between 1 and 100" },
        { status: 400 }
      );
    }

    // Pad opponents to 3 if needed
    let threeOpponents = [...opponentCodes];
    while (threeOpponents.length < 3) {
      threeOpponents.push(opponentCodes[Math.floor(Math.random() * opponentCodes.length)]);
    }

    // Run matches
    let wins = 0;

    for (let i = 0; i < matchCount; i++) {
      // Randomly select 3 opponents
      const selectedOpponents = [];
      for (let j = 0; j < 3; j++) {
        const opponent = threeOpponents[Math.floor(Math.random() * threeOpponents.length)];
        selectedOpponents.push(opponent);
      }

      // Create 4-player match: agent at position 0, opponents at 1-3
      const agents = [agentCode, ...selectedOpponents];
      const winner = runTexasHoldEmMatch(agents);

      if (winner === 0) {
        wins++;
      }
    }

    const winRate = Math.round((wins / matchCount) * 100);

    return Response.json({
      wins,
      matchCount,
      winRate,
      message: `Agent won ${wins} out of ${matchCount} matches`,
      timestamp: new Date().toISOString(),
      gameType: "Texas Hold'em (4-player)"
    });
  } catch (error) {
    console.error("Multi-way test error:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
