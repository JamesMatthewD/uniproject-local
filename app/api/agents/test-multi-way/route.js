// API endpoint to test an agent in multi-way matches (4-player games)
// POST /api/agents/test-multi-way

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

// Run a single 4-player match
function runMultiWayMatch(agents) {
  // agents is an array of 4 agent codes
  if (agents.length !== 4) {
    throw new Error("Must have exactly 4 agents");
  }

  const players = agents.map((code, idx) => ({
    id: idx,
    chips: STARTING_CHIPS,
    card: null,
    folded: false,
    agentCode: code,
    name: `Player ${idx + 1}`
  }));

  let pot = ANTE * 4;
  players.forEach(p => p.chips -= ANTE);

  let currentBet = ANTE;
  let lastRaiser = (3) % 4; // Last player started
  let currentPlayer = 0;
  let roundsWithoutChange = 0;

  while (roundsWithoutChange < 4 && players.filter(p => !p.folded).length >= 2) {
    const player = players[currentPlayer];

    if (player.folded) {
      currentPlayer = (currentPlayer + 1) % 4;
      continue;
    }

    // Build game info
    const gameInfo = {
      myCards: player.card ? [player.card] : [],
      myChips: player.chips,
      boardCards: [],
      potSize: pot,
      currentBet: Math.max(0, currentBet - ANTE),
      street: "pre-flop",
      myPosition: currentPlayer,
      opponentChips: players.filter((p, i) => i !== currentPlayer && !p.folded).reduce((sum, p) => sum + p.chips, 0)
    };

    let action = "check";

    try {
      const shouldFold = executeAgent(player.agentCode, gameInfo, "fold");
      if (shouldFold && gameInfo.currentBet > 0) {
        action = "fold";
        player.folded = true;
      } else {
        const canCall = gameInfo.currentBet <= player.chips;
        const shouldRaise = executeAgent(player.agentCode, gameInfo, "raise");

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
      const remainingPlayers = players.filter(p => !p.folded);
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0].id;
        players[winner].chips += pot;
        return winner;
      }
    }

    currentPlayer = (currentPlayer + 1) % 4;
  }

  // Showdown
  const activePlayers = players.filter(p => !p.folded);

  if (activePlayers.length === 1) {
    const winner = activePlayers[0].id;
    players[winner].chips += pot;
    return winner;
  }

  // Compare card ranks
  let winner = activePlayers[0].id;
  let maxRank = getCardRank(players[winner].card);

  for (let i = 1; i < activePlayers.length; i++) {
    const rank = getCardRank(players[activePlayers[i].id].card);
    if (rank > maxRank) {
      maxRank = rank;
      winner = activePlayers[i].id;
    }
  }

  players[winner].chips += pot;
  return winner;
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

    // Always run 4-player matches, pad with copies of opponents if needed
    let fourPlayerOpponents = [...opponentCodes];
    while (fourPlayerOpponents.length < 3) {
      fourPlayerOpponents.push(opponentCodes[Math.floor(Math.random() * opponentCodes.length)]);
    }

    // Run matches
    let wins = 0;
    const opponentWins = {};

    for (let i = 0; i < matchCount; i++) {
      // Randomly select 3 opponents from the list
      const selectedOpponents = [];
      for (let j = 0; j < 3; j++) {
        const opponent = fourPlayerOpponents[Math.floor(Math.random() * fourPlayerOpponents.length)];
        selectedOpponents.push(opponent);
      }

      // Create 4-player match: agent at position 0, opponents at 1-3
      const agents = [agentCode, ...selectedOpponents];
      const winner = runMultiWayMatch(agents);

      if (winner === 0) {
        wins++;
      }

      // Track opponent wins (simplified - just count if they were position 1)
      if (winner === 1) {
        opponentWins["opponent_0"] = (opponentWins["opponent_0"] || 0) + 1;
      }
    }

    const winRate = Math.round((wins / matchCount) * 100);

    return Response.json({
      wins,
      matchCount,
      winRate,
      message: `Agent won ${wins} out of ${matchCount} matches`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Multi-way test error:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
