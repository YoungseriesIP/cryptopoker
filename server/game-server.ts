/**
 * Arc Poker — WebSocket Game Server
 * Handles real-time game state, WebSocket connections, and in-memory sessions.
 * Runs on port 3001, proxied through Vite /api/ws.
 */
import { serve } from 'bun';
import type { ServerWebSocket } from 'bun';
import type {
  Tournament, Player, GameState, Card, LobbyTournament, PlayerAction,
  HandResult
} from '../src/types/poker';
import {
  createDeck, shuffleDeck, evaluateHands,
  STARTING_CHIPS, BLIND_SCHEDULE, BLIND_LEVEL_DURATION_MS
} from '../src/lib/poker-engine';

// ---- Types ----

interface ClientData {
  id: string;
  address?: string;
  tournamentId?: string;
}

type GameWS = ServerWebSocket<ClientData>;

// ---- In-memory state ----
const tournaments = new Map<string, Tournament>();
const clients = new Map<string, GameWS>();

function genId(): string {
  return crypto.randomUUID();
}

function genName(address?: string): string {
  if (!address) return `Player_${Math.floor(Math.random() * 9999)}`;
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}

function toLobbyEntry(t: Tournament): LobbyTournament {
  return {
    id: t.id,
    buyIn: t.buyIn,
    maxPlayers: t.maxPlayers,
    currentPlayers: t.players.length,
    status: t.status,
    prizePool: t.prizePool,
    createdAt: t.createdAt,
  };
}

function broadcastLobby(ws?: GameWS) {
  const list = Array.from(tournaments.values()).map(toLobbyEntry);
  const msg = JSON.stringify({ type: 'lobby_update', tournaments: list });
  if (ws) {
    ws.send(msg);
  } else {
    for (const client of clients.values()) {
      try { client.send(msg); } catch { /* ignore */ }
    }
  }
}

function broadcastTournament(t: Tournament) {
  // Scrub hole cards before broad-sending; send each player their private cards separately
  const scrubbedPlayers = t.players.map(p => ({
    ...p,
    holeCards: p.holeCards.map(() => ({ rank: '2' as const, suit: 'spades' as const, hidden: true })),
  }));
  const msg = JSON.stringify({
    type: 'tournament_update',
    tournament: { ...t, players: scrubbedPlayers },
  });
  for (const p of t.players) {
    const client = clients.get(p.id);
    if (!client) continue;
    try { client.send(msg); } catch { /* ignore */ }
    // Send private hole cards only if player is active/allin and has cards
    if (p.holeCards.length > 0 && p.status !== 'folded') {
      try {
        client.send(JSON.stringify({ type: 'your_cards', tournamentId: t.id, holeCards: p.holeCards }));
      } catch { /* ignore */ }
    }
  }
}

// ---- Poker game logic ----

function makeInitialGameState(players: Player[]): GameState {
  const dealerIdx = Math.floor(Math.random() * players.length);
  // In heads-up: dealer is SB; otherwise dealer+1 is SB
  const isHeadsUp = players.length === 2;
  const sbIdx = isHeadsUp ? dealerIdx : (dealerIdx + 1) % players.length;
  const bbIdx = isHeadsUp ? (dealerIdx + 1) % players.length : (dealerIdx + 2) % players.length;
  // First to act preflop: after BB
  const firstToAct = (bbIdx + 1) % players.length;

  return {
    phase: 'preflop',
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentPlayerIndex: firstToAct,
    currentBet: BLIND_SCHEDULE[0][1],
    minRaise: BLIND_SCHEDULE[0][1] * 2,
    dealerIndex: dealerIdx,
    smallBlindIndex: sbIdx,
    bigBlindIndex: bbIdx,
    turnTimeoutMs: 30000,
    turnStartedAt: Date.now(),
    round: 0,
    blindLevel: 0,
    smallBlind: BLIND_SCHEDULE[0][0],
    bigBlind: BLIND_SCHEDULE[0][1],
    handNumber: 1,
  };
}

