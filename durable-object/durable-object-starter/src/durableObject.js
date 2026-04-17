/**
 * Cloudflare Durable Object for Texas Hold'Em Poker
 * This handles all real-time multiplayer game logic and state management
 * 
 * To use this, add to your wrangler.toml:
 * 
 * [durable_objects]
 * bindings = [
 *   { name = "POKER_GAMES", class_name = "PokerGame" }
 * ]
 */

export class PokerGame {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = new Map();
    this.gameState = {
      status: "waiting_for_players",
      currentStreet: "lobby",
      pot: 0,
      board: [],
      communityCards: [],
      currentPlayerIndex: 0,
      minBet: 10,
      smallBlind: 5,
      bigBlind: 10,
      roundNumber: 0,
    };
    this.connections = new Set();
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  async handleJoin(request) {
    const data = await request.json();
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

  async handleAction(request) {
    const data = await request.json();
    const { playerId, action, amount } = data;

    const player = this.players.get(playerId);
    if (!player) {
      return new Response(JSON.stringify({ error: "Player not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle different actions
    switch (action) {
      case "fold":
        player.folded = true;
        break;
      case "check":
        // Validate check is legal
        break;
      case "call":
        // Calculate call amount and deduct from chips
        break;
      case "raise":
        player.bet = amount;
        this.gameState.pot += amount;
        player.chips -= amount;
        break;
      case "allin":
        this.gameState.pot += player.chips;
        player.bet = player.chips;
        player.chips = 0;
        break;
    }

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
    return new Response(JSON.stringify(this.getGameState()), {
      headers: { "Content-Type": "application/json" },
    });
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
      })),
      roundNumber: this.gameState.roundNumber,
      minBet: this.gameState.minBet,
    };
  }

  async handleStartGame() {
    if (this.players.size < 2) {
      throw new Error("Need at least 2 players to start");
    }

    this.gameState.status = "in_progress";
    this.gameState.currentStreet = "pre-flop";
    this.dealCards();
    this.broadcastState();
  }

  dealCards() {
    const deck = this.createDeck();
    const shuffled = this.shuffle(deck);

    // Deal 2 cards to each player
    let cardIndex = 0;
    for (const player of this.players.values()) {
      player.cards = [shuffled[cardIndex++], shuffled[cardIndex++]];
    }

    // Set community cards (5 cards)
    this.gameState.board = shuffled.slice(cardIndex, cardIndex + 5);
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
}
