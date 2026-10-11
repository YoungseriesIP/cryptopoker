import { useState, useEffect, useRef, useCallback } from 'react';
import type { Tournament, WSEvent, LobbyTournament, GameState, Player } from '../types/poker';

// In production VITE_WS_URL points at the deployed backend (wss://…).
// In dev the Vite proxy handles /api/ws → localhost:3001/ws.
const WS_URL: string | null = (import.meta.env.VITE_WS_URL as string | undefined) ?? null;
const WS_PATH = '/api/ws';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UsePokerGameReturn {
  status: ConnectionStatus;
  lobby: LobbyTournament[];
  activeTournament: Tournament | null;
  myPlayerId: string | null;
  myCards: import('../types/poker').Card[];
  createTournament: (buyIn: number, maxPlayers: number, address: string) => void;
  joinTournament: (tournamentId: string, address: string) => void;
  leaveTournament: (tournamentId: string) => void;
  sendAction: (action: import('../types/poker').PlayerAction, amount?: number) => void;
  subscribeToTournament: (tournamentId: string) => void;
  clearError: () => void;
  error: string | null;
}

export function usePokerGame(walletAddress?: string): UsePokerGameReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lobby, setLobby] = useState<LobbyTournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myCards, setMyCards] = useState<import('../types/poker').Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a stable ref to the connect function so reconnect closure is never stale
  const connectRef = useRef<() => void>(() => {});
  // Use a ref for walletAddress to avoid closing over stale value
  const walletAddressRef = useRef(walletAddress);
  useEffect(() => { walletAddressRef.current = walletAddress; }, [walletAddress]);

  const clearError = useCallback(() => setError(null), []);

  const processEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case 'pong':
        break;
      case 'lobby_update':
        setLobby(event.tournaments);
        break;
      case 'player_id':
        setMyPlayerId(event.playerId);
        break;
      case 'tournament_created':
      case 'tournament_update':
        setActiveTournament(event.tournament);
        break;
      case 'game_state_update': {
        const gs: GameState = event.gameState;
        const players: Player[] = event.players;
        setActiveTournament(prev => prev ? { ...prev, gameState: gs, players } : prev);
        break;
      }
      case 'your_cards':
        setMyCards(event.holeCards);
        break;
      case 'hand_complete': {
        const handPlayers: Player[] = event.players;
        setActiveTournament(prev => prev ? { ...prev, players: handPlayers } : prev);
        setMyCards([]);
        break;
      }
      case 'tournament_complete': {
        const w: Player = event.winner;
        const prize: number = event.prizePool;
        setActiveTournament(prev => prev ? {
          ...prev,
          status: 'completed',
          winner: w.id,
          winnerAddress: w.address,
          prizePool: prize,
        } : prev);
        break;
      }
      case 'error':
        setError(event.message);
        break;
    }
  }, []);

  const connect = useCallback(() => {
    // Don't reconnect if already open or connecting
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    // Use explicit backend URL when deployed; fall back to same-host proxy in dev
    const wsUrl = WS_URL ?? (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}${WS_PATH}`;
    })();

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        const addr = walletAddressRef.current;
        if (addr) ws.send(JSON.stringify({ type: 'identify', address: addr }));
        ws.send(JSON.stringify({ type: 'get_lobby' }));
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 25000);
      };

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data as string) as WSEvent;
          processEvent(event);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
        // Use the ref so this closure is never stale
        reconnectTimer.current = setTimeout(() => connectRef.current(), 3000);
      };

      ws.onerror = () => {
        setStatus('error');
        // Don't set a persistent error — the onclose handler will retry
      };
    } catch {
      setStatus('error');
    }
  }, [processEvent]);

  // Keep the ref in sync with the latest connect
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // oxlint-disable-next-line react/set-state-in-effect -- WebSocket lifecycle legitimately uses setState
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
      wsRef.current?.close();
    };
  }, [connect]);

  // Re-identify wallet when address changes while connected
  useEffect(() => {
    if (walletAddress && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'identify', address: walletAddress }));
    }
  }, [walletAddress]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      setError('Not connected to game server');
    }
  }, []);

  return {
    status,
    lobby,
    activeTournament,
    myPlayerId,
    myCards,
    error,
    clearError,
    createTournament: (buyIn, maxPlayers, address) =>
      send({ type: 'create_tournament', buyIn, maxPlayers, address }),
    joinTournament: (tournamentId, address) =>
      send({ type: 'join_tournament', tournamentId, address }),
    leaveTournament: (tournamentId) =>
      send({ type: 'leave_tournament', tournamentId }),
    sendAction: (action, amount) =>
      send({ type: 'player_action', action, amount }),
    subscribeToTournament: (tournamentId) =>
      send({ type: 'subscribe_tournament', tournamentId }),
  };
}
