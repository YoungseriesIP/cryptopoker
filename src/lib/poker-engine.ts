// Poker hand evaluation and game engine utilities
import type { Card, Rank, Suit, HandResult, Player } from '../types/poker';

const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS: Suit[] = ['hearts','diamonds','clubs','spades'];

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates shuffle with crypto randomness
export function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck];
  const randomValues = new Uint32Array(arr.length);
  crypto.getRandomValues(randomValues);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getSuitSymbol(suit: Suit): string {
  return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit];
}

export function getSuitColor(suit: Suit): 'red' | 'black' {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

type HandRank = {
  rank: number;
  name: string;
  tiebreakers: number[];
};

function rankHand(cards: Card[]): HandRank {
  const ranks = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const rankCounts: Record<number, number> = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;

  const countGroups = Object.entries(rankCounts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(ranks);
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

  if (isFlush && isStraight) {
    const high = ranks[0];
    return { rank: high === 14 && ranks[4] === 10 ? 9 : 8, name: high === 14 && ranks[4] === 10 ? 'Royal Flush' : 'Straight Flush', tiebreakers: ranks };
  }
  if (countGroups[0].count === 4) {
    return { rank: 7, name: 'Four of a Kind', tiebreakers: [countGroups[0].rank, countGroups[1].rank] };
  }
  if (countGroups[0].count === 3 && countGroups[1].count === 2) {
    return { rank: 6, name: 'Full House', tiebreakers: [countGroups[0].rank, countGroups[1].rank] };
  }
  if (isFlush) {
    return { rank: 5, name: 'Flush', tiebreakers: ranks };
  }
  if (isStraight) {
    return { rank: 4, name: 'Straight', tiebreakers: ranks };
  }
  if (countGroups[0].count === 3) {
    return { rank: 3, name: 'Three of a Kind', tiebreakers: [countGroups[0].rank, ...uniqueRanks.filter(r => r !== countGroups[0].rank)] };
  }
  if (countGroups[0].count === 2 && countGroups[1].count === 2) {
    const pairs = [countGroups[0].rank, countGroups[1].rank].sort((a, b) => b - a);
    const kicker = uniqueRanks.find(r => r !== pairs[0] && r !== pairs[1])!;
    return { rank: 2, name: 'Two Pair', tiebreakers: [...pairs, kicker] };
  }
  if (countGroups[0].count === 2) {
    return { rank: 1, name: 'One Pair', tiebreakers: [countGroups[0].rank, ...uniqueRanks.filter(r => r !== countGroups[0].rank)] };
  }
  return { rank: 0, name: 'High Card', tiebreakers: ranks };
}

function checkStraight(sortedRanks: number[]): boolean {
  const unique = [...new Set(sortedRanks)];
  if (unique.length < 5) return false;
  // Normal straight
  if (unique[0] - unique[4] === 4) return true;
  // Wheel: A-2-3-4-5
  if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) return true;
  return false;
}

function getBestHand(holeCards: Card[], communityCards: Card[]): HandRank & { cards: Card[] } {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return { rank: -1, name: 'Not enough cards', tiebreakers: [], cards: [] };

  let best: (HandRank & { cards: Card[] }) | null = null;

  // Try all C(n,5) combinations
  const combos = combinations(allCards, 5);
  for (const combo of combos) {
    const h = rankHand(combo);
    if (!best || compareHands(h, best) > 0) {
      best = { ...h, cards: combo };
    }
  }
  return best!;
}

function compareHands(a: HandRank, b: HandRank): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function recurse(start: number, current: T[]) {
    if (current.length === k) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      recurse(i + 1, current);
      current.pop();
    }
  }
  recurse(0, []);
  return result;
}

export function evaluateHands(
  activePlayers: Player[],
  communityCards: Card[],
  pot: number,
  sidePots: { amount: number; eligiblePlayers: string[] }[]
): HandResult[] {
  const results: HandResult[] = [];

  // Evaluate each player's best hand
  const playerHands = activePlayers.map(p => ({
    player: p,
    best: getBestHand(p.holeCards, communityCards),
  }));

  if (sidePots.length > 0) {
    for (const sidePot of sidePots) {
      const eligible = playerHands.filter(ph => sidePot.eligiblePlayers.includes(ph.player.id));
      if (eligible.length === 0) continue;
      const winners = findWinners(eligible);
      results.push({
        winners: winners.map(w => w.player.id),
        handName: winners[0].best.name,
        potAmount: Math.floor(sidePot.amount / winners.length) * winners.length,
        isSidePot: true,
      });
    }
  } else {
    const winners = findWinners(playerHands);
    results.push({
      winners: winners.map(w => w.player.id),
      handName: winners[0].best.name,
      potAmount: pot,
    });
  }

  return results;
}

function findWinners(playerHands: { player: Player; best: HandRank & { cards: Card[] } }[]) {
  return playerHands.reduce((winners, curr) => {
    if (winners.length === 0) return [curr];
    const cmp = compareHands(curr.best, winners[0].best);
    if (cmp > 0) return [curr];
    if (cmp === 0) return [...winners, curr];
    return winners;
  }, [] as typeof playerHands);
}

// Blind schedule: [smallBlind, bigBlind] indexed by level
export const BLIND_SCHEDULE: [number, number][] = [
  [10, 20],
  [15, 30],
  [25, 50],
  [50, 100],
  [75, 150],
  [100, 200],
  [150, 300],
  [200, 400],
  [300, 600],
  [500, 1000],
];

export const STARTING_CHIPS = 1000;
export const BLIND_LEVEL_DURATION_MS = 5 * 60 * 1000; // 5 minutes per level

export { getBestHand, compareHands };
