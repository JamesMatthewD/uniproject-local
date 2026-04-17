// API endpoint to test AI agent win rates by running matches against other agents
// POST /api/agents/test-matchup

const STARTING_CHIPS = 200;
const ANTE = 5;
const RANK_VALUE = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

// Utility to create a shuffled deck
function createDeck() {
  const suits = ["H", "D", "C", "S"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(`${rank}-${suit}`);
    }
  }
  return deck;
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getCardRank(card) {
  if (!card) return 0;
  const [rank] = card.split("-");
  return RANK_VALUE[rank] || 0;
}

// Execute agent code in a sandbox
function executeAgent(agentCode, gameInfo, method) {
  try {
    // Create timeout
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
    }, 500);

    // Remove export keyword to make it compatible with new Function()
    const codeWithoutExport = agentCode
      .replace(/^\s*export\s+default\s+/m, "")
      .replace(/^\s*export\s+(const|let|var|function)\s+/m, "$1 ");

    // Execute the code to define exampleOpponent
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
    // Return safe default
    if (method === "raise") {
      return { shouldRaise: false, amount: 0 };
    }
    return method === "fold" ? true : false;
  }
}

// Run a single match between two agents
function runMatch(agent1Code, agent2Code) {
  let players = [
    { id: 0, chips: STARTING_CHIPS, card: null, folded: false, name: "Agent 1" },
    { id: 1, chips: STARTING_CHIPS, card: null, folded: false, name: "Agent 2" }
  ];

  let pot = ANTE * 2;
  players[0].chips -= ANTE;
  players[1].chips -= ANTE;

  // Betting round
  let currentBet = ANTE;
  let lastRaiser = 1; // Small blind started
  let currentPlayer = 0;
  let roundsWithoutChange = 0;

  while (roundsWithoutChange < 2 && players.filter(p => !p.folded).length === 2) {
    const player = players[currentPlayer];
    const opponent = players[1 - currentPlayer];

    if (player.folded) {
      currentPlayer = 1 - currentPlayer;
      continue;
    }

    // Build game info
    const gameInfo = {
      myCards: player.card ? [player.card] : [],
      myChips: player.chips,
      boardCards: [],
      potSize: pot,
      currentBet: Math.max(0, currentBet - (ANTE - (currentPlayer === 0 ? ANTE : ANTE))),
      street: "pre-flop",
      myPosition: currentPlayer,
      opponentChips: opponent.chips
    };

    const agentCode = currentPlayer === 0 ? agent1Code : agent2Code;
    let action = "check";

    // Determine action: fold, call, raise, or check
    try {
      const shouldFold = executeAgent(agentCode, gameInfo, "fold");
      if (shouldFold && gameInfo.currentBet > 0) {
        action = "fold";
        player.folded = true;
      } else {
        const canCall = gameInfo.currentBet <= player.chips;
        const shouldRaise = executeAgent(agentCode, gameInfo, "raise");

        if (shouldRaise.shouldRaise && shouldRaise.amount > 0) {
          const raiseAmount = Math.min(shouldRaise.amount, player.chips);
          pot += raiseAmount;
          player.chips -= raiseAmount;
          currentBet += raiseAmount;
          action = "raise";
          lastRaiser = currentPlayer;
          roundsWithoutChange = 0;
        } else if (canCall && gameInfo.currentBet > 0) {
          const callAmount = Math.min(gameInfo.currentBet, player.chips);
          pot += callAmount;
          player.chips -= callAmount;
          action = "call";
          roundsWithoutChange++;
        } else {
          action = "check";
          roundsWithoutChange++;
        }
      }
    } catch (error) {
      console.error("Error executing agent:", error);
      action = "fold";
      player.folded = true;
    }

    if (action === "fold") {
      break;
    }

    currentPlayer = 1 - currentPlayer;
  }

  // Determine winner
  let winner;
  const activePlayers = players.filter(p => !p.folded);

  if (activePlayers.length === 1) {
    winner = activePlayers[0].id;
  } else {
    // Showdown - compare card ranks
    const rank0 = getCardRank(players[0].card);
    const rank1 = getCardRank(players[1].card);
    winner = rank0 > rank1 ? 0 : 1;
  }

  // Award pot to winner
  players[winner].chips += pot;

  return winner;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { agent1Code, agent2Code, matchCount = 10 } = body;

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
      const winner = runMatch(agent1Code, agent2Code);
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
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Test matchup error:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
