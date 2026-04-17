// Shared Texas Hold'em poker game engine for agent testing
// Contains proper hand rankings and game logic

export const RANK_VALUE = {
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

export function createDeck() {
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

export function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function compareScore(a, b) {
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

export function detectStraight(sortedUniqueValues) {
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

export function evaluateFiveCards(cards) {
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

export function evaluateSevenCards(cards) {
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

export function settleShowdown(activePlayers, boardCards) {
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

  return { winners, winningHandName: bestScore.name };
}
