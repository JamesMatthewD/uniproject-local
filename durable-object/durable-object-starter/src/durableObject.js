// Hand ranking constants
const RANK_VALUE = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  "J": 11, "Q": 12, "K": 13, "A": 14
};

// Hand evaluation helper functions
function compareScore(a, b) {
  if (a.category !== b.category) {
    return a.category - b.category;
  }

  const maxLen = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < maxLen; i += 1) {
    const left = a.tiebreak[i] || 0;
    const right = b.tiebreak[i] || 0;
    if (left !== right) {
      return left - right;
    }
  }

  return 0;
}

function detectStraight(sortedUniqueValues) {
  if (sortedUniqueValues.length < 5) {
    return null;
  }

  const wheel = [14, 5, 4, 3, 2];
  if (wheel.every((value) => sortedUniqueValues.includes(value))) {
    return 5;
  }

  for (let i = 0; i <= sortedUniqueValues.length - 5; i += 1) {
    const window = sortedUniqueValues.slice(i, i + 5);
    const isStraight = window.every((value, index) =>
      index === 0 ? true : window[index - 1] - value === 1
    );
    if (isStraight) {
      return window[0];
    }
  }

  return null;
}

function evaluateFiveCards(cards) {
  const values = cards.map((card) => RANK_VALUE[card.split("-")[0]]).sort((a, b) => b - a);
  const suits = cards.map((card) => card.split("-")[1]);
  const isFlush = suits.every((suit) => suit === suits[0]);

  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  const straightHigh = detectStraight(uniqueValues);

  if (straightHigh && isFlush) {
    return { category: 8, tiebreak: [straightHigh], name: "Straight Flush" };
  }

  if (groups[0][1] === 4) {
    const four = groups[0][0];
    const kicker = groups[1][0];
    return { category: 7, tiebreak: [four, kicker], name: "Four of a Kind" };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { category: 6, tiebreak: [groups[0][0], groups[1][0]], name: "Full House" };
  }

  if (isFlush) {
    return { category: 5, tiebreak: values, name: "Flush" };
  }

  if (straightHigh) {
    return { category: 4, tiebreak: [straightHigh], name: "Straight" };
  }

  if (groups[0][1] === 3) {
    const trips = groups[0][0];
    const kickers = groups.slice(1).map((group) => group[0]).sort((a, b) => b - a);
    return { category: 3, tiebreak: [trips, ...kickers], name: "Three of a Kind" };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return { category: 2, tiebreak: [highPair, lowPair, kicker], name: "Two Pair" };
  }

  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = groups.slice(1).map((group) => group[0]).sort((a, b) => b - a);
    return { category: 1, tiebreak: [pair, ...kickers], name: "One Pair" };
  }

  return { category: 0, tiebreak: values, name: "High Card" };
}

function evaluateSevenCards(cards) {
  let best = null;

  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const score = evaluateFiveCards([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareScore(score, best) > 0) {
              best = score;
            }
          }
        }
      }
    }
  }

  return best;
}

