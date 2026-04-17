"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STARTING_CHIPS = 1000;
const POKER_TABLE_SEATS = 6; // Number of seats at the table

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

  // Initialize with room selection
  useEffect(() => {
    const newPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`;
    setPlayerId(newPlayerId);
    setLoading(false);
  }, []);

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
      setGameState({
        players: [
          {
            id: playerId,
            name: `Player ${playerId.slice(-4)}`,
            chips: STARTING_CHIPS,
            cards: [],
            folded: false,
          },
        ],
        board: [],
        currentStreet: "lobby",
        pot: 0,
        status: "waiting",
      });
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
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            margin: 2rem 0;
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
          <div className="game-code-info">
            <strong>Game:</strong> <code>{gameId}</code>
            <button onClick={copyGameCode} className="copy-button">
              Copy Code
            </button>
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
                      <div key={idx} className="card-item">
                        {card}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-board">No cards dealt yet</div>
              )}
            </div>

            {/* Pot */}
            <div className="pot-display">
              <h4>Pot</h4>
              <p>${gameState?.pot || 0}</p>
            </div>

            {/* Player Seats */}
            {Array.from({ length: POKER_TABLE_SEATS }).map((_, index) => {
              const player = getPlayerAtSeat(index);
              const pos = getSeatPosition(index);
              const isCurrentPlayer = player?.id === playerId;

              return (
                <div
                  key={index}
                  className={`player-seat seat-${index} ${isCurrentPlayer ? "current-player" : ""} ${
                    player ? "occupied" : "empty"
                  }`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                  }}
                >
                  {player ? (
                    <>
                      <div className="player-info">
                        <div className="player-name">{player.name}</div>
                        <div className="player-chips">${player.chips}</div>
                        {player.folded && <div className="folded-badge">Folded</div>}
                      </div>
                      {player.cards && player.cards.length > 0 && (
                        <div className="player-cards">
                          {player.cards.map((card, idx) => (
                            <div key={idx} className="card-item">
                              {isCurrentPlayer ? card : "?"}
                            </div>
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
        <div className="card">
          <h2>Your Actions</h2>
          <div className="button-group">
            <button
              className="action-button fold"
              onClick={() => handleAction("fold")}
            >
              Fold
            </button>
            <button
              className="action-button check"
              onClick={() => handleAction("check")}
            >
              Check
            </button>
            <button
              className="action-button call"
              onClick={() => handleAction("call")}
            >
              Call
            </button>
            <button
              className="action-button raise"
              onClick={() => handleAction("raise", currentBet)}
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
            <p className="bet-display">Bet: ${currentBet}</p>
          </div>
        </div>
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
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #111827;
          border: 1px solid #334155;
          border-radius: 10px;
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

        .connection-status {
          font-size: 0.9rem;
          color: #9ca3af;
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
          overflow: hidden;
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
          bottom: 10%;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          color: #fbbf24;
          font-weight: bold;
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
          width: 120px;
          text-align: center;
          z-index: 10;
          transition: all 0.2s ease;
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
          font-size: 0.85rem;
        }

        .folded-badge {
          color: #ef4444;
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        .player-cards {
          display: flex;
          gap: 0.25rem;
          justify-content: center;
          margin-top: 0.5rem;
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

        .action-button.check:hover {
          background: #4b5563;
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

