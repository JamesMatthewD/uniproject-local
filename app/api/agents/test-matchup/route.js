// API endpoint to test AI agent win rates by running Texas Hold'em matches
// POST /api/agents/test-matchup

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

function runTexasHoldEmMatch(agent1Code, agent2Code) {
  const players = [
    { id: 0, chips: STARTING_CHIPS, cards: [], folded: false, agentCode: agent1Code, lastBet: 0 },
    { id: 1, chips: STARTING_CHIPS, cards: [], folded: false, agentCode: agent2Code, lastBet: 0 }
  ];

  const deck = shuffle(createDeck());
  
  // Deal hole cards
  players[0].cards = [deck.pop(), deck.pop()];
  players[1].cards = [deck.pop(), deck.pop()];

  // Deal board cards
  const boardCards = [];
  const flopCards = [deck.pop(), deck.pop(), deck.pop()];
  const turnCard = deck.pop();
  const riverCard = deck.pop();

  let pot = 0;
  
  // Post blinds
  players[0].chips -= SMALL_BLIND;
  pot += SMALL_BLIND;
  players[1].chips -= BIG_BLIND;
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
    let currentPlayer = streetIndex === 0 ? 1 : 0; // After blinds, BB acts first pre-flop
    let currentBet = streetIndex === 0 ? BIG_BLIND : 0;
    let maxIterations = 100; // Safety limit to prevent infinite loops

    while (roundsWithoutChange < 2 && maxIterations > 0 && players[0].chips > 0 && players[1].chips > 0) {
      maxIterations--;
      const player = players[currentPlayer];

      if (player.folded) {
        currentPlayer = 1 - currentPlayer;
        continue;
      }

      // Check if both players are all-in or out of chips
      if (players[0].chips === 0 || players[1].chips === 0 || (players[0].folded && players[1].folded)) {
        break;
      }

      // Build game info
      const gameInfo = {
        myCards: player.cards,
        myChips: player.chips,
        boardCards: [...boardCards],
        potSize: pot,
        currentBet: Math.max(0, currentBet - player.lastBet),
        street: street,
        myPosition: currentPlayer === 0 ? 0 : 1,
        opponentChips: players[1 - currentPlayer].chips
      };

      try {
        let didRaise = false;

        // Check if player needs to act (facing a bet)
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
            didRaise = true;
          } else {
            // Call
            const callAmount = Math.min(currentBet - player.lastBet, player.chips);
            player.chips -= callAmount;
            pot += callAmount;
            player.lastBet = currentBet;
            roundsWithoutChange++;
          }
        } else {
          // Player can check, call, or raise
          const raiseResult = executeAgent(player.agentCode, gameInfo, "raise");
          if (raiseResult.shouldRaise && raiseResult.amount > 0 && player.chips > 0) {
            const raiseAmount = Math.min(raiseResult.amount, player.chips);
            player.chips -= raiseAmount;
            pot += raiseAmount;
            currentBet += raiseAmount;
            player.lastBet = currentBet;
            roundsWithoutChange = 0;
            didRaise = true;
          } else {
            // Check or passive call - just increment counter
            roundsWithoutChange++;
          }
        }
      } catch (error) {
        console.error("Error executing agent:", error);
        player.folded = true;
        break;
      }

      if (players[0].folded || players[1].folded) {
        break;
      }

      currentPlayer = 1 - currentPlayer;
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

  // Tie - split pot (shouldn't happen in 2-player)
  return 0;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { agent1Code, agent2Code, matchCount = 20 } = body;

    if (!agent1Code || !agent2Code) {
      return Response.json(
        { error: "Missing agent codes" },
        { status: 400 }
      );
    }

    if (matchCount < 1 || matchCount > 100) {
      return Response.json(
        { error: "Match count must be between 1 and 100" },
        { status: 400 }
      );
    }

    // Run matches
    let agent1Wins = 0;
    let agent2Wins = 0;

    for (let i = 0; i < matchCount; i++) {
      const winner = runTexasHoldEmMatch(agent1Code, agent2Code);
      if (winner === 0) {
        agent1Wins++;
      } else {
        agent2Wins++;
      }
    }

    const winRate1 = Math.round((agent1Wins / matchCount) * 100);
    const winRate2 = Math.round((agent2Wins / matchCount) * 100);

    return Response.json({
      agent1Wins,
      agent2Wins,
      matchCount,
      winRate1,
      winRate2,
      timestamp: new Date().toISOString(),
      gameType: "Texas Hold'em"
    });
  } catch (error) {
    console.error("Test matchup error:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
