// Poker game types

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  hidden?: boolean;
}

export type PlayerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
export type PlayerStatus = 'waiting' | 'active' | 'folded' | 'allin' | 'sitting_out' | 'disconnected';
export type TournamentStatus = 'waiting' | 'starting' | 'active' | 'completed' | 'cancelled';
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface Player {
  id: string;
  address: string;
  name: string;
  chips: number;          // tournament chips (not USDC)
  status: PlayerStatus;
  position: number;       // seat 0-8
  isDealer: boolean;
  isBigBlind: boolean;
  isSmallBlind: boolean;
  currentBet: number;
  holeCards: Card[];
  avatarSeed: string;
}

export interface SidePot {
  amount: number;
  eligiblePlayers: string[];  // player ids
}

export interface GameState {
  phase: GamePhase;
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  currentPlayerIndex: number;
  currentBet: number;
  minRaise: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  turnTimeoutMs: number;
  turnStartedAt: number;
  round: number;
  blindLevel: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
}

export interface Tournament {
  id: string;
  contractTournamentId?: bigint;
  buyIn: number;       // USDC amount (e.g. 5 = 5 USDC)
  maxPlayers: number;
  players: Player[];
  status: TournamentStatus;
  gameState: GameState;
  prizePool: number;   // USDC
  winner?: string;     // player id
  winnerAddress?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  settlementTxHash?: string;
}

export interface HandResult {
  winners: string[];      // player ids
  handName: string;
  potAmount: number;
  isSidePot?: boolean;
}

// WebSocket event types
export type WSEvent =
  | { type: 'tournament_created'; tournament: Tournament }
  | { type: 'tournament_update'; tournament: Tournament }
  | { type: 'player_joined'; tournamentId: string; player: Player }
  | { type: 'player_left'; tournamentId: string; playerId: string }
  | { type: 'tournament_started'; tournamentId: string; gameState: GameState; players: Player[] }
  | { type: 'game_state_update'; tournamentId: string; gameState: GameState; players: Player[] }
  | { type: 'player_action'; tournamentId: string; playerId: string; action: PlayerAction; amount?: number }
  | { type: 'hand_complete'; tournamentId: string; results: HandResult[]; players: Player[] }
  | { type: 'tournament_complete'; tournamentId: string; winner: Player; prizePool: number }
  | { type: 'your_cards'; tournamentId: string; holeCards: Card[] }
  | { type: 'lobby_update'; tournaments: LobbyTournament[] }
  | { type: 'player_id'; playerId: string }
  | { type: 'error'; message: string }
  | { type: 'ping' }
  | { type: 'pong' };

export interface LobbyTournament {
  id: string;
  buyIn: number;
  maxPlayers: number;
  currentPlayers: number;
  status: TournamentStatus;
  prizePool: number;
  createdAt: number;
}
