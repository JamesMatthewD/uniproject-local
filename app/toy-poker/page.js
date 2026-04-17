"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getOpponentAction } from "@/app/opponents/opponentAI";
import * as defaultOpponentModule from "@/app/opponents/example";
import { AVAILABLE_OPPONENTS, getOpponentNames, getOpponentByName, getOpponentDisplayName } from "@/app/opponents/index";

const STARTING_CHIPS = 200;
const ANTE = 5;
const PLAYER_NAMES = ["You", "Opponent"];
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

function initialPlayers() {
  return PLAYER_NAMES.map((name, index) => ({
    id: index,
    name,
    chips: STARTING_CHIPS,
    card: null,
    folded: false
  }));
}

function dealHand(players) {
  const deck = shuffle(createDeck());
  const dealtCards = [];
  for (let i = 0; i < players.length; i += 1) {
    dealtCards.push(deck.pop());
  }

  const nextPlayers = players.map((player, index) => ({
    ...player,
    card: dealtCards[index],
    folded: false
  }));

  return nextPlayers;
}

function getCardRank(card) {
  if (!card) return 0;
  const [rank] = card.split("-");
  return RANK_VALUE[rank] || 0;
}

function cardAssetName(card) {
  const [rank, suit] = card.split("-");
  const rankMap = {
    A: "ace",
    K: "king",
    Q: "queen",
    J: "jack"
  };
  const suitMap = {
    H: "hearts",
    D: "diamonds",
    C: "clubs",
    S: "spades"
  };

  const rankName = rankMap[rank] || rank;
  const suitName = suitMap[suit] || suit;
  return `${rankName}_of_${suitName}`;
}

function PokerCard({ card, hidden = false, variant = "" }) {
  const [imageMissing, setImageMissing] = useState(false);
  const assetName = hidden ? "back" : cardAssetName(card);
  const src = `/cards/${assetName}.png`;
  const fallbackText = hidden ? "?" : card;
  const classes = ["playing-card", variant].filter(Boolean).join(" ");

  if (imageMissing) {
    return <span className={classes}>{fallbackText}</span>;
  }

  return (
    <span className={`${classes} image-card`}>
      <img
        className="card-image"
        src={src}
        alt={hidden ? "Hidden card" : `Playing card ${card}`}
        onError={() => setImageMissing(true)}
      />
    </span>
  );
}

/**
 * Build game info for toy poker opponent AI
 * @private
 */
function buildToyPokerGameInfo(opponent, players, pot, currentBet) {
  return {
    myCards: opponent.card ? [opponent.card] : [],
    myChips: opponent.chips,
    boardCards: [],
    potSize: pot,
    currentBet,
    street: "pre-flop",
    myPosition: opponent.id,
    opponentChips: players[0].chips
  };
}

/**
 * Execute custom agent code in sandbox
 * @private
 */
