"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const STARTING_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const RAISE_INCREMENT = 20;
const PLAYER_NAMES = ["You", "Alex", "Riley", "Jordan"];
const STREETS = ["pre-flop", "flop", "turn", "river", "showdown"];
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
    cards: [],
    folded: false
  }));
}

function dealHand(players) {
  const deck = shuffle(createDeck());
  const nextPlayers = players.map((player) => ({ ...player, cards: [], folded: false }));

  for (let round = 0; round < 2; round += 1) {
    for (const player of nextPlayers) {
      player.cards.push(deck.pop());
    }
  }

  return { nextPlayers, board: [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()] };
}

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

function settleShowdown(activePlayers, boardCards) {
  const scoredPlayers = activePlayers.map((player) => ({
    player,
    score: evaluateSevenCards([...player.cards, ...boardCards])
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

  const handNamesById = Object.fromEntries(scoredPlayers.map((entry) => [entry.player.id, entry.score.name]));
  return { winners, winningHandName: bestScore.name, handNamesById };
}

function boardCardsToShow(street) {
  if (street === "pre-flop") {
    return 0;
  }
  if (street === "flop") {
    return 3;
  }
  if (street === "turn") {
    return 4;
  }
  return 5;
}

function clonePlayers(players) {
  return players.map((player) => ({ ...player, cards: [...player.cards] }));
}

export default function IngamePage() {
  const [players, setPlayers] = useState(() => {
    const { nextPlayers } = dealHand(initialPlayers());
    const seeded = clonePlayers(nextPlayers);

    if (seeded[1]) {
      const posted = Math.min(SMALL_BLIND, seeded[1].chips);
      seeded[1].chips -= posted;
    }
    if (seeded[2]) {
      const posted = Math.min(BIG_BLIND, seeded[2].chips);
      seeded[2].chips -= posted;
    }

    return seeded;
  });
  const [boardCards, setBoardCards] = useState(() => dealHand(initialPlayers()).board);
  const [pot, setPot] = useState(SMALL_BLIND + BIG_BLIND);
  const [street, setStreet] = useState("pre-flop");
  const [currentBet, setCurrentBet] = useState(BIG_BLIND);
  const [message, setMessage] = useState("Blinds posted. Pre-flop action on you.");
  const [handFinished, setHandFinished] = useState(false);
  const [showdownHands, setShowdownHands] = useState({});

  const you = players[0];
  const canCall = !handFinished && !you.folded && (currentBet === 0 || you.chips > 0);
  const raiseToAmount = currentBet === 0 ? BIG_BLIND + RAISE_INCREMENT : currentBet + RAISE_INCREMENT;
  const canRaise = !handFinished && !you.folded && you.chips >= raiseToAmount;

  const opponents = useMemo(() => players.slice(1), [players]);
  const visibleBoard = useMemo(
    () => boardCards.slice(0, boardCardsToShow(street)),
    [boardCards, street]
  );

  function createNewHandFromPlayers(basePlayers) {
    const { nextPlayers, board } = dealHand(basePlayers);
    const refreshedPlayers = clonePlayers(nextPlayers).map((player) => ({
      ...player,
      folded: player.chips <= 0 ? true : false
    }));

    let nextPot = 0;
    if (refreshedPlayers[1] && !refreshedPlayers[1].folded) {
      const posted = Math.min(SMALL_BLIND, refreshedPlayers[1].chips);
      refreshedPlayers[1].chips -= posted;
      nextPot += posted;
    }
    if (refreshedPlayers[2] && !refreshedPlayers[2].folded) {
      const posted = Math.min(BIG_BLIND, refreshedPlayers[2].chips);
      refreshedPlayers[2].chips -= posted;
      nextPot += posted;
    }

    setPlayers(refreshedPlayers);
    setBoardCards(board);
    setPot(nextPot);
    setStreet("pre-flop");
    setCurrentBet(BIG_BLIND);
    setHandFinished(false);
    setShowdownHands({});
    setMessage("Blinds posted. Pre-flop action on you.");
  }

  function startNewHand() {
    createNewHandFromPlayers(players);
  }

  function finishHand(updatedPlayers, handPot, detailMessage) {
    const activePlayers = updatedPlayers.filter((player) => !player.folded);
    let winners = [];
    let handNamesById = {};
    let resolvedMessage = detailMessage;

    if (activePlayers.length <= 1) {
      winners = activePlayers.length ? activePlayers : [updatedPlayers[0]];
    } else {
      const showdown = settleShowdown(activePlayers, boardCards);
      winners = showdown.winners;
      handNamesById = showdown.handNamesById;
      const winnersLabel = winners.map((winner) => winner.name).join(", ");
      resolvedMessage = `${winnersLabel} win${winners.length > 1 ? "" : "s"} ${handPot} chips with ${showdown.winningHandName}.`;
    }

    const share = Math.floor(handPot / winners.length);
    let remainder = handPot % winners.length;
    const winnerIds = new Set(winners.map((winner) => winner.id));

    const resultPlayers = updatedPlayers.map((player) => {
      if (!winnerIds.has(player.id)) {
        return player;
      }

      let bonus = share;
      if (remainder > 0) {
        bonus += 1;
        remainder -= 1;
      }

      return { ...player, chips: player.chips + bonus };
    });

    setPlayers(resultPlayers);
    setPot(handPot);
    setStreet("showdown");
    setHandFinished(true);
    setCurrentBet(0);
    setShowdownHands(handNamesById);
    setMessage(resolvedMessage || `${winners[0].name} wins ${handPot} chips.`);
  }

  function runBettingRound(basePlayers, amountToMatch, userActionLabel, wasRaise, startingPot) {
    const workingPlayers = clonePlayers(basePlayers);
    let workingPot = startingPot;

    for (let i = 1; i < workingPlayers.length; i += 1) {
      const opponent = workingPlayers[i];
      if (opponent.folded || opponent.chips <= 0) {
        continue;
      }

      const baseFoldChance = street === "river" ? 0.2 : 0.3;
      const foldChance = wasRaise ? baseFoldChance + 0.15 : baseFoldChance;
      if (Math.random() < foldChance) {
        opponent.folded = true;
        continue;
      }

      const paid = Math.min(amountToMatch, opponent.chips);
      opponent.chips -= paid;
      workingPot += paid;
    }

    const activePlayers = workingPlayers.filter((player) => !player.folded);
    if (activePlayers.length <= 1) {
      const loneWinner = activePlayers[0] || workingPlayers[0];
      finishHand(workingPlayers, workingPot, `${loneWinner.name} wins ${workingPot} chips (everyone else folded).`);
      return;
    }

    if (street === "river") {
      finishHand(workingPlayers, workingPot, `River complete. Showdown: remaining players reveal. Winner takes ${workingPot} chips.`);
      return;
    }

    const currentStreetIndex = STREETS.indexOf(street);
    const nextStreet = STREETS[currentStreetIndex + 1];

    setPlayers(workingPlayers);
    setPot(workingPot);
    setStreet(nextStreet);
    setCurrentBet(0);
    setMessage(`${userActionLabel} resolved. Moving to ${nextStreet}.`);
  }

  function handleFold() {
    if (handFinished) {
      return;
    }

    const updatedPlayers = players.map((player, index) =>
      index === 0 ? { ...player, folded: true } : { ...player }
    );
    finishHand(updatedPlayers, pot, "You folded. Opponents collect the pot.");
  }

  function handleCall() {
    if (!canCall) {
      return;
    }

    const amountToMatch = currentBet;
    const updatedPlayers = players.map((player, index) => {
      if (index !== 0) {
        return { ...player };
      }

      const paid = Math.min(amountToMatch, player.chips);
      return { ...player, chips: player.chips - paid };
    });

    const paid = Math.min(amountToMatch, players[0].chips);
    const nextPot = pot + paid;
    setPlayers(updatedPlayers);
    setPot(nextPot);
    setMessage(amountToMatch === 0 ? "You checked." : `You called ${amountToMatch}.`);
    runBettingRound(
      updatedPlayers,
      amountToMatch,
      amountToMatch === 0 ? "Check" : "Call",
      false,
      nextPot
    );
  }

  function handleRaise() {
    if (!canRaise) {
      return;
    }

    const amountToMatch = raiseToAmount;
    const updatedPlayers = players.map((player, index) => {
      if (index !== 0) {
        return { ...player };
      }

      const paid = Math.min(amountToMatch, player.chips);
      return { ...player, chips: player.chips - paid };
    });

    const paid = Math.min(amountToMatch, players[0].chips);
    const nextPot = pot + paid;
    setPlayers(updatedPlayers);
    setPot(nextPot);
    setCurrentBet(amountToMatch);
    setMessage(`You raised to ${amountToMatch}.`);
    runBettingRound(updatedPlayers, amountToMatch, `Raise to ${amountToMatch}`, true, nextPot);
  }

  return (
    <main className="ingame-page">
      <Link href="/" className="ingame-back-link">
        Back to main page
      </Link>

      <section className="green-box poker-table" aria-label="Poker table">
        <header className="table-header">
          <h1>Poker Table</h1>
          <p>
            Street: {street} | Pot: {pot} chips
          </p>
        </header>

        <div className="opponents-row" aria-label="Opponents">
          {opponents.map((opponent) => (
            <article className="seat" key={opponent.id}>
              <h2>{opponent.name}</h2>
              <div className="cards-with-chips">
                <div className="hole-cards hidden-cards" aria-label="Hidden cards">
                  {street === "showdown" && !opponent.folded ? (
                    opponent.cards.map((card, index) => (
                      <span className="playing-card" key={`${opponent.id}-${card}-${index}`}>
                        {card}
                      </span>
                    ))
                  ) : (
                    <>
                      <span className="playing-card back">?</span>
                      <span className="playing-card back">?</span>
                    </>
                  )}
                </div>
                <p className="chip-tag">Chips: {opponent.chips}</p>
              </div>
              {opponent.folded && <p className="status-note">Folded</p>}
              {street === "showdown" && !opponent.folded && showdownHands[opponent.id] && (
                <p className="status-note">{showdownHands[opponent.id]}</p>
              )}
            </article>
          ))}
        </div>

        <div className="board-cards" aria-label="Board cards">
          {visibleBoard.map((card, index) => (
            <span className="playing-card board" key={`${card}-${index}`}>
              {card}
            </span>
          ))}
        </div>

        <section className="user-seat" aria-label="Your cards and controls">
          <h2>You</h2>
          <div className="cards-with-chips">
            <div className="hole-cards">
              {you.cards.map((card, index) => (
                <span className="playing-card" key={`${card}-${index}`}>
                  {card}
                </span>
              ))}
            </div>
            <p className="chip-tag">Chips: {you.chips}</p>
          </div>
          {street === "showdown" && !you.folded && showdownHands[you.id] && (
            <p className="status-note">{showdownHands[you.id]}</p>
          )}

          <div className="action-row">
            <button type="button" className="poker-action fold" onClick={handleFold} disabled={handFinished}>
              Fold
            </button>
            <button type="button" className="poker-action call" onClick={handleCall} disabled={!canCall}>
              {currentBet === 0 ? "Check" : `Call (${currentBet})`}
            </button>
            <button type="button" className="poker-action raise" onClick={handleRaise} disabled={!canRaise}>
              Raise ({raiseToAmount})
            </button>
          </div>

          <p className="status-note">{message}</p>

          {handFinished && (
            <button type="button" className="poker-action new-hand" onClick={startNewHand}>
              Deal New Hand
            </button>
          )}
        </section>
      </section>
    </main>
  );
}