export class PokerGame {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = new Map();
    this.gameState = {
      status: "waiting_for_players", // waiting_for_players, dealing, active_hand, hand_complete
      currentStreet: "lobby",
      pot: 0,
      board: [],
      communityCards: [], // All 5 cards dealt but hidden
      currentPlayerIndex: 0,
      minBet: 10,
      smallBlind: 5,
      bigBlind: 10,
      roundNumber: 0,
      handNumber: 0,
      dealerPosition: 0,
      streetActionsCount: 0, // Track how many players have acted this street
      winners: [], // Array of winner IDs
      winningHandName: "", // Name of the winning hand
      handResults: {}, // {playerId: {handName, cards}}
    };
    this.connections = new Set();
    this.handCompleteTime = null; // Timestamp when hand completed
    this.maxBetThisStreet = 0; // Track highest bet this street for check validation
    this.agentCache = new Map(); // Cache for loaded agents
  }

  /**
   * Safely execute custom agent code with sandboxing
   * @private
   */
  async executeCustomAgent(agentId, gameInfo) {
    try {
      // Check cache first
      if (this.agentCache.has(agentId)) {
        const agent = this.agentCache.get(agentId);
        return this._runAgentInSandbox(agent, gameInfo);
      }

      // Fetch from D1 if not cached
      const result = await this.getAgentFromDB(agentId);
      if (!result) {
        console.warn(`Agent ${agentId} not found in database`);
        return null;
      }

      // Cache for future use
      this.agentCache.set(agentId, result.code);

      return this._runAgentInSandbox(result.code, gameInfo);
    } catch (err) {
      console.error(`Error executing custom agent ${agentId}:`, err.message);
      return null;
    }
  }

  /**
   * Run agent code in sandbox with timeout and error handling
   * @private
   */
  _runAgentInSandbox(agentCode, gameInfo) {
    try {
      // Create a timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Agent execution timeout")), 500)
      );

      const executionPromise = (async () => {
        // Create agent in isolated scope
        const agentModule = new Function(
          'return (function() { ' + agentCode + '; return exampleOpponent; })()'
        )();

        if (!agentModule || typeof agentModule !== "object") {
          throw new Error("Agent did not export valid object");
        }

        // Validate required methods exist
        if (typeof agentModule.call !== "function" ||
            typeof agentModule.fold !== "function" ||
            typeof agentModule.raise !== "function") {
          throw new Error("Agent missing required methods");
        }

        // Execute with safe gameInfo copy (prevent mutation)
        const safeGameInfo = JSON.parse(JSON.stringify(gameInfo));

        // Call each method with try-catch
        const canCall = this._safeCall(() => agentModule.call(safeGameInfo), false);
        const shouldFold = this._safeCall(() => agentModule.fold(safeGameInfo), false);
        const raiseResult = this._safeCall(() => agentModule.raise(safeGameInfo), { shouldRaise: false, amount: 0 });

        // Determine final action with fallback
        let action = "check";
        let amount = 0;

        if (shouldFold) {
          action = "fold";
        } else if (raiseResult?.shouldRaise) {
          action = "raise";
          amount = Math.max(1, Math.min(raiseResult.amount || 0, 1000)); // Cap at 1000
        } else if (canCall) {
          action = "call";
        }

        return { action, amount };
      })();

      // Race: execution vs timeout
      return Promise.race([executionPromise, timeoutPromise]);
    } catch (err) {
      console.error("Sandbox execution error:", err.message);
      return { action: "check", amount: 0 }; // Safe fallback
    }
  }

  /**
   * Safely call agent functions with error handling
   * @private
   */
  _safeCall(fn, defaultValue) {
    try {
      const result = fn();
      return result ?? defaultValue;
    } catch (err) {
      console.error("Agent function error:", err.message);
      return defaultValue;
    }
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Handle GET requests for state
      if (method === "GET") {
        return this.handleGetState();
      }

      // Handle requests from Next.js API routes (which include action in body)
      if (method === "POST") {
        const body = await request.json();
        const action = body.path || path; // path can be in body or URL
        
        if (action === "/join") {
          return this.handleJoinRequest(body);
        } else if (action === "/action") {
          return this.handleActionRequest(body);
        } else if (action === "/saveAgent") {
          return this.handleSaveAgent(body);
        }
      }
      
      // Handle direct API calls
      if (path === "/join" && method === "POST") {
        return this.handleJoin(request);
      } else if (path === "/action" && method === "POST") {
        return this.handleAction(request);
      } else if (path === "/state" && method === "GET") {
        return this.handleGetState();
      } else if (path === "/ws" && method === "GET") {
        return this.handleWebSocket(request);
      } else {
        return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Handle requests from Next.js API routes (body-based)
  async handleJoinRequest(data) {
    const { playerId, playerName } = data;

    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      chips: 1000,
      cards: [],
      folded: false,
      bet: 0,
      isActive: true,
      joinedAt: Date.now(),
    });

    // Check if we can start dealing (need 2+ players)
    if (this.players.size >= 2 && this.gameState.status === "waiting_for_players") {
      this.startNewHand();
    }

    this.broadcastState();

    return new Response(
      JSON.stringify({
        success: true,
        playerId,
        gameState: this.getGameState(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  async handleActionRequest(data) {
    const { playerId, action, amount } = data;

    const player = this.players.get(playerId);
    if (!player) {
      return new Response(JSON.stringify({ error: "Player not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate that only the current player can act
    const currentPlayer = this.getCurrentActingPlayer();
    if (currentPlayer && currentPlayer.id !== playerId) {
      return new Response(JSON.stringify({ error: "Not your turn" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle different actions
    switch (action) {
      case "fold":
        player.folded = true;
        this.advanceToNextPlayer();
        break;
      case "check":
        // Check is only valid if all bets are equal on this street
        if (player.bet !== this.maxBetThisStreet) {
          return new Response(JSON.stringify({ error: "Cannot check when there's an outstanding bet" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        this.advanceToNextPlayer();
        break;
      case "call":
        // Calculate call amount and deduct from chips
        const callAmount = Math.min(this.maxBetThisStreet - player.bet, player.chips);
        player.chips -= callAmount;
        player.bet += callAmount;
        this.gameState.pot += callAmount;
        this.advanceToNextPlayer();
        break;
      case "raise":
        const raiseAmount = amount - player.bet;
        player.chips -= raiseAmount;
        player.bet = amount;
        this.maxBetThisStreet = Math.max(this.maxBetThisStreet, amount);
        this.gameState.pot += raiseAmount;
        this.advanceToNextPlayer();
        break;
      case "allin":
        this.gameState.pot += player.chips;
        player.bet += player.chips;
        this.maxBetThisStreet = Math.max(this.maxBetThisStreet, player.bet);
        player.chips = 0;
        this.advanceToNextPlayer();
        break;
      case "next_street":
        // Advance to next street
        this.advanceStreet();
        break;
    }

    // Check if hand should end
    this.checkHandCompletion();

    this.broadcastState();

    return new Response(
      JSON.stringify({
        success: true,
        gameState: this.getGameState(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  handleGetState() {
    // Check if hand_complete timeout has elapsed (3 seconds)
    if (this.gameState.status === "hand_complete" && this.handCompleteTime) {
      const elapsed = Date.now() - this.handCompleteTime;
      if (elapsed >= 3000 && this.players.size >= 2) {
        // Time to advance to next hand
        this.startNewHand();
      }
    }

    return new Response(
      JSON.stringify({
        gameState: this.getGameState(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  checkHandCompletion() {
    const activePlayers = Array.from(this.players.values()).filter((p) => !p.folded);
    
    // Hand ends when only 1 player hasn't folded
    if (activePlayers.length === 1) {
      this.completeHand();
      return;
    }
    
    // Hand ends after river betting when all active players have acted
    if (this.gameState.currentStreet === "river" && this.gameState.streetActionsCount >= activePlayers.length) {
      this.completeHand();
      return;
    }
  }

  completeHand() {
    // Evaluate all remaining players' hands
    const activePlayers = Array.from(this.players.values()).filter((p) => !p.folded);
    
    if (activePlayers.length === 1) {
      // Only 1 player remains (all others folded)
      const winner = activePlayers[0];
      this.gameState.winners = [winner.id];
      this.gameState.winningHandName = "Everyone folded";
      this.gameState.handResults = {
        [winner.id]: { handName: "Won uncontested", cards: winner.cards }
      };
      winner.chips += this.gameState.pot;
    } else {
      // Multiple players in showdown - evaluate hands
      const scoredPlayers = activePlayers.map((player) => ({
        player,
        score: evaluateSevenCards([...player.cards, ...this.gameState.communityCards])
      }));

      let bestScore = scoredPlayers[0].score;
      for (let i = 1; i < scoredPlayers.length; i += 1) {
        if (compareScore(scoredPlayers[i].score, bestScore) > 0) {
          bestScore = scoredPlayers[i].score;
        }
      }

      const winners = scoredPlayers
        .filter((entry) => compareScore(entry.score, bestScore) === 0)
        .map((entry) => entry.player);

      this.gameState.winners = winners.map(w => w.id);
      this.gameState.winningHandName = bestScore.name;
      
      // Store hand results for all remaining players
      this.gameState.handResults = {};
      for (const scored of scoredPlayers) {
        this.gameState.handResults[scored.player.id] = {
          handName: scored.score.name,
          cards: scored.player.cards
        };
      }

      // Distribute pot to winners
      const winnerShare = Math.floor(this.gameState.pot / winners.length);
      for (const winner of winners) {
        winner.chips += winnerShare;
      }
    }
    
    this.gameState.status = "hand_complete";
    this.handCompleteTime = Date.now(); // Record when hand completed for auto-advance
    this.broadcastState(); // Broadcast immediately so clients know hand is complete
  }

  startNewHand() {
    // Reset player states for new hand
    for (const player of this.players.values()) {
      player.cards = [];
      player.folded = false;
      player.bet = 0;
    }

    this.gameState.handNumber += 1;
    this.gameState.dealerPosition = (this.gameState.dealerPosition + 1) % this.players.size;
    this.gameState.pot = 0;
    this.gameState.currentStreet = "pre-flop";
    this.gameState.winners = [];
    this.gameState.winningHandName = "";
    this.gameState.handResults = {};
    this.maxBetThisStreet = this.gameState.bigBlind; // Big blind is initial max bet

    // Calculate blind positions
    const smallBlindPos = (this.gameState.dealerPosition + 1) % this.players.size;
    const bigBlindPos = (this.gameState.dealerPosition + 2) % this.players.size;

    // Collect blinds from players
    const playerArray = Array.from(this.players.values());
    const smallBlindPlayer = playerArray[smallBlindPos];
    const bigBlindPlayer = playerArray[bigBlindPos];

    if (smallBlindPlayer && smallBlindPlayer.chips >= this.gameState.smallBlind) {
      smallBlindPlayer.chips -= this.gameState.smallBlind;
      smallBlindPlayer.bet = this.gameState.smallBlind;
      this.gameState.pot += this.gameState.smallBlind;
    }

    if (bigBlindPlayer && bigBlindPlayer.chips >= this.gameState.bigBlind) {
      bigBlindPlayer.chips -= this.gameState.bigBlind;
      bigBlindPlayer.bet = this.gameState.bigBlind;
      this.gameState.pot += this.gameState.bigBlind;
    }

    // Set current player to small blind (first to act pre-flop in 2-player, UTG in multi-player)
    this.gameState.currentPlayerIndex = smallBlindPos;

    // Deal cards
    this.dealCards();

    // Immediately transition from dealing to active_hand
    this.gameState.status = "active_hand";

    this.broadcastState();
  }

  advanceStreet() {
    const streets = ["pre-flop", "flop", "turn", "river"];
    const currentIndex = streets.indexOf(this.gameState.currentStreet);
    
    if (currentIndex < streets.length - 1) {
      this.gameState.currentStreet = streets[currentIndex + 1];
      this.gameState.streetActionsCount = 0;
      this.maxBetThisStreet = 0; // Reset max bet for new street
      
      // Update visible community cards based on street
      if (this.gameState.currentStreet === "flop") {
        this.gameState.board = this.gameState.communityCards.slice(0, 3);
      } else if (this.gameState.currentStreet === "turn") {
        this.gameState.board = this.gameState.communityCards.slice(0, 4);
      } else if (this.gameState.currentStreet === "river") {
        this.gameState.board = this.gameState.communityCards.slice(0, 5);
      }
      
      // Reset player bets for new street
      for (const player of this.players.values()) {
        player.bet = 0;
      }
      
      // Reset current player: post-flop streets start with small blind, pre-flop with small blind
      // Small blind is always first to act (dealer button + 1)
      const smallBlindPos = (this.gameState.dealerPosition + 1) % this.players.size;
      this.gameState.currentPlayerIndex = smallBlindPos;
    }
  }

  getCurrentActingPlayer() {
    const playerArray = Array.from(this.players.values());
    if (playerArray.length === 0) return null;
    return playerArray[this.gameState.currentPlayerIndex % playerArray.length];
  }

  advanceToNextPlayer() {
    const playerArray = Array.from(this.players.values());
    const numPlayers = playerArray.length;
    
    this.gameState.streetActionsCount++;
    
    // Check if all players have acted this street
    const activePlayers = playerArray.filter(p => !p.folded).length;
    if (this.gameState.streetActionsCount >= activePlayers) {
      // All players have acted, auto-advance to next street
      this.advanceStreet();
      // Check if hand should complete (e.g., after river betting)
      this.checkHandCompletion();
      return;
    }
    
    // Move to next player, skipping folded players
    let nextIndex = (this.gameState.currentPlayerIndex + 1) % numPlayers;
    let attempts = 0;
    
    while (attempts < numPlayers) {
      const player = playerArray[nextIndex];
      if (!player.folded) {
        this.gameState.currentPlayerIndex = nextIndex;
        return;
      }
      nextIndex = (nextIndex + 1) % numPlayers;
      attempts++;
    }
  }

  handleWebSocket(request) {
    const { 0: client, 1: server } = Object.values(new WebSocketPair());

    server.accept();

    server.addEventListener("message", (msg) => {
      this.handleWebSocketMessage(server, msg.data);
    });

    server.addEventListener("close", () => {
      this.connections.delete(server);
    });

    this.connections.add(server);
    this.broadcastState();

    return new Response(null, { status: 101, webSocket: client });
  }

  handleWebSocketMessage(server, data) {
    try {
      const message = JSON.parse(data);
      // Handle WebSocket messages
      console.log("WebSocket message:", message);
    } catch (error) {
      console.error("WebSocket error:", error);
    }
  }

  broadcastState() {
    const state = this.getGameState();
    const message = JSON.stringify(state);

    for (const connection of this.connections) {
      try {
        connection.send(message);
      } catch (error) {
        this.connections.delete(connection);
      }
    }
  }

  getGameState() {
    return {
      status: this.gameState.status,
      currentStreet: this.gameState.currentStreet,
      pot: this.gameState.pot,
      board: this.gameState.board,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        folded: p.folded,
        isActive: p.isActive,
        currentBet: p.bet,
        cards: p.cards,
      })),
      roundNumber: this.gameState.roundNumber,
      handNumber: this.gameState.handNumber,
      minBet: this.gameState.minBet,
      dealerPosition: this.gameState.dealerPosition,
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      maxBetThisStreet: this.maxBetThisStreet,
    };
  }

  // Deprecated - use startNewHand instead
  async handleStartGame() {
    if (this.players.size < 2) {
      throw new Error("Need at least 2 players to start");
    }

    this.startNewHand();
  }

  dealCards() {
    const deck = this.createDeck();
    const shuffled = this.shuffle(deck);

    // Deal 2 cards to each player
    let cardIndex = 0;
    for (const player of this.players.values()) {
      player.cards = [shuffled[cardIndex++], shuffled[cardIndex++]];
    }

    // Store all 5 community cards but don't reveal them yet
    this.gameState.communityCards = shuffled.slice(cardIndex, cardIndex + 5);
    this.gameState.board = []; // Empty board for pre-flop
    this.gameState.streetActionsCount = 0;
    this.maxBetThisStreet = this.gameState.bigBlind; // BB is the initial max bet pre-flop
  }

  createDeck() {
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

  shuffle(cards) {
    const copy = [...cards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Save agent code to D1 database
   * Returns the agent ID on success
   */
  async handleSaveAgent(data) {
    try {
      const { name, code } = data;

      if (!name || !code) {
        return new Response(
          JSON.stringify({ error: "Missing name or code" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!this.env.POKER_AGENTS_DB) {
        return new Response(
          JSON.stringify({ error: "Database not configured" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Generate unique agent ID
      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert into D1 database
      await this.env.POKER_AGENTS_DB
        .prepare(
          "INSERT INTO agents (id, name, code, created_at) VALUES (?, ?, ?, datetime('now'))"
        )
        .bind(agentId, name, code)
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          agentId: agentId,
          message: "Agent saved successfully"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Save agent error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * Retrieve agent code from D1 database by ID
   */
  async getAgentFromDB(agentId) {
    try {
      if (!this.env.POKER_AGENTS_DB) {
        console.warn("D1 database not configured");
        return null;
      }

      const result = await this.env.POKER_AGENTS_DB
        .prepare("SELECT id, name, code FROM agents WHERE id = ? LIMIT 1")
        .bind(agentId)
        .first();

      return result;
    } catch (error) {
      console.error(`Error fetching agent ${agentId}:`, error);
      return null;
    }
  }
}