function dealHands(players: Player[]): [Player[], Card[]] {
  const deck = shuffleDeck(createDeck());
  const updatedPlayers = players.map(p => ({
    ...p,
    holeCards: deck.splice(0, 2),
    currentBet: 0,
    status: (p.chips > 0 ? 'active' : 'allin') as Player['status'],
  }));
  return [updatedPlayers, deck];
}

function postBlinds(players: Player[], gs: GameState): [Player[], GameState] {
  const updated = [...players];
  const sb = updated[gs.smallBlindIndex];
  const bb = updated[gs.bigBlindIndex];
  const sbBet = Math.min(gs.smallBlind, sb.chips);
  const bbBet = Math.min(gs.bigBlind, bb.chips);
  updated[gs.smallBlindIndex] = {
    ...sb,
    chips: sb.chips - sbBet,
    currentBet: sbBet,
    isSmallBlind: true,
    isBigBlind: false,
    status: sb.chips - sbBet === 0 ? 'allin' : 'active',
  };
  updated[gs.bigBlindIndex] = {
    ...bb,
    chips: bb.chips - bbBet,
    currentBet: bbBet,
    isSmallBlind: false,
    isBigBlind: true,
    status: bb.chips - bbBet === 0 ? 'allin' : 'active',
  };
  return [updated, { ...gs, pot: sbBet + bbBet, currentBet: bbBet }];
}

function startTournament(tournament: Tournament): Tournament {
  const players = tournament.players.map((p, i) => ({
    ...p,
    chips: STARTING_CHIPS,
    position: i,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    status: 'active' as Player['status'],
  }));

  const gs = makeInitialGameState(players);
  const [dealtPlayers, deck] = dealHands(players);
  const [blindedPlayers, gsWithBlinds] = postBlinds(dealtPlayers, gs);

  const t: Tournament = {
    ...tournament,
    status: 'active',
    players: blindedPlayers,
    gameState: {
      ...gsWithBlinds,
      turnStartedAt: Date.now(),
    },
    startedAt: Date.now(),
  };

  (t as Tournament & { _deck: Card[] })._deck = deck;
  return t;
}

function firstActiveAfter(players: Player[], afterIdx: number): number {
  const n = players.length;
  for (let offset = 1; offset < n; offset++) {
    const i = (afterIdx + offset) % n;
    if (players[i].status === 'active') return i;
  }
  // Fallback: any non-folded player
  const fallback = players.findIndex(p => p.status === 'active' || p.status === 'allin');
  return fallback >= 0 ? fallback : 0;
}

function advancePhase(t: Tournament): Tournament {
  const { gameState } = t;
  const deck = (t as Tournament & { _deck?: Card[] })._deck ?? [];

  const nextPhaseMap: Record<string, GameState['phase']> = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
    river: 'showdown',
  };

  const nextPhase = nextPhaseMap[gameState.phase] ?? 'showdown';
  const newCards: Card[] = [];

  if (nextPhase === 'flop') newCards.push(...deck.splice(0, 3));
  else if (nextPhase === 'turn' || nextPhase === 'river') newCards.push(...deck.splice(0, 1));

  const updatedPlayers = t.players.map(p => ({ ...p, currentBet: 0 }));

  // First active player left of dealer (post-flop action starts left of dealer, not left of BB)
  const firstIdx = firstActiveAfter(updatedPlayers, gameState.dealerIndex);

  const newT = {
    ...t,
    players: updatedPlayers,
    gameState: {
      ...gameState,
      phase: nextPhase,
      communityCards: [...gameState.communityCards, ...newCards],
      currentBet: 0,
      minRaise: gameState.bigBlind * 2,
      currentPlayerIndex: firstIdx,
      turnStartedAt: Date.now(),
    },
  };
  // Keep deck reference
  (newT as Tournament & { _deck: Card[] })._deck = deck;
  return newT;
}

function isBettingRoundComplete(players: Player[], currentBet: number): boolean {
  const activePlayers = players.filter(p => p.status === 'active');
  if (activePlayers.length === 0) return true;
  return activePlayers.every(p => p.currentBet === currentBet || p.chips === 0);
}