function executeCustomAgent(agentCode, gameInfo) {
  try {
    // Create a timeout wrapper
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Agent execution timeout")), 500)
    );

    const executionPromise = (async () => {
      // Remove export keyword to make it compatible with new Function()
      const codeWithoutExport = agentCode
        .replace(/^\s*export\s+default\s+/m, "")
        .replace(/^\s*export\s+(const|let|var|function)\s+/m, "$1 ");

      // Create agent in isolated scope
      const agentModule = new Function(
        'return (function() { ' + codeWithoutExport + '; return exampleOpponent; })()'
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
      const canCall = (() => {
        try {
          return agentModule.call(safeGameInfo) ?? false;
        } catch (e) {
          return false;
        }
      })();

      const shouldFold = (() => {
        try {
          return agentModule.fold(safeGameInfo) ?? false;
        } catch (e) {
          return false;
        }
      })();

      const raiseResult = (() => {
        try {
          return agentModule.raise(safeGameInfo) ?? { shouldRaise: false, amount: 0 };
        } catch (e) {
          return { shouldRaise: false, amount: 0 };
        }
      })();

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

export default function ToyPokerPage() {
  const [gameMode, setGameMode] = useState("room-select"); // "room-select", "playing", "spectating"
  const [selectedPlayer1AI, setSelectedPlayer1AI] = useState("");
  const [spectatorAIList, setSpectatorAIList] = useState([]);
  const [uploadedAgents, setUploadedAgents] = useState([]);
  const [useCustomAgent, setUseCustomAgent] = useState(false);

  const [players, setPlayers] = useState(() => {
    const initial = initialPlayers();
    const dealt = dealHand(initial);

    return dealt.map((player) => ({
      ...player,
      chips: player.chips - ANTE
    }));
  });
  const [pot, setPot] = useState(ANTE * 2);
  const [phase, setPhase] = useState("betting");
  const [message, setMessage] = useState("Ante posted. Your move.");
  const [antagonistBet, setAntagonistBet] = useState(null);
  const [opponentAI, setOpponentAI] = useState("example");

  // Spectator state
  const [spectatorPlayers, setSpectatorPlayers] = useState(null);
  const [spectatorPot, setSpectatorPot] = useState(ANTE * 2);
  const [spectatorPhase, setSpectatorPhase] = useState("betting");
  const [spectatorMessage, setSpectatorMessage] = useState("Ante posted. AI 1 is thinking...");
  const [spectatorAntagonistBet, setSpectatorAntagonistBet] = useState(null);

  // Load uploaded agents from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("uploadedAgents");
    if (saved) {
      try {
        setUploadedAgents(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load uploaded agents:", e);
      }
    }

    // Check for spectator agents to auto-start
    const spectatorData = localStorage.getItem("spectatorAgents");
    if (spectatorData) {
      try {
        const agents = JSON.parse(spectatorData);
        // Auto-start spectator game with these agents
        setGameMode("spectating");
        
        const initial = initialPlayers();
        const dealt = dealHand(initial);
        const refreshed = dealt.map((player) => ({
          ...player,
          chips: player.chips - ANTE,
          name: player.id === 0 ? `Custom: ${agents.agent1Name}` : `Custom: ${agents.agent2Name}`
        }));

        setSpectatorPlayers(refreshed);
        setSpectatorAIList([agents.agent1Id, agents.agent2Id]);
        setSpectatorPot(ANTE * 2);
        setSpectatorPhase("betting");
        setSpectatorMessage("Ante posted. Agents are thinking...");
        setSpectatorAntagonistBet(null);

        // Start the match after a short delay
        setTimeout(() => {
          processCustomAgentMatchup(refreshed, ANTE * 2, 0, null, agents.agent1Code, agents.agent2Code);
        }, 1000);

        // Clear the spectator data after loading
        localStorage.removeItem("spectatorAgents");
      } catch (e) {
        console.error("Failed to load spectator agents:", e);
      }
    }
  }, []);

  const you = players[0];
  const opponent = players[1];

  const startSpectatorGame = async () => {
    if (!selectedPlayer1AI) return;

    const availableAIs = getOpponentNames();
    const aiList = [selectedPlayer1AI];
    
    const remaining = availableAIs.filter(ai => ai !== selectedPlayer1AI);
    const randomIndex = Math.floor(Math.random() * remaining.length);
    aiList.push(remaining[randomIndex]);

    setSpectatorAIList(aiList);
    
    const initial = initialPlayers();
    const dealt = dealHand(initial);
    const refreshed = dealt.map((player) => ({
      ...player,
      chips: player.chips - ANTE,
      name: aiList[player.id] ? `AI: ${getOpponentDisplayName(aiList[player.id])}` : player.name
    }));

    setSpectatorPlayers(refreshed);
    setSpectatorPot(ANTE * 2);
    setSpectatorPhase("betting");
    setSpectatorMessage("Ante posted. AI 1 is thinking...");
    setSpectatorAntagonistBet(null);
    setGameMode("spectating");
  };

  const startCustomAgentSpectator = async () => {
    if (!selectedPlayer1AI) return;

    const agent = uploadedAgents.find(a => a.id === selectedPlayer1AI);
    if (!agent) return;

    const availableAIs = getOpponentNames();
    const randomAI = availableAIs[Math.floor(Math.random() * availableAIs.length)];
    
    setSpectatorAIList([selectedPlayer1AI, randomAI]);
    
    const initial = initialPlayers();
    const dealt = dealHand(initial);
    const refreshed = dealt.map((player) => ({
      ...player,
      chips: player.chips - ANTE,
      name: player.id === 0 ? `Custom: ${agent.name}` : `AI: ${getOpponentDisplayName(randomAI)}`
    }));

    setSpectatorPlayers(refreshed);
    setSpectatorPot(ANTE * 2);
    setSpectatorPhase("betting");
    setSpectatorMessage("Ante posted. Custom Agent is thinking...");
    setSpectatorAntagonistBet(null);
    setGameMode("spectating");

    // Start game after short delay
    setTimeout(() => {
      processCustomAgentMove(refreshed, ANTE * 2, 0, null, agent.code);
    }, 1000);
  };

  async function processCustomAgentMove(currentPlayers, currentPot, currentAntagonistBet, lastPlayerIndex, customAgentCode) {
    if (spectatorPhase !== "betting") return;

    const currentPlayerIndex = lastPlayerIndex === 0 ? 1 : 0;
    const currentPlayer = currentPlayers[currentPlayerIndex];
    const otherPlayer = currentPlayers[1 - currentPlayerIndex];

    if (currentPlayer.folded) {
      spectatorResolveHand(currentPlayers, currentPot);
      return;
    }

    const gameInfo = buildToyPokerGameInfo(currentPlayer, currentPlayers, currentPot, currentAntagonistBet);
    
    let decision;
    
    if (currentPlayerIndex === 0) {
      // Custom agent's turn
      decision = await executeCustomAgent(customAgentCode, gameInfo);
      var playerDisplayName = `Custom Agent`;
    } else {
      // Built-in AI's turn
      const aiName = spectatorAIList[currentPlayerIndex];
      const selectedOpponentModule = getOpponentByName(aiName);
      decision = getOpponentAction(selectedOpponentModule?.exampleOpponent, gameInfo);
      playerDisplayName = `AI: ${getOpponentDisplayName(aiName)}`;
    }

    if (decision.action === "fold") {
      setSpectatorMessage(`${playerDisplayName} folded. Other player wins!`);
      const nextPlayers = currentPlayers.map((p, idx) =>
        idx === currentPlayerIndex ? { ...p, folded: true } : p
      );
      setSpectatorPlayers(nextPlayers);
      setSpectatorPhase("result");
      return;
    }

    if (lastPlayerIndex === null) {
      // First move (custom agent acts first)
      if (decision.action === "raise" || decision.action === "call") {
        const betAmount = decision.amount || 10;
        setSpectatorMessage(`${playerDisplayName} raised ${betAmount}. Other AI is deciding...`);
        setSpectatorAntagonistBet(betAmount);

        setTimeout(() => {
          processCustomAgentMove(currentPlayers, currentPot + betAmount, betAmount, 0, customAgentCode);
        }, 1000);
      } else {
        setSpectatorMessage(`${playerDisplayName} checked.`);
        setTimeout(() => {
          processCustomAgentMove(currentPlayers, currentPot, 0, 0, customAgentCode);
        }, 1000);
      }
    } else if (currentPlayerIndex === 1 && lastPlayerIndex === 0) {
      // Built-in AI responding to custom agent
      if (decision.action === "fold") {
        setSpectatorMessage(`${playerDisplayName} folded!`);
        const nextPlayers = currentPlayers.map((p, idx) =>
          idx === 1 ? { ...p, folded: true } : p
        );
        setSpectatorPlayers(nextPlayers);
        setSpectatorPhase("result");
      } else {
        // Built-in AI calls
        const potIncrease = Math.min(currentPlayer.chips, currentAntagonistBet);
        const nextPlayers = currentPlayers.map((p, idx) =>
          idx === 1 ? { ...p, chips: p.chips - potIncrease } : p
        );
        setSpectatorPlayers(nextPlayers);
        setSpectatorMessage("Both players called. Revealing cards...");
        setSpectatorPhase("result");

        setTimeout(() => {
          spectatorResolveHand(nextPlayers, currentPot + potIncrease);
        }, 1500);
      }
    }
  }

  async function processCustomAgentMatchup(currentPlayers, currentPot, currentAntagonistBet, lastPlayerIndex, agent1Code, agent2Code) {
    if (spectatorPhase !== "betting") return;

    const currentPlayerIndex = lastPlayerIndex === 0 ? 1 : 0;
    const currentPlayer = currentPlayers[currentPlayerIndex];
    const otherPlayer = currentPlayers[1 - currentPlayerIndex];

    if (currentPlayer.folded) {
      spectatorResolveHand(currentPlayers, currentPot);
      return;
    }

    const gameInfo = buildToyPokerGameInfo(currentPlayer, currentPlayers, currentPot, currentAntagonistBet);
    
    let decision;
    let playerDisplayName;
    let agentCode;
    
    if (currentPlayerIndex === 0) {
      // Agent 1's turn
      agentCode = agent1Code;
      decision = await executeCustomAgent(agentCode, gameInfo);
      playerDisplayName = `Custom: ${spectatorPlayers[0]?.name?.split(": ")[1] || "Agent 1"}`;
    } else {
      // Agent 2's turn
      agentCode = agent2Code;
      decision = await executeCustomAgent(agentCode, gameInfo);
      playerDisplayName = `Custom: ${spectatorPlayers[1]?.name?.split(": ")[1] || "Agent 2"}`;
    }

    if (decision.action === "fold") {
      setSpectatorMessage(`${playerDisplayName} folded. Other player wins!`);
      const nextPlayers = currentPlayers.map((p, idx) =>
        idx === currentPlayerIndex ? { ...p, folded: true } : p
      );
      setSpectatorPlayers(nextPlayers);
      setSpectatorPhase("result");
      return;
    }

    if (lastPlayerIndex === null) {
      // First move (agent 1 acts first)
      if (decision.action === "raise" || decision.action === "call") {
        const betAmount = decision.amount || 10;
        setSpectatorMessage(`${playerDisplayName} raised ${betAmount}. Agent 2 is deciding...`);
        setSpectatorAntagonistBet(betAmount);

        setTimeout(() => {
          processCustomAgentMatchup(currentPlayers, currentPot + betAmount, betAmount, 0, agent1Code, agent2Code);
        }, 1000);
      } else {
        setSpectatorMessage(`${playerDisplayName} checked.`);
        setTimeout(() => {
          processCustomAgentMatchup(currentPlayers, currentPot, 0, 0, agent1Code, agent2Code);
        }, 1000);
      }
    } else if (currentPlayerIndex === 1 && lastPlayerIndex === 0) {
      // Agent 2 responding to agent 1
      if (decision.action === "raise" || decision.action === "call") {
        const potIncrease = Math.min(currentPlayer.chips, currentAntagonistBet);
        const nextPlayers = currentPlayers.map((p, idx) =>
          idx === 1 ? { ...p, chips: p.chips - potIncrease } : p
        );
        setSpectatorPlayers(nextPlayers);
        setSpectatorMessage("Both players called. Revealing cards...");
        setSpectatorPhase("result");

        setTimeout(() => {
          spectatorResolveHand(nextPlayers, currentPot + potIncrease);
        }, 1500);
      } else {
        setSpectatorMessage(`${playerDisplayName} folded!`);
        const nextPlayers = currentPlayers.map((p, idx) =>
          idx === 1 ? { ...p, folded: true } : p
        );
        setSpectatorPlayers(nextPlayers);
        setSpectatorPhase("result");
      }
    }
  }

  function startNewHand() {
    const initial = initialPlayers();
    const dealt = dealHand(initial);

    const refreshed = dealt.map((player) => ({
      ...player,
      chips: player.chips - ANTE
    }));

    setPlayers(refreshed);
    setPot(ANTE * 2);
    setPhase("betting");
    setMessage("Ante posted. Your move.");
    setAntagonistBet(null);
  }

  function startNewSpectatorHand() {
    const initial = initialPlayers();
    const dealt = dealHand(initial);
    
    // Get the custom agent code if using custom agent
    const customAgent = useCustomAgent ? uploadedAgents.find(a => a.id === selectedPlayer1AI) : null;
    
    const refreshed = dealt.map((player) => ({
      ...player,
      chips: player.chips - ANTE,
      name: spectatorAIList[player.id] 
        ? (player.id === 0 && customAgent ? `Custom: ${customAgent.name}` : `AI: ${getOpponentDisplayName(spectatorAIList[player.id])}`)
        : player.name
    }));

    setSpectatorPlayers(refreshed);
    setSpectatorPot(ANTE * 2);
    setSpectatorPhase("betting");
    setSpectatorMessage(useCustomAgent ? "Ante posted. Custom Agent is thinking..." : "Ante posted. AI 1 is thinking...");
    setSpectatorAntagonistBet(null);

    setTimeout(() => {
      if (useCustomAgent && customAgent) {
        processCustomAgentMove(refreshed, ANTE * 2, 0, null, customAgent.code);
      } else {
        processSpectatorMove(refreshed, ANTE * 2, 0, null);
      }
    }, 1000);
  }

  function handleCall() {
    if (phase !== "betting" || you.folded) {
      return;
    }

    const callAmount = antagonistBet || 0;
    if (callAmount > you.chips) {
      return;
    }

    const nextPot = pot + callAmount;
    const nextPlayers = players.map((player, index) => {
      if (index === 0) {
        return { ...player, chips: player.chips - callAmount };
      }
      return player;
    });

    setPlayers(nextPlayers);
    setPot(nextPot);
    setMessage("You called. Revealing cards...");

    setTimeout(() => {
      resolveHand(nextPlayers, nextPot);
    }, 1500);
  }

  function handleRaise() {
    if (phase !== "betting" || you.folded) {
      return;
    }

    const raiseAmount = Math.min(you.chips, 20);
    const nextPot = pot + raiseAmount;
    const nextPlayers = players.map((player, index) => {
      if (index === 0) {
        return { ...player, chips: player.chips - raiseAmount };
      }
      return player;
    });

    setPlayers(nextPlayers);
    setPot(nextPot);
    setMessage(`You raised ${raiseAmount}. Opponent is deciding...`);

    setTimeout(() => {
      // Build game info for opponent AI
      const gameInfo = buildToyPokerGameInfo(nextPlayers[1], nextPlayers, nextPot, raiseAmount);
      
      // Get opponent's decision using selected AI
      const selectedOpponentModule = getOpponentByName(opponentAI);
      const decision = getOpponentAction(selectedOpponentModule?.exampleOpponent, gameInfo);

      if (decision.action === "fold") {
        finishRound(nextPlayers, nextPot, "Opponent folded. You win the pot!");
      } else {
        // Opponent calls (or raises, but we'll treat as call for simplicity)
        const opponentCall = nextPlayers.map((player, index) => {
          if (index === 1) {
            const callChips = Math.min(player.chips, raiseAmount);
            return { ...player, chips: player.chips - callChips };
          }
          return player;
        });
        const nextNextPot = nextPot + Math.min(nextPlayers[1].chips, raiseAmount);
        setMessage("Opponent called. Revealing cards...");
        setTimeout(() => {
          resolveHand(opponentCall, nextNextPot);
        }, 1500);
      }
    }, 1000);
  }

  function processSpectatorMove(currentPlayers, currentPot, currentAntagonistBet, lastPlayerIndex) {
    if (spectatorPhase !== "betting") return;

    const currentPlayerIndex = lastPlayerIndex === 0 ? 1 : 0;
    const currentPlayer = currentPlayers[currentPlayerIndex];
    const otherPlayer = currentPlayers[1 - currentPlayerIndex];

    if (currentPlayer.folded) {
      spectatorResolveHand(currentPlayers, currentPot);
      return;
    }

    const gameInfo = buildToyPokerGameInfo(currentPlayer, currentPlayers, currentPot, currentAntagonistBet);
    const aiName = spectatorAIList[currentPlayerIndex];
    const selectedOpponentModule = getOpponentByName(aiName);
    const decision = getOpponentAction(selectedOpponentModule?.exampleOpponent, gameInfo);

    const playerDisplayName = `AI: ${getOpponentDisplayName(aiName)}`;

    if (decision.action === "fold") {
      setSpectatorMessage(`${playerDisplayName} folded. Other player wins!`);
      const nextPlayers = currentPlayers.map((p, idx) =>
        idx === currentPlayerIndex ? { ...p, folded: true } : p
      );
      setSpectatorPlayers(nextPlayers);
      setSpectatorPhase("result");
      return;
    }

    if (lastPlayerIndex === null) {
      // First move (AI 1 acts first)
      if (decision.action === "raise" || decision.action === "call") {
        const betAmount = decision.amount || 10;
        setSpectatorMessage(`${playerDisplayName} raised ${betAmount}. Other AI is deciding...`);
        setSpectatorAntagonistBet(betAmount);

        setTimeout(() => {
          processSpectatorMove(currentPlayers, currentPot + betAmount, betAmount, 0);
        }, 1000);
      } else {
        setSpectatorMessage(`${playerDisplayName} checked.`);
        setTimeout(() => {
          processSpectatorMove(currentPlayers, currentPot, 0, 0);
        }, 1000);
      }
    } else if (currentPlayerIndex === 1 && lastPlayerIndex === 0) {
      // AI 2 responding to AI 1
      if (decision.action === "fold") {
        setSpectatorMessage(`${playerDisplayName} folded!`);
        const nextPlayers = currentPlayers.map((p, idx) =>
          idx === 1 ? { ...p, folded: true } : p
        );
        setSpectatorPlayers(nextPlayers);
        setSpectatorPhase("result");
      } else {
        // AI 2 calls
        const potIncrease = Math.min(currentPlayer.chips, currentAntagonistBet);
        const nextPlayers = currentPlayers.map((p, idx) =>
          idx === 1 ? { ...p, chips: p.chips - potIncrease } : p
        );
        setSpectatorPlayers(nextPlayers);
        setSpectatorMessage("Both AIs called. Revealing cards...");
        setSpectatorPhase("result");

        setTimeout(() => {
          spectatorResolveHand(nextPlayers, currentPot + potIncrease);
        }, 1500);
      }
    }
  }

  function spectatorResolveHand(roundPlayers, roundPot) {
    const ai1Rank = getCardRank(roundPlayers[0].card);
    const ai2Rank = getCardRank(roundPlayers[1].card);

    let resultMsg;
    let winner;

    if (ai1Rank > ai2Rank) {
      winner = 0;
      const ai1Name = `AI: ${getOpponentDisplayName(spectatorAIList[0])}`;
      resultMsg = `${ai1Name} wins ${roundPot}! ${roundPlayers[0].card} beats ${roundPlayers[1].card}.`;
    } else if (ai2Rank > ai1Rank) {
      winner = 1;
      const ai2Name = `AI: ${getOpponentDisplayName(spectatorAIList[1])}`;
      resultMsg = `${ai2Name} wins ${roundPot}! ${roundPlayers[1].card} beats ${roundPlayers[0].card}.`;
    } else {
      resultMsg = `Tie! Pot split.`;
      winner = -1;
    }

    let nextPlayers = roundPlayers;
    if (winner === 0) {
      nextPlayers = roundPlayers.map((player, index) =>
        index === 0 ? { ...player, chips: player.chips + roundPot } : player
      );
    } else if (winner === 1) {
      nextPlayers = roundPlayers.map((player, index) =>
        index === 1 ? { ...player, chips: player.chips + roundPot } : player
      );
    } else if (winner === -1) {
      const split = Math.floor(roundPot / 2);
      nextPlayers = roundPlayers.map((player, index) => ({
        ...player,
        chips: player.chips + split
      }));
    }

    setSpectatorPlayers(nextPlayers);
    setSpectatorPhase("result");
    setSpectatorMessage(resultMsg);
  }

  // Room selector view
  if (gameMode === "room-select") {
    return (
      <main className="container">
        <h1>Toy Poker - High Card</h1>
        <p>Play against an AI opponent or watch AIs and custom agents battle.</p>

        <div className="room-selector">
          <div className="card">
            <h2>Play Game</h2>
            <p>Challenge an AI opponent to a high card poker game.</p>
            <button onClick={() => setGameMode("playing")} className="primary-button">
              Start Playing
            </button>
          </div>

          <div className="card">
            <h2>Watch AI Battle</h2>
            <p>Select an AI for Player 1. The other AI will be random.</p>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                Player 1 AI:
              </label>
              <select
                value={useCustomAgent ? "" : selectedPlayer1AI}
                onChange={(e) => {
                  setSelectedPlayer1AI(e.target.value);
                  setUseCustomAgent(false);
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #4b5563",
                  background: "#111827",
                  color: "#fff"
                }}
              >
                <option value="">Select AI...</option>
                {getOpponentNames().map(name => (
                  <option key={name} value={name}>
                    {getOpponentDisplayName(name)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={startSpectatorGame}
              className="primary-button"
              disabled={useCustomAgent || !selectedPlayer1AI}
              style={{ marginTop: "0.75rem" }}
            >
              Start Spectating
            </button>
          </div>

          <div className="card">
            <h2>Watch Custom Agent</h2>
            <p>Watch your uploaded custom agent vs a random built-in AI.</p>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                Custom Agent:
              </label>
              <select
                value={useCustomAgent ? selectedPlayer1AI : ""}
                onChange={(e) => {
                  setSelectedPlayer1AI(e.target.value);
                  setUseCustomAgent(true);
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #4b5563",
                  background: "#111827",
                  color: "#fff"
                }}
              >
                <option value="">Select Custom Agent...</option>
                {uploadedAgents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} (ID: {agent.id?.substring(0, 12)}...)
                  </option>
                ))}
              </select>
              {uploadedAgents.length === 0 && (
                <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.5rem" }}>
                  No custom agents uploaded. <Link href="/agents" style={{ color: "#60a5fa" }}>Upload one here</Link>.
                </p>
              )}
            </div>
            <button
              onClick={startCustomAgentSpectator}
              className="primary-button"
              disabled={!useCustomAgent || !selectedPlayer1AI || uploadedAgents.length === 0}
              style={{ marginTop: "0.75rem" }}
            >
              Start Spectating
            </button>
          </div>
        </div>

        <Link href="/" className="back-link">
          ← Back to Home
        </Link>

        <style jsx>{`
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #0f172a;
            color: #e5e7eb;
            min-height: 100vh;
          }

          .room-selector {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
          }

          .card {
            background: #1e293b;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #334155;
          }

          .card h2 {
            margin-top: 0;
          }

          .card p {
            color: #cbd5e1;
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

          .back-link {
            color: #60a5fa;
            text-decoration: none;
            margin-top: 2rem;
            display: inline-block;
          }

          .back-link:hover {
            color: #93c5fd;
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

  // Spectator view
  if (gameMode === "spectating" && spectatorPlayers) {
    const spectatorAI1 = spectatorPlayers[0];
    const spectatorAI2 = spectatorPlayers[1];

    return (
      <main className="ingame-page">
        <button
          onClick={() => {
            setGameMode("room-select");
            setSelectedPlayer1AI("");
            setSpectatorAIList([]);
          }}
          className="ingame-back-link"
          style={{ cursor: "pointer", background: "none", border: "none", color: "#60a5fa" }}
        >
          ← Back to Menu
        </button>

        <section className="green-box poker-table" aria-label="Spectator toy poker table">
          <header className="table-header">
            <h1>Toy Poker - High Card (Spectator)</h1>
            <p>Pot: {spectatorPot} chips</p>
          </header>

          <div className="opponents-row" aria-label="AI 1">
            <article className="seat">
              <h2>{spectatorAI1.name}</h2>
              <div className="cards-with-chips">
                <div className="hole-cards hidden-cards">
                  {spectatorPhase === "result" && spectatorAI1.card ? (
                    <PokerCard card={spectatorAI1.card} />
                  ) : (
                    <PokerCard card="X-X" hidden variant="back" />
                  )}
                </div>
                <p className="chip-tag">Chips: {spectatorAI1.chips}</p>
              </div>
              {spectatorAI1.folded && <p className="status-note">Folded</p>}
            </article>
          </div>

          <section className="user-seat" aria-label="AI 2 and info">
            <h2>{spectatorAI2.name}</h2>
            <div className="cards-with-chips">
              <div className="hole-cards hidden-cards">
                {spectatorPhase === "result" && spectatorAI2.card ? (
                  <PokerCard card={spectatorAI2.card} />
                ) : (
                  <PokerCard card="X-X" hidden variant="back" />
                )}
              </div>
              <p className="chip-tag">Chips: {spectatorAI2.chips}</p>
            </div>

            <p className="status-note">{spectatorMessage}</p>

            {spectatorPhase === "result" && (
              <button
                type="button"
                className="poker-action new-hand"
                onClick={startNewSpectatorHand}
              >
                Play Again
              </button>
            )}
          </section>
        </section>
      </main>
    );
  }

  function handleFold() {
    if (phase !== "betting") {
      return;
    }

    const nextPlayers = players.map((player, index) =>
      index === 0 ? { ...player, folded: true } : player
    );

    setPlayers(nextPlayers);
    setPhase("result");
    setMessage("You folded. Opponent wins the pot!");
  }

  function resolveHand(roundPlayers, roundPot) {
    const yourRank = getCardRank(roundPlayers[0].card);
    const oppRank = getCardRank(roundPlayers[1].card);

    let winner;
    let resultMsg;

    if (yourRank > oppRank) {
      winner = 0;
      resultMsg = `You win ${roundPot} chips! Your ${roundPlayers[0].card} beats ${roundPlayers[1].card}.`;
    } else if (oppRank > yourRank) {
      winner = 1;
      resultMsg = `Opponent wins ${roundPot} chips. Their ${roundPlayers[1].card} beats your ${roundPlayers[0].card}.`;
    } else {
      resultMsg = `Tie! Pot split.`;
      winner = -1;
    }

    finishRound(roundPlayers, roundPot, resultMsg, winner);
  }

  function finishRound(roundPlayers, roundPot, resultMsg, winner = 0) {
    let nextPlayers = roundPlayers;

    if (winner === 0) {
      nextPlayers = roundPlayers.map((player, index) =>
        index === 0 ? { ...player, chips: player.chips + roundPot } : player
      );
    } else if (winner === 1) {
      nextPlayers = roundPlayers.map((player, index) =>
        index === 1 ? { ...player, chips: player.chips + roundPot } : player
      );
    } else if (winner === -1) {
      const split = Math.floor(roundPot / 2);
      nextPlayers = roundPlayers.map((player, index) => ({
        ...player,
        chips: player.chips + split
      }));
    }

    setPlayers(nextPlayers);
    setPhase("result");
    setMessage(resultMsg);
  }

  // Player game view
  return (
    <main className="ingame-page">
      <button
        onClick={() => setGameMode("room-select")}
        className="ingame-back-link"
        style={{ cursor: "pointer", background: "none", border: "none", color: "#60a5fa" }}
      >
        ← Back to Menu
      </button>

      <section className="green-box poker-table" aria-label="Toy poker table">
        <header className="table-header">
          <h1>Toy Poker - High Card</h1>
          <p>Pot: {pot} chips</p>
        </header>

        <div className="opponents-row" aria-label="Opponent">
          <article className="seat" key={opponent.id}>
            <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
              <h2 style={{margin: 0}}>{opponent.name}</h2>
              <select
                value={opponentAI}
                onChange={(e) => setOpponentAI(e.target.value)}
                style={{padding: "4px 8px", fontSize: "14px"}}
              >
                {getOpponentNames().map((aiName) => (
                  <option key={aiName} value={aiName}>
                    {getOpponentDisplayName(aiName)}
                  </option>
                ))}
              </select>
            </div>
            <div className="cards-with-chips">
              <div className="hole-cards hidden-cards">
                {phase === "result" && opponent.card ? (
                  <PokerCard card={opponent.card} />
                ) : (
                  <PokerCard card="X-X" hidden variant="back" />
                )}
              </div>
              <p className="chip-tag">Chips: {opponent.chips}</p>
            </div>
            {opponent.folded && <p className="status-note">Folded</p>}
          </article>
        </div>

        <section className="user-seat" aria-label="Your card and controls">
          <h2>{you.name}</h2>
          <div className="cards-with-chips">
            <div className="hole-cards">
              {you.card && <PokerCard card={you.card} />}
            </div>
            <p className="chip-tag">Chips: {you.chips}</p>
          </div>

          {phase === "betting" && !you.folded && (
            <div className="action-row">
              <button
                type="button"
                className="poker-action fold"
                onClick={handleFold}
                disabled={phase !== "betting"}
              >
                Fold
              </button>
              <button
                type="button"
                className="poker-action call"
                onClick={handleCall}
                disabled={phase !== "betting"}
              >
                Call
              </button>
              <button
                type="button"
                className="poker-action raise"
                onClick={handleRaise}
                disabled={phase !== "betting" || you.chips <= 0}
              >
                Raise
              </button>
            </div>
          )}

          <p className="status-note">{message}</p>

          {phase === "result" && (
            <button type="button" className="poker-action new-hand" onClick={startNewHand}>
              Play Again
            </button>
          )}
        </section>
      </section>

      <Link href="/" className="ingame-back-link" style={{ marginTop: "1rem", display: "block" }}>
        ← Home
      </Link>
    </main>
  );
}
