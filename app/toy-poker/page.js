"use client";

import { useState } from "react";
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

export default function ToyPokerPage() {
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

  const you = players[0];
  const opponent = players[1];

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

  return (
    <main className="ingame-page">
      <Link href="/" className="ingame-back-link">
        Back to main page
      </Link>

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
    </main>
  );
}
