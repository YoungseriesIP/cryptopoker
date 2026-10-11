import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { PokerTable } from './components/PokerTable';
import { WinnerScreen } from './components/WinnerScreen';
import { ChainGuard } from './components/ChainGuard';
import { usePokerGame } from './hooks/usePokerGame';
import type { PlayerAction } from './types/poker';

type Screen = 'home' | 'lobby' | 'table' | 'winner' | 'history';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  // Track how long we've been waiting for activeTournament to arrive after joining
  const [joiningAt, setJoiningAt] = useState<number | null>(null);
  const [joinTimedOut, setJoinTimedOut] = useState(false);

  const { address, isConnected } = useAccount();
  const {
    status: wsStatus,
    lobby,
    activeTournament,
    myPlayerId,
    myCards,
    error: wsError,
    clearError,
    createTournament,
    joinTournament,
    leaveTournament,
    sendAction,
  } = usePokerGame(address);

  // Show error toasts from WS — only fires when wsError changes
  useEffect(() => {
    if (wsError) {
      toast.error(wsError);
      clearError();
    }
  }, [wsError, clearError]);

  // Once activeTournament arrives, clear the join-pending state (derived, no effect)
  const isPendingJoin = joiningAt !== null && activeTournament === null;

  // Timeout: if no tournament arrives within 8s, mark timed out
  // The effect only sets state via a setTimeout callback, not synchronously — warning is a false positive
  useEffect(() => {
    if (!isPendingJoin) return;
    const id = setTimeout(() => setJoinTimedOut(true), 8000);
    return () => clearTimeout(id);
  }, [isPendingJoin]);
  // Clear timed-out flag when no longer pending (derived reset)
  const timedOut = joinTimedOut && isPendingJoin;

  function handleCreateTournament(buyIn: number, maxPlayers: number) {
    if (!isConnected || !address) {
      toast.error('Connect your wallet first');
      return;
    }
    if (wsStatus !== 'connected') {
      toast.error('Not connected to game server — please wait a moment and try again');
      return;
    }
    createTournament(buyIn, maxPlayers, address);
    setJoiningAt(Date.now());
    setJoinTimedOut(false);
    setScreen('table');
  }

  function handleJoinTournament(tournamentId: string) {
    if (!isConnected || !address) {
      toast.error('Connect your wallet first');
      return;
    }
    if (wsStatus !== 'connected') {
      toast.error('Not connected to game server — please wait a moment and try again');
      return;
    }
    joinTournament(tournamentId, address);
    setJoiningAt(Date.now());
    setJoinTimedOut(false);
    setScreen('table');
  }

  function handleAction(action: PlayerAction, amount?: number) {
    sendAction(action, amount);
  }

  function handleLeaveTable() {
    if (activeTournament && activeTournament.status === 'waiting') {
      leaveTournament(activeTournament.id);
    }
    setJoiningAt(null);
    setJoinTimedOut(false);
    setScreen('lobby');
  }

  // Derive active screen: once tournament completes, show winner screen
  const effectiveScreen: Screen =
    screen === 'table' && activeTournament?.status === 'completed' ? 'winner' : screen;

  // WS status label for the waiting screen
  const wsLabel =
    wsStatus === 'connected' ? 'Connected — waiting for server response…'
    : wsStatus === 'connecting' ? 'Connecting to game server…'
    : wsStatus === 'error' ? 'Connection error — retrying…'
    : 'Reconnecting…';

  return (
    <>
      <ChainGuard />
      {effectiveScreen === 'home' && (
        <HomeScreen
          onPlay={() => {
            if (!isConnected) {
              toast.error('Connect your wallet to play');
              return;
            }
            setScreen('lobby');
          }}
          onHistory={() => setScreen('history')}
        />
      )}

      {effectiveScreen === 'lobby' && (
        <LobbyScreen
          tournaments={lobby}
          wsStatus={wsStatus}
          onBack={() => setScreen('home')}
          onJoin={handleJoinTournament}
          onCreate={handleCreateTournament}
        />
      )}

      {effectiveScreen === 'table' && activeTournament && (
        <PokerTable
          tournament={activeTournament}
          myPlayerId={myPlayerId}
          myCards={myCards}
          connectionStatus={wsStatus}
          onAction={handleAction}
          onLeave={handleLeaveTable}
        />
      )}

      {effectiveScreen === 'table' && !activeTournament && (
        <div
          className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6"
          style={{ background: 'var(--bg-gradient)' }}
        >
          {/* Animated card logo */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'linear-gradient(135deg, #1e4a2e, #2d7a46)',
              border: '1px solid rgba(74,222,128,0.3)',
            }}
          >
            <span style={{ fontSize: 32, animation: timedOut ? 'none' : 'pulse 1.5s ease-in-out infinite' }}>
              {timedOut ? '⚠️' : '♠'}
            </span>
          </div>

          <div className="text-center space-y-2 max-w-xs">
            {timedOut ? (
              <>
                <p className="font-semibold text-base" style={{ color: 'var(--ink)' }}>
                  No response from server
                </p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  The game server didn't confirm your seat. The server may be starting up — try again in a moment.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-base" style={{ color: 'var(--ink)' }}>
                  Joining table…
                </p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {wsLabel}
                </p>
              </>
            )}
          </div>

          {/* WS status pill */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
            style={{
              background: wsStatus === 'connected' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
              border: `1px solid ${wsStatus === 'connected' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color: wsStatus === 'connected' ? 'var(--success)' : 'var(--danger)',
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: wsStatus === 'connected' ? 'var(--success)' : 'var(--danger)',
                display: 'inline-block',
                animation: wsStatus === 'connecting' ? 'pulse 1s ease-in-out infinite' : 'none',
              }}
            />
            {wsStatus === 'connected' ? 'Server connected'
              : wsStatus === 'connecting' ? 'Connecting…'
              : 'Server unreachable'}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleLeaveTable}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
            >
              ← Back to lobby
            </button>
            {timedOut && (
              <button
                onClick={() => {
                  setJoiningAt(null);
                  setJoinTimedOut(false);
                  setScreen('lobby');
                }}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #1e5c38, #2d7a46)',
                  border: '1px solid rgba(74,222,128,0.3)',
                  color: 'white',
                }}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {effectiveScreen === 'winner' && activeTournament && (
        <WinnerScreen
          tournament={activeTournament}
          myPlayerId={myPlayerId}
          onPlayAgain={() => {
            setScreen('lobby');
          }}
          onHome={() => setScreen('home')}
        />
      )}

      {effectiveScreen === 'history' && (
        <div
          className="min-h-dvh flex flex-col"
          style={{ background: 'var(--bg-gradient)' }}
        >
          <header className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setScreen('home')}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}
            >
              ← Back
            </button>
            <h1 className="display font-bold" style={{ color: 'var(--ink)' }}>Game History</h1>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-4xl" style={{ opacity: 0.2 }}>♣</div>
              <p style={{ color: 'var(--muted)' }} className="text-sm">No games yet</p>
              <p style={{ color: 'var(--subtle)' }} className="text-xs">Play a tournament to see your history here.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
