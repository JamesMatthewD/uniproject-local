"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STARTING_CHIPS = 1000;
const POKER_TABLE_SEATS = 6; // Number of seats at the table

// Convert card format from "2-H" to "2_of_hearts.png"
function getCardImagePath(card) {
  if (!card) return null;
  
  const [rank, suit] = card.split("-");
  
  const rankMap = {
    "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", "10": "10",
    "J": "jack", "Q": "queen", "K": "king", "A": "ace"
  };
  
  const suitMap = {
    "H": "hearts",
    "D": "diamonds",
    "C": "clubs",
    "S": "spades"
  };
  
  const mappedRank = rankMap[rank];
  const mappedSuit = suitMap[suit];
  
  if (!mappedRank || !mappedSuit) return null;
  
  return `/cards/${mappedRank}_of_${mappedSuit}.png`;
}

// Card image component
function CardImage({ card, isHidden = false, size = "medium" }) {
  const imagePath = getCardImagePath(card);
  
  const sizes = {
    small: { width: "35px", height: "50px" },
    medium: { width: "50px", height: "70px" },
    large: { width: "80px", height: "110px" }
  };
  
  if (isHidden || !imagePath) {
    return (
      <div className="card-placeholder" style={sizes[size]}>
        ?
      </div>
    );
  }
  
  return (
    <img 
      src={imagePath} 
      alt={card}
      style={{ ...sizes[size], borderRadius: "4px" }}
      onError={(e) => {
        e.target.style.display = "none";
      }}
    />
  );
}