function checkHandEnd(t: Tournament): { ended: boolean; results?: HandResult[] } {
  const nonFolded = t.players.filter(p => p.status === 'active' || p.status === 'allin');

  // Only one player left (everyone else folded)
  if (nonFolded.length === 1) {
    return {
      ended: true,
      results: [{ winners: [nonFolded[0].id], handName: 'Last player standing', potAmount: t.gameState.pot }],
    };
  }

  // All remaining players are all-in or betting is complete
  const activeBetting = nonFolded.filter(p => p.status === 'active');
  if (activeBetting.length === 0) {
    // All-in showdown — run out remaining streets
    return { ended: false }; // Handled separately by runout
  }

  return { ended: false };
}

function applyHandResults(t: Tournament, results: HandResult[]): Tournament {
  let updatedPlayers = [...t.players];

  for (const result of results) {
    const perWinner = Math.floor(result.potAmount / result.winners.length);
    for (const winnerId of result.winners) {
      updatedPlayers = updatedPlayers.map(p =>
        p.id === winnerId ? { ...p, chips: p.chips + perWinner } : p
      );
    }
  }

  // Broadcast hand_complete with revealed cards
  const msg = JSON.stringify({
    type: 'hand_complete',
    tournamentId: t.id,
    results,
    players: updatedPlayers,
  });
  for (const p of t.players) {
    try { clients.get(p.id)?.send(msg); } catch { /* ignore */ }
  }

  // Check tournament winner
  const playersWithChips = updatedPlayers.filter(p => p.chips > 0);
  if (playersWithChips.length === 1) {
    const winner = playersWithChips[0];
    const completedMsg = JSON.stringify({
      type: 'tournament_complete',
      tournamentId: t.id,
      winner,
      prizePool: t.prizePool,
    });
    for (const p of t.players) {
      try { clients.get(p.id)?.send(completedMsg); } catch { /* ignore */ }
    }
    return { ...t, players: updatedPlayers, status: 'completed', winner: winner.id, winnerAddress: winner.address };
  }

  // Start next hand after a short delay
  setTimeout(() => {
    const stored = tournaments.get(t.id);
    if (!stored || stored.status !== 'active') return;
    const newT = startNewHand(stored);
    tournaments.set(t.id, newT);
    broadcastTournament(newT);
    broadcastLobby();
  }, 4000);

  return { ...t, players: updatedPlayers };
}

function startNewHand(t: Tournament): Tournament {
  const activePlayers = t.players.filter(p => p.chips > 0);
  if (activePlayers.length < 2) return t;

  // Rotate dealer among players with chips
  const prevDealerPos = t.gameState.dealerIndex % activePlayers.length;
  const newDealer = (prevDealerPos + 1) % activePlayers.length;

  const isHeadsUp = activePlayers.length === 2;
  const sbIdx = isHeadsUp ? newDealer : (newDealer + 1) % activePlayers.length;
  const bbIdx = isHeadsUp ? (newDealer + 1) % activePlayers.length : (newDealer + 2) % activePlayers.length;
  const firstToAct = (bbIdx + 1) % activePlayers.length;

  // Determine blind level based on time elapsed
  const elapsed = Date.now() - (t.startedAt ?? Date.now());
  const blindLevel = Math.min(Math.floor(elapsed / BLIND_LEVEL_DURATION_MS), BLIND_SCHEDULE.length - 1);
  const [smallBlind, bigBlind] = BLIND_SCHEDULE[blindLevel];

  const players = activePlayers.map((p, i) => ({
    ...p,
    position: i,
    isDealer: i === newDealer,
    isSmallBlind: false,
    isBigBlind: false,
    status: 'active' as Player['status'],
    currentBet: 0,
    holeCards: [] as Card[],
  }));

  const gs: GameState = {
    phase: 'preflop',
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentPlayerIndex: firstToAct,
    currentBet: bigBlind,
    minRaise: bigBlind * 2,
    dealerIndex: newDealer,
    smallBlindIndex: sbIdx,
    bigBlindIndex: bbIdx,
    turnTimeoutMs: 30000,
    turnStartedAt: Date.now(),
    round: t.gameState.round + 1,
    blindLevel,
    smallBlind,
    bigBlind,
    handNumber: t.gameState.handNumber + 1,
  };

  const [dealtPlayers, deck] = dealHands(players);
  const [blindedPlayers, gsWithBlinds] = postBlinds(dealtPlayers, gs);

  const newT = {
    ...t,
    players: blindedPlayers,
    gameState: { ...gsWithBlinds, turnStartedAt: Date.now() },
  };
  (newT as Tournament & { _deck: Card[] })._deck = deck;
  return newT;
}

/**
 * Run out remaining community cards and go to showdown when all remaining
 * active players are all-in (no more betting decisions needed).
 */
function maybeRunout(t: Tournament): Tournament {
  const nonFolded = t.players.filter(p => p.status === 'active' || p.status === 'allin');
  const activeBetting = nonFolded.filter(p => p.status === 'active');

  if (activeBetting.length <= 1 && nonFolded.length > 1) {
    // Run remaining streets automatically
    let current = t;
    while (
      current.gameState.phase !== 'showdown' &&
      current.gameState.phase !== 'waiting' &&
      current.gameState.communityCards.length < 5
    ) {
      current = advancePhase(current);
    }
    // Evaluate at showdown
    const results = evaluateHands(
      current.players.filter(p => p.status === 'active' || p.status === 'allin'),
      current.gameState.communityCards,
      current.gameState.pot,
      current.gameState.sidePots,
    );
    return applyHandResults(current, results);
  }
  return t;
}

function handlePlayerAction(t: Tournament, playerId: string, action: PlayerAction, amount?: number): Tournament {
  const playerIdx = t.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return t;
  if (playerIdx !== t.gameState.currentPlayerIndex) return t;

  const player = t.players[playerIdx];
  // Can't act if already folded/allin
  if (player.status === 'folded' || player.status === 'allin') return t;

  let updatedPlayers = [...t.players];
  let { pot, currentBet, minRaise } = t.gameState;

  switch (action) {
    case 'fold': {
      updatedPlayers[playerIdx] = { ...player, status: 'folded' };
      break;
    }
    case 'check': {
      // Can only check if no outstanding bet
      if (player.currentBet < currentBet) return t;
      break;
    }
    case 'call': {
      const toCall = Math.min(currentBet - player.currentBet, player.chips);
      updatedPlayers[playerIdx] = {
        ...player,
        chips: player.chips - toCall,
        currentBet: player.currentBet + toCall,
        status: player.chips - toCall === 0 ? 'allin' : 'active',
      };
      pot += toCall;
      break;
    }
    case 'bet':
    case 'raise': {
      const requestedTotal = amount ?? minRaise;
      // Total bet must be at least minRaise (or all-in)
      const totalBet = Math.min(Math.max(requestedTotal, minRaise), player.chips + player.currentBet);
      const toPay = Math.min(totalBet - player.currentBet, player.chips);
      const newCurrentBet = Math.max(currentBet, totalBet);
      // Next min raise is the size of this raise on top
      minRaise = newCurrentBet + (newCurrentBet - currentBet);
      updatedPlayers[playerIdx] = {
        ...player,
        chips: player.chips - toPay,
        currentBet: player.currentBet + toPay,
        status: player.chips - toPay === 0 ? 'allin' : 'active',
      };
      pot += toPay;
      currentBet = newCurrentBet;
      break;
    }
    case 'allin': {
      const allIn = player.chips;
      const newTotal = player.currentBet + allIn;
      updatedPlayers[playerIdx] = {
        ...player,
        chips: 0,
        currentBet: newTotal,
        status: 'allin',
      };
      pot += allIn;
      if (newTotal > currentBet) {
        minRaise = Math.max(minRaise, newTotal + (newTotal - currentBet));
        currentBet = newTotal;
      }
      break;
    }
  }

  // Find next player who can act (active, not folded/allin)
  let nextIdx = (playerIdx + 1) % updatedPlayers.length;
  let attempts = 0;
  while (
    (updatedPlayers[nextIdx].status === 'folded' || updatedPlayers[nextIdx].status === 'allin' ||
     updatedPlayers[nextIdx].status === 'disconnected') &&
    attempts < updatedPlayers.length
  ) {
    nextIdx = (nextIdx + 1) % updatedPlayers.length;
    attempts++;
  }

  const updatedT: Tournament = {
    ...t,
    players: updatedPlayers,
    gameState: {
      ...t.gameState,
      pot,
      currentBet,
      minRaise,
      currentPlayerIndex: nextIdx,
      turnStartedAt: Date.now(),
    },
  };
  // Keep deck reference
  const deck = (t as Tournament & { _deck?: Card[] })._deck;
  if (deck) (updatedT as Tournament & { _deck: Card[] })._deck = deck;

  // Check if only one non-folded player remains
  const { ended: foldEnded, results: foldResults } = checkHandEnd(updatedT);
  if (foldEnded && foldResults) {
    return applyHandResults(updatedT, foldResults);
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(updatedPlayers, currentBet)) {
    // All-in runout: if <=1 active player, run remaining cards
    const runout = maybeRunout(updatedT);
    if (runout !== updatedT) return runout;

    // Phase transition
    if (updatedT.gameState.phase === 'river') {
      const results = evaluateHands(
        updatedPlayers.filter(p => p.status === 'active' || p.status === 'allin'),
        updatedT.gameState.communityCards,
        pot,
        updatedT.gameState.sidePots,
      );
      return applyHandResults(updatedT, results);
    }
    return advancePhase(updatedT);
  }

  return updatedT;
}