export default function MultiplayerPage() {
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputCode, setInputCode] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [currentBet, setCurrentBet] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerSeatIndex, setPlayerSeatIndex] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);

  // Initialize with room selection
  useEffect(() => {
    const newPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`;
    setPlayerId(newPlayerId);
    setLoading(false);
  }, []);

  // Poll for game state updates
  useEffect(() => {
    if (!gameStarted || !gameId || !playerId) return;

    // Immediately fetch state when game starts
    const fetchState = async () => {
      try {
        const response = await fetch("/api/poker/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.gameState) {
            setGameState(data.gameState);
          }
        }
      } catch (err) {
        console.error("State fetch error:", err);
      }
    };

    // Fetch immediately
    fetchState();

    // Then poll every 500ms
    const interval = setInterval(fetchState, 500);

    return () => clearInterval(interval);
  }, [gameStarted, gameId, playerId]);

  const createGame = async () => {
    if (!playerId) return;
    try {
      setLoading(true);
      const response = await fetch("/api/poker/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          playerName: `Player ${playerId.slice(-4)}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to create game");

      const data = await response.json();
      setGameId(data.gameId);
      setGameState(data.gameState); // Use the actual game state from the Durable Object
      setPlayerSeatIndex(0);
      setIsConnected(true);
      setGameStarted(true);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const joinGame = async (code) => {
    if (!playerId || !code) return;
    try {
      setLoading(true);
      const response = await fetch("/api/poker/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: code,
          playerId,
          playerName: `Player ${playerId.slice(-4)}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to join game");

      const data = await response.json();
      setGameId(data.gameId);
      setGameState(data.gameState);
      setPlayerSeatIndex(data.gameState?.players?.length || 0);
      setIsConnected(true);
      setGameStarted(true);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const randomQueue = async () => {
    if (!playerId) return;
    try {
      setLoading(true);
      
      // Get list of available games
      const availableResponse = await fetch("/api/poker/available");
      const availableData = await availableResponse.json();
      const availableGames = availableData.games || [];
      
      let selectedGameId = null;
      
      // Prioritize existing non-full rooms
      if (availableGames.length > 0) {
        // Sort by most full first (highest player count)
        const sortedGames = availableGames.sort((a, b) => b.playerCount - a.playerCount);
        selectedGameId = sortedGames[0].gameId;
      } else {
        // Create new game if no rooms available
        const createResponse = await fetch("/api/poker/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            playerName: `Player ${playerId.slice(-4)}`,
          }),
        });

        if (!createResponse.ok) throw new Error("Failed to create game");
        const createData = await createResponse.json();
        selectedGameId = createData.gameId;
      }
      
      // Join the selected game
      if (selectedGameId) {
        await joinGame(selectedGameId);
      }
      
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAction = async (action, amount = 0) => {
    if (!gameId || !playerId) return;

    try {
      const response = await fetch("/api/poker/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          action,
          amount,
        }),
      });

      if (!response.ok) throw new Error("Action failed");

      const data = await response.json();
      setGameState(data.gameState);
      setCurrentBet(0);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameId || "");
  };

  const getPlayerAtSeat = (seatIndex) => {
    return gameState?.players?.[seatIndex] || null;
  };

  const getCurrentActingPlayer = () => {
    const playerArray = gameState?.players || [];
    if (playerArray.length === 0) return null;
    const index = gameState?.currentPlayerIndex || 0;
    return playerArray[index % playerArray.length];
  };

  const isDealerPosition = (seatIndex) => {
    return seatIndex === gameState?.dealerPosition;
  };

  const isActingPlayer = (playerId) => {
    return getCurrentActingPlayer()?.id === playerId;
  };

  const canPlayerAct = () => {
    return isActingPlayer(playerId);
  };

  const canCheck = () => {
    // Can only check if player's current bet equals the max bet this street
    const currentPlayer = gameState?.players?.find(p => p.id === playerId);
    if (!currentPlayer) return false;
    return currentPlayer.currentBet === gameState?.maxBetThisStreet;
  };

  const getCallAmount = () => {
    // Returns the amount needed to call
    const currentPlayer = gameState?.players?.find(p => p.id === playerId);
    if (!currentPlayer) return 0;
    const needed = (gameState?.maxBetThisStreet || 0) - (currentPlayer?.currentBet || 0);
    return Math.max(0, needed);
  };

  const getSeatPosition = (index) => {
    // Calculate circular seat positions around table
    const angle = (index / POKER_TABLE_SEATS) * 2 * Math.PI;
    const radius = 45; // percentage
    const x = 50 + radius * Math.cos(angle - Math.PI / 2);
    const y = 50 + radius * Math.sin(angle - Math.PI / 2);
    return { x, y };
  };

  // Room selection view
  if (!gameStarted) {
    return (
      <main className="container">
        <h1>Texas Hold'Em - Online</h1>
        <p>Join a game or create a new one to get started.</p>

        <div className="room-selector">
          <div className="card">
            <h2>Random Queue</h2>
            <p>Join an existing game or create a new one automatically.</p>
            <button onClick={randomQueue} className="primary-button queue-button">
              Find Game
            </button>
          </div>

          <div className="card">
            <h2>Create New Game</h2>
            <p>Start a new poker room and share the code with friends.</p>
            <button onClick={createGame} className="primary-button">
              Create Game
            </button>
          </div>

          <div className="card">
            <h2>Join Existing Game</h2>
            <p>Enter a game code to join an existing poker room.</p>
            <input
              type="text"
              placeholder="Enter game code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              className="room-input"
            />
            <button
              onClick={() => joinGame(inputCode)}
              className="primary-button"
              disabled={!inputCode}
            >
              Join Game
            </button>
          </div>
        </div>

        <Link href="/" className="back-link">
          ← Back to Home
        </Link>

        <style jsx>{`
          .room-selector {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 1.5rem;
            margin: 2rem 0;
          }

          .queue-button {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          }

          .queue-button:hover:not(:disabled) {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
          }

          .primary-button {
            width: 100%;
            padding: 0.75rem 1rem;
            background: #3b82f6;
            border: none;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.15s ease;
            margin-top: 0.5rem;
          }

          .primary-button:hover:not(:disabled) {
            background: #2563eb;
          }

          .primary-button:disabled {
            background: #6b7280;
            cursor: not-allowed;
          }

          .room-input {
            width: 100%;
            padding: 0.75rem;
            background: #1f2937;
            border: 1px solid #334155;
            border-radius: 6px;
            color: #e5e7eb;
            font-family: monospace;
            font-size: 1rem;
            letter-spacing: 0.1em;
            margin-top: 0.5rem;
          }

          .room-input::placeholder {
            color: #6b7280;
          }

          @media (max-width: 1024px) {
            .room-selector {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 768px) {
            .room-selector {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </main>
    );
  }

  // Game view with poker table
  if (loading) {
    return (
      <main className="container">
        <h1>Texas Hold'Em - Online</h1>
        <p>Connecting to game...</p>
      </main>
    );
  }

  if (error && gameStarted) {
    return (
      <main className="container">
        <h1>Texas Hold'Em - Online</h1>
        <div className="card" style={{ borderColor: "#ef4444", color: "#fca5a5" }}>
          <h2>Connection Error</h2>
          <p>{error}</p>
          <button onClick={() => setGameStarted(false)} className="primary-button">
            Back to Room Select
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Texas Hold'Em - Online</h1>

      <div className="poker-table-container">
        <div className="game-header">
          <div className="game-info-left">
            <div className="game-code-info">
              <strong>Game:</strong> <code>{gameId}</code>
              <button onClick={copyGameCode} className="copy-button">
                Copy Code
              </button>
            </div>
            <div className="game-status-info">
              <strong>Hand:</strong> #{gameState?.handNumber || 0}
              {gameState?.status === "waiting_for_players" && (
                <span className="status-badge waiting">Waiting for 2+ players</span>
              )}
              {gameState?.status === "dealing" && (
                <span className="status-badge dealing">Dealing...</span>
              )}
              {gameState?.status === "hand_complete" && (
                <span className="status-badge complete">Hand Complete - Next in 3s</span>
              )}
              {gameState?.status !== "waiting_for_players" && 
               gameState?.status !== "dealing" && 
               gameState?.status !== "hand_complete" && (
                <span className="status-badge active">
                  {gameState?.currentStreet || "Pre-Flop"}
                </span>
              )}
            </div>
          </div>
          <div className="connection-status">
            <strong>Players:</strong> {gameState?.players?.length || 0}/{POKER_TABLE_SEATS}
          </div>
        </div>

        {/* Poker Table */}
        <div className="poker-table">
          <div className="table-felt">
            {/* Community Cards */}
            <div className="community-cards">
              {gameState?.board?.length > 0 ? (
                <>
                  <h3>Community Cards</h3>
                  <div className="cards-display">
                    {gameState.board.map((card, idx) => (
                      <div key={idx}>
                        <CardImage card={card} size="large" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-board">
                  {gameState?.status === "waiting_for_players" ? "Waiting for players..." : "No cards dealt yet"}
                </div>
              )}
            </div>

            {/* Pot */}
            <div className="pot-display">
              <h4>Pot</h4>
              <p>£{gameState?.pot || 0}</p>
            </div>

            {/* Player Seats */}
            {Array.from({ length: POKER_TABLE_SEATS }).map((_, index) => {
              const player = getPlayerAtSeat(index);
              const pos = getSeatPosition(index);
              const isCurrentPlayer = player?.id === playerId;
              const isDealer = isDealerPosition(index);
              const isActing = isActingPlayer(player?.id);

              return (
                <div
                  key={index}
                  className={`player-seat seat-${index} ${isCurrentPlayer ? "current-player" : ""} ${
                    isActing ? "acting-player" : ""
                  } ${player ? "occupied" : "empty"} ${index === 0 || index === 1 || index === 4 || index === 5 ? "top-seat" : "bottom-seat"}`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                  }}
                >
                  {player ? (
                    <>
                      {isDealer && <div className="dealer-button">D</div>}
                      <div className="player-info">
                        <div className="player-name">{player.name}</div>
                        <div className="player-chips">£{player.chips}</div>
                        {player.folded && <div className="folded-badge">Folded</div>}
                        {isActing && <div className="acting-badge">Your Turn</div>}
                      </div>
                      {player.cards && player.cards.length > 0 && (
                        <div className="player-cards">
                          {player.cards.map((card, idx) => (
                            <CardImage 
                              key={idx} 
                              card={card} 
                              isHidden={gameState?.status !== "hand_complete" && !isCurrentPlayer} 
                              size="small" 
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-seat">
                      <div className="seat-number">Seat {index + 1}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Game Controls */}
      <div className="game-controls">
        {gameState?.status === "waiting_for_players" ? (
          <div className="card">
            <h2>Waiting for Players...</h2>
            <p>Share your game code with a friend to start playing!</p>
          </div>
        ) : gameState?.status === "hand_complete" ? (
          <div className="card">
            <h2>Hand Complete</h2>
            <div className="hand-result">
              {gameState?.winningHandName && (
                <>
                  <p className="result-title">Winner{gameState?.winners?.length > 1 ? 's' : ''}: {gameState?.winners?.map(wid => {
                    const winner = gameState?.players?.find(p => p.id === wid);
                    return winner?.name;
                  }).join(', ')}</p>
                  <p className="winning-hand">Winning Hand: <strong>{gameState?.winningHandName}</strong></p>
                  
                  {gameState?.handResults && Object.keys(gameState?.handResults).length > 0 && (
                    <div className="showdown-hands">
                      {Object.entries(gameState?.handResults).map(([playerId, result]) => {
                        const player = gameState?.players?.find(p => p.id === playerId);
                        return (
                          <div key={playerId} className="showdown-hand">
                            <strong>{player?.name}:</strong> {result.handName}
                            <div className="showdown-cards">
                              {result.cards?.map((card, idx) => (
                                <CardImage key={idx} card={card} size="small" />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              <p className="next-hand-text">Next hand starting in 3 seconds...</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2>Your Actions</h2>
            {!canPlayerAct() && gameState?.status === "active_hand" && (
              <p style={{ color: "#fca5a5", marginBottom: "1rem" }}>
                Waiting for {getCurrentActingPlayer()?.name || "player"} to act...
              </p>
            )}
            <div className="button-group">
              <button
                className="action-button fold"
                onClick={() => handleAction("fold")}
                disabled={gameState?.status !== "active_hand" || !canPlayerAct()}
              >
                Fold
              </button>
              <button
                className="action-button check"
                onClick={() => handleAction("check")}
                disabled={gameState?.status !== "active_hand" || !canPlayerAct() || !canCheck()}
              >
                Check
              </button>
              <button
                className="action-button call"
                onClick={() => handleAction("call")}
                disabled={gameState?.status !== "active_hand" || !canPlayerAct()}
              >
                Call £{getCallAmount()}
              </button>
              <button
                className="action-button raise"
                onClick={() => handleAction("raise", currentBet)}
                disabled={gameState?.status !== "active_hand" || !canPlayerAct()}
              >
                Raise
              </button>
            </div>
            <div className="bet-controls">
              <input
                type="range"
                min="0"
                max="500"
                value={currentBet}
                onChange={(e) => setCurrentBet(Number(e.target.value))}
                className="bet-slider"
              />
              <p className="bet-display">Bet: £{currentBet}</p>
            </div>
          </div>
        )}
      </div>

      <div className="footer-buttons">
        <button
          onClick={() => setGameStarted(false)}
          className="back-button"
        >
          ← Leave Room
        </button>
        <Link href="/" className="back-link">
          ← Back to Home
        </Link>
      </div>

      <style jsx>{`
        .primary-button {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: bold;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.15s ease;
          margin-top: 0.5rem;
        }

        .primary-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .primary-button:disabled {
          background: #6b7280;
          cursor: not-allowed;
        }

        .poker-table-container {
          margin: 2rem 0;
          padding: 2rem 1rem;
          overflow: visible;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #111827;
          border: 1px solid #334155;
          border-radius: 10px;
          gap: 1rem;
        }

        .game-info-left {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex: 1;
        }

        .game-code-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .game-code-info code {
          font-family: monospace;
          background: #1f2937;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .game-status-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.9rem;
          flex-wrap: wrap;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: bold;
        }

        .status-badge.waiting {
          background: #f59e0b;
          color: #000;
        }

        .status-badge.dealing {
          background: #3b82f6;
          color: white;
          animation: pulse 1.5s infinite;
        }

        .status-badge.active {
          background: #22c55e;
          color: white;
        }

        .status-badge.complete {
          background: #8b5cf6;
          color: white;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .connection-status {
          font-size: 0.9rem;
          color: #9ca3af;
          white-space: nowrap;
        }

        .copy-button {
          padding: 0.4rem 0.6rem;
          background: #3b82f6;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 0.8rem;
          transition: background-color 0.15s ease;
        }

        .copy-button:hover {
          background: #2563eb;
        }

        .poker-table {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: radial-gradient(circle at center, #1a472a 0%, #0d2818 100%);
          border: 3px solid #78350f;
          border-radius: 20px;
          overflow: visible;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          margin-bottom: 2rem;
        }

        .table-felt {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .community-cards {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .community-cards h3 {
          margin: 0 0 0.5rem 0;
          font-size: 0.85rem;
          color: #9ca3af;
        }

        .cards-display {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
        }

        .card-item {
          width: 50px;
          height: 70px;
          background: white;
          border: 2px solid #000;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.75rem;
          text-align: center;
          padding: 2px;
          font-family: monospace;
        }

        .empty-board {
          color: #6b7280;
          font-size: 0.9rem;
        }

        .pot-display {
          position: absolute;
          bottom: 3%;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          color: #fbbf24;
          font-weight: bold;
          z-index: 5;
        }

        .pot-display h4 {
          margin: 0;
          font-size: 0.85rem;
          color: #9ca3af;
        }

        .pot-display p {
          margin: 0.25rem 0 0 0;
          font-size: 1.5rem;
        }

        .player-seat {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 140px;
          text-align: center;
          z-index: 10;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          overflow: visible;
          min-height: 180px;
          justify-content: flex-start;
        }

        .player-seat.top-seat {
          flex-direction: column-reverse;
        }

        .player-seat.bottom-seat {
          flex-direction: column;
        }

        .player-seat.occupied {
          background: rgba(31, 41, 55, 0.9);
          border: 2px solid #3b82f6;
          border-radius: 12px;
          padding: 0.75rem;
        }

        .player-seat.occupied.current-player {
          border-color: #fbbf24;
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
        }

        .player-seat.empty {
          background: rgba(75, 85, 99, 0.3);
          border: 2px dashed #4b5563;
          border-radius: 12px;
          padding: 0.75rem;
          opacity: 0.5;
        }

        .player-info {
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .player-name {
          font-weight: bold;
          color: #e5e7eb;
          font-size: 0.9rem;
          word-break: break-word;
        }

        .player-chips {
          color: #34d399;
          font-weight: bold;
          font-size: 0.9rem;
          margin: 0.25rem 0;
        }

        .folded-badge {
          color: #ef4444;
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        .acting-badge {
          background: #3b82f6;
          color: white;
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          margin-top: 0.25rem;
          font-weight: bold;
        }

        .player-cards {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          margin-top: 0.75rem;
          z-index: 25;
          position: relative;
          flex-wrap: wrap;
        }

        .card-placeholder {
          background: #334155;
          border: 2px solid #64748b;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.9rem;
          color: #e0e7ff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .player-cards .card-item {
          width: 35px;
          height: 50px;
          font-size: 0.65rem;
        }

        .empty-seat {
          color: #6b7280;
        }

        .seat-number {
          font-size: 0.8rem;
        }

        .game-controls {
          margin-bottom: 2rem;
        }

        .button-group {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .action-button {
          padding: 0.75rem;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 1rem;
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-button:disabled:hover {
          transform: none;
        }

        .action-button.fold {
          background: #ef4444;
          color: white;
        }

        .action-button.fold:hover {
          background: #dc2626;
        }

        .action-button.check {
          background: #6b7280;
          color: white;
        }

        .action-button.check:hover:not(:disabled) {
          background: #4b5563;
        }

        .action-button.check:disabled {
          background: #9ca3af;
          opacity: 0.6;
        }

        .action-button.call {
          background: #f59e0b;
          color: white;
        }

        .action-button.call:hover {
          background: #d97706;
        }

        .action-button.raise {
          background: #22c55e;
          color: white;
        }

        .action-button.raise:hover {
          background: #16a34a;
        }

        .bet-controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .bet-slider {
          width: 100%;
        }

        .bet-display {
          text-align: center;
          font-weight: bold;
          color: #34d399;
          margin: 0;
        }

        .footer-buttons {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }

        .back-button {
          padding: 0.75rem 1.5rem;
          background: #6b7280;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-weight: bold;
          transition: background-color 0.15s ease;
        }

        .back-button:hover {
          background: #4b5563;
        }

        .back-link {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          color: #e5e7eb;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .back-link:hover {
          color: #fbbf24;
        }

        .hand-result {
          text-align: center;
        }

        .result-title {
          font-size: 1.25rem;
          font-weight: bold;
          color: #fbbf24;
          margin: 0.5rem 0;
        }

        .winning-hand {
          font-size: 1rem;
          color: #34d399;
          margin: 0.5rem 0;
        }

        .next-hand-text {
          color: #9ca3af;
          margin: 1rem 0 0 0;
          font-size: 0.9rem;
        }

        .showdown-hands {
          background: rgba(31, 41, 55, 0.5);
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
          max-height: 200px;
          overflow-y: auto;
        }

        .showdown-hand {
          padding: 0.75rem;
          border-bottom: 1px solid #334155;
          margin-bottom: 0.75rem;
        }

        .showdown-hand:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .showdown-hand strong {
          color: #e5e7eb;
          display: block;
          margin-bottom: 0.5rem;
        }

        .showdown-cards {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        @media (max-width: 768px) {
          .poker-table {
            aspect-ratio: auto;
            min-height: 500px;
          }

          .button-group {
            grid-template-columns: repeat(2, 1fr);
          }

          .player-seat {
            width: 100px;
          }

          .card-item {
            width: 40px;
            height: 55px;
          }
        }
      `}</style>
    </main>
  );
}