// ---- Turn timeout: auto-fold disconnected or timed-out players ----
setInterval(() => {
  for (const [id, t] of tournaments.entries()) {
    if (t.status !== 'active' || t.gameState.phase === 'waiting') continue;
    const currentPlayer = t.players[t.gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.status !== 'active') continue;

    const elapsed = Date.now() - t.gameState.turnStartedAt;
    const isDisconnected = currentPlayer.status === 'disconnected' ||
      !clients.has(currentPlayer.id);
    const isTimedOut = elapsed > t.gameState.turnTimeoutMs;

    if (isDisconnected || isTimedOut) {
      const updated = handlePlayerAction(t, currentPlayer.id, 'fold');
      tournaments.set(id, updated);
      broadcastTournament(updated);
    }
  }
}, 2000);

// ---- WebSocket handler ----
const PORT = Number(process.env.PORT ?? 3001);
const server = serve<ClientData>({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, { data: { id: genId() } });
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, tournaments: tournaments.size, clients: clients.size }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Arc Poker Game Server', { status: 200 });
  },
  websocket: {
    open(ws) {
      clients.set(ws.data.id, ws);
      ws.send(JSON.stringify({ type: 'player_id', playerId: ws.data.id }));
      broadcastLobby(ws);
    },

    message(ws, raw) {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw as string);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'identify': {
          const address = msg.address as string | undefined;
          if (address) {
            ws.data.address = address;
            // Update player name in any active tournament
            if (ws.data.tournamentId) {
              const t = tournaments.get(ws.data.tournamentId);
              if (t) {
                const updated = {
                  ...t,
                  players: t.players.map(p =>
                    p.id === ws.data.id ? { ...p, address, name: genName(address) } : p
                  ),
                };
                tournaments.set(t.id, updated);
              }
            }
          }
          break;
        }

        case 'get_lobby':
          broadcastLobby(ws);
          break;

        case 'create_tournament': {
          const buyIn = Number(msg.buyIn ?? 5);
          const maxPlayers = Math.min(9, Math.max(2, Number(msg.maxPlayers ?? 6)));
          const tid = genId();
          const player: Player = {
            id: ws.data.id,
            address: ws.data.address ?? '',
            name: genName(ws.data.address),
            chips: STARTING_CHIPS,
            status: 'waiting',
            position: 0,
            isDealer: false,
            isBigBlind: false,
            isSmallBlind: false,
            currentBet: 0,
            holeCards: [],
            avatarSeed: ws.data.id,
          };
          const t: Tournament = {
            id: tid,
            buyIn,
            maxPlayers,
            players: [player],
            status: 'waiting',
            gameState: {
              phase: 'waiting',
              communityCards: [],
              pot: 0,
              sidePots: [],
              currentPlayerIndex: 0,
              currentBet: 0,
              minRaise: 0,
              dealerIndex: 0,
              smallBlindIndex: 1,
              bigBlindIndex: 2,
              turnTimeoutMs: 30000,
              turnStartedAt: 0,
              round: 0,
              blindLevel: 0,
              smallBlind: BLIND_SCHEDULE[0][0],
              bigBlind: BLIND_SCHEDULE[0][1],
              handNumber: 0,
            },
            prizePool: buyIn,
            createdAt: Date.now(),
          };
          tournaments.set(tid, t);
          ws.data.tournamentId = tid;
          ws.send(JSON.stringify({ type: 'tournament_update', tournament: t }));
          broadcastLobby();
          break;
        }

        case 'join_tournament': {
          const tid = msg.tournamentId as string;
          const t = tournaments.get(tid);
          if (!t) {
            ws.send(JSON.stringify({ type: 'error', message: 'Tournament not found' }));
            break;
          }
          if (t.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: 'Tournament already started' }));
            break;
          }
          if (t.players.length >= t.maxPlayers) {
            ws.send(JSON.stringify({ type: 'error', message: 'Table is full' }));
            break;
          }
          if (t.players.find(p => p.id === ws.data.id)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Already in tournament' }));
            break;
          }
          const newPlayer: Player = {
            id: ws.data.id,
            address: ws.data.address ?? '',
            name: genName(ws.data.address),
            chips: STARTING_CHIPS,
            status: 'waiting',
            position: t.players.length,
            isDealer: false,
            isBigBlind: false,
            isSmallBlind: false,
            currentBet: 0,
            holeCards: [],
            avatarSeed: ws.data.id,
          };
          const updated = {
            ...t,
            players: [...t.players, newPlayer],
            prizePool: t.prizePool + t.buyIn,
          };

          // Start when full
          const finalT = updated.players.length >= updated.maxPlayers
            ? startTournament(updated)
            : updated;

          tournaments.set(tid, finalT);
          ws.data.tournamentId = tid;
          broadcastTournament(finalT);
          broadcastLobby();
          break;
        }

        case 'leave_tournament': {
          const tid = ws.data.tournamentId ?? msg.tournamentId as string;
          const t = tournaments.get(tid);
          if (!t || t.status === 'active') break;
          const updated = {
            ...t,
            players: t.players.filter(p => p.id !== ws.data.id),
            prizePool: Math.max(0, t.prizePool - t.buyIn),
          };
          if (updated.players.length === 0) {
            tournaments.delete(tid);
          } else {
            tournaments.set(tid, updated);
          }
          ws.data.tournamentId = undefined;
          broadcastLobby();
          break;
        }

        case 'player_action': {
          const tid = ws.data.tournamentId;
          if (!tid) break;
          const t = tournaments.get(tid);
          if (!t || t.status !== 'active') break;
          const action = msg.action as PlayerAction;
          const amount = msg.amount !== undefined ? Number(msg.amount) : undefined;
          const updated = handlePlayerAction(t, ws.data.id, action, amount);
          tournaments.set(tid, updated);
          broadcastTournament(updated);
          break;
        }

        case 'subscribe_tournament': {
          const tid = msg.tournamentId as string;
          const t = tournaments.get(tid);
          if (t) {
            ws.data.tournamentId = tid;
            ws.send(JSON.stringify({ type: 'tournament_update', tournament: t }));
          }
          break;
        }
      }
    },

    close(ws) {
      clients.delete(ws.data.id);
      // Mark player as disconnected in active tournament
      // The turn-timeout interval will auto-fold them if it's their turn
      if (ws.data.tournamentId) {
        const t = tournaments.get(ws.data.tournamentId);
        if (t?.status === 'active') {
          const updated = {
            ...t,
            players: t.players.map(p =>
              p.id === ws.data.id ? { ...p, status: 'disconnected' as Player['status'] } : p
            ),
          };
          // Carry over deck
          const deck = (t as Tournament & { _deck?: Card[] })._deck;
          if (deck) (updated as Tournament & { _deck: Card[] })._deck = deck;
          tournaments.set(ws.data.tournamentId, updated);
          broadcastTournament(updated);
        }
      }
    },
  },
});

console.log(`Arc Poker game server running on port ${server.port}`);
