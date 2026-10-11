import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
import { TokenUSDC } from '@web3icons/react';
import type { Tournament, Player, PlayerAction } from '../types/poker';
import { PlayingCard, CardPlaceholder } from './PlayingCard';
import { PlayerAvatar } from './PlayerAvatar';
import { PotDisplay } from './ChipDisplay';

interface PokerTableProps {
  tournament: Tournament;
  myPlayerId: string | null;
  myCards: import('../types/poker').Card[];
  connectionStatus: string;
  onAction: (action: PlayerAction, amount?: number) => void;
  onLeave: () => void;
}

// ─── Turn Timer ─────────────────────────────────────────────────────────────

function TurnTimer({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const [elapsed, setElapsed] = useState(0);

  // oxlint-disable-next-line react/set-state-in-effect -- interval timer legitimately drives elapsed state
  useEffect(() => {
    setElapsed(Date.now() - startedAt);
    const interval = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(interval);
  }, [startedAt]);

  const remaining = Math.max(0, durationMs - elapsed);
  const pct = remaining / durationMs;
  const secs = Math.ceil(remaining / 1000);
  const isUrgent = secs <= 10;

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          border: `2px solid ${isUrgent ? '#f87171' : '#5fbeff'}`,
          background: isUrgent ? 'rgba(248,113,113,0.1)' : 'rgba(95,190,255,0.1)',
        }}
      >
        <span className="display font-bold text-xs tabular-nums" style={{ color: isUrgent ? '#f87171' : '#5fbeff' }}>
          {secs}
        </span>
      </div>
      {/* Progress bar */}
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)', minWidth: 40 }}>
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: isUrgent ? '#f87171' : '#5fbeff',
            transition: 'width 0.2s linear',
          }}
        />
      </div>
    </div>
  );
}

// ─── Desktop oval seat ───────────────────────────────────────────────────────

function PlayerSeatOval({ player, isMe, isCurrentTurn, myCards, gamePhase }: {
  player: Player;
  isMe: boolean;
  isCurrentTurn: boolean;
  myCards: import('../types/poker').Card[];
  gamePhase: string;
}) {
  const isFolded = player.status === 'folded';
  const cards = isMe && myCards.length > 0 ? myCards : player.holeCards;

  return (
    <div className="flex flex-col items-center gap-1">
      {gamePhase !== 'waiting' && (
        <div className="flex gap-0.5">
          {cards.length > 0
            ? cards.map((card, i) => (
              <PlayingCard key={i} card={isMe ? card : undefined} hidden={!isMe} size="sm" delay={i * 0.1} />
            ))
            : isFolded ? null : (
              <>
                <CardPlaceholder size="sm" />
                <CardPlaceholder size="sm" />
              </>
            )}
        </div>
      )}
      <PlayerAvatar seed={player.avatarSeed} name={player.name} size={34} isActive={isCurrentTurn} isDealer={player.isDealer} isFolded={isFolded} />
      <div className="text-center">
        <div className="text-xs font-semibold truncate max-w-14" style={{ color: isMe ? 'var(--accent)' : isFolded ? 'var(--subtle)' : 'var(--ink)' }}>
          {isMe ? 'You' : player.name}
        </div>
        <div className="text-xs tabular-nums" style={{ color: isFolded ? 'var(--subtle)' : 'var(--gold)' }}>
          {new Intl.NumberFormat('en-US').format(player.chips)}
        </div>
      </div>
      {(player.isSmallBlind || player.isBigBlind) && (
        <div className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{
          background: player.isBigBlind ? 'rgba(245,200,66,0.15)' : 'rgba(95,190,255,0.15)',
          color: player.isBigBlind ? '#f5c842' : '#5fbeff', fontSize: 9,
        }}>
          {player.isBigBlind ? 'BB' : 'SB'}
        </div>
      )}
      {player.currentBet > 0 && (
        <div className="text-xs tabular-nums font-semibold px-2 py-0.5 rounded-full" style={{
          background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.2)', color: '#f5c842',
        }}>
          {new Intl.NumberFormat('en-US').format(player.currentBet)}
        </div>
      )}
    </div>
  );
}

// ─── Mobile player row ───────────────────────────────────────────────────────

function PlayerRow({ player, isMe, isCurrentTurn, myCards, gamePhase }: {
  player: Player;
  isMe: boolean;
  isCurrentTurn: boolean;
  myCards: import('../types/poker').Card[];
  gamePhase: string;
}) {
  const isFolded = player.status === 'folded';
  const cards = isMe && myCards.length > 0 ? myCards : player.holeCards;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        background: isCurrentTurn
          ? 'rgba(95,190,255,0.08)'
          : isMe
          ? 'rgba(74,222,128,0.06)'
          : 'rgba(255,255,255,0.03)',
        border: isCurrentTurn
          ? '1px solid rgba(95,190,255,0.3)'
          : isMe
          ? '1px solid rgba(74,222,128,0.15)'
          : '1px solid rgba(255,255,255,0.06)',
        opacity: isFolded ? 0.45 : 1,
      }}
    >
      <PlayerAvatar seed={player.avatarSeed} name={player.name} size={32} isActive={isCurrentTurn} isDealer={player.isDealer} isFolded={isFolded} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate" style={{ color: isMe ? 'var(--accent)' : isFolded ? 'var(--subtle)' : 'var(--ink)' }}>
            {isMe ? 'You' : player.name}
          </span>
          {player.isDealer && (
            <span className="text-xs px-1 rounded font-bold" style={{ background: '#f5c842', color: '#0a1628', fontSize: 9 }}>D</span>
          )}
          {player.isSmallBlind && (
            <span className="text-xs px-1 rounded font-bold" style={{ background: 'rgba(95,190,255,0.2)', color: '#5fbeff', fontSize: 9 }}>SB</span>
          )}
          {player.isBigBlind && (
            <span className="text-xs px-1 rounded font-bold" style={{ background: 'rgba(245,200,66,0.2)', color: '#f5c842', fontSize: 9 }}>BB</span>
          )}
          {isFolded && (
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>folded</span>
          )}
          {player.status === 'allin' && (
            <span className="text-xs font-semibold" style={{ color: '#f87171' }}>all-in</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs tabular-nums font-semibold" style={{ color: 'var(--gold)' }}>
            {new Intl.NumberFormat('en-US').format(player.chips)} chips
          </span>
          {player.currentBet > 0 && (
            <span className="text-xs tabular-nums" style={{ color: '#f5c842' }}>
              bet: {new Intl.NumberFormat('en-US').format(player.currentBet)}
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      {gamePhase !== 'waiting' && (
        <div className="flex gap-0.5 flex-shrink-0">
          {cards.length > 0
            ? cards.map((card, i) => (
              <PlayingCard key={i} card={isMe ? card : undefined} hidden={!isMe} size="sm" delay={i * 0.08} />
            ))
            : isFolded ? (
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>—</span>
            ) : (
              <>
                <CardPlaceholder size="sm" />
                <CardPlaceholder size="sm" />
              </>
            )}
        </div>
      )}
    </div>
  );
}

// ─── Oval seat positions ─────────────────────────────────────────────────────

const SEAT_POSITIONS = [
  { x: 50, y: 90 },   // bottom center
  { x: 80, y: 80 },   // bottom right
  { x: 95, y: 52 },   // right
  { x: 80, y: 16 },   // top right
  { x: 50, y: 6 },    // top center
  { x: 20, y: 16 },   // top left
  { x: 5,  y: 52 },   // left
  { x: 20, y: 80 },   // bottom left
  { x: 35, y: 90 },   // bottom center-left
];

// ─── Main component ──────────────────────────────────────────────────────────

export function PokerTable({ tournament, myPlayerId, myCards, connectionStatus, onAction, onLeave }: PokerTableProps) {
  const [showBetInput, setShowBetInput] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);

  const { gameState, players } = tournament;
  const myPlayer = players.find(p => p.id === myPlayerId);
  const isMyTurn = myPlayerId !== null && players[gameState.currentPlayerIndex]?.id === myPlayerId;
  const canCheck = isMyTurn && gameState.currentBet === (myPlayer?.currentBet ?? 0);
  const callAmount = isMyTurn
    ? Math.min(gameState.currentBet - (myPlayer?.currentBet ?? 0), myPlayer?.chips ?? 0)
    : 0;
  const minBet = Math.max(gameState.minRaise || gameState.bigBlind * 2, gameState.bigBlind * 2);

  // Reset bet amount on new hand (derived state, no effect needed)
  const [betHandNumber, setBetHandNumber] = useState(gameState.handNumber);
  const [betAmount, setBetAmount] = useState(minBet);
  if (gameState.handNumber !== betHandNumber) {
    setBetHandNumber(gameState.handNumber);
    setBetAmount(minBet);
  }

  function handleBet() {
    if (betAmount > 0) {
      onAction('bet', betAmount);
      setShowBetInput(false);
    }
  }

  const phaseLabels: Record<string, string> = {
    waiting: 'Waiting for players',
    preflop: 'Pre-Flop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown',
  };

  // ── Action bar shared by both layouts ──────────────────────────────────────

  const actionBar = myPlayer && gameState.phase !== 'waiting' && gameState.phase !== 'showdown' ? (
    <div
      className="relative z-10 px-3 py-3 space-y-2.5"
      style={{ background: 'rgba(10,22,40,0.97)', borderTop: '1px solid var(--border)' }}
    >
      {isMyTurn ? (
        <>
          {isMyTurn && gameState.turnStartedAt > 0 && (
            <TurnTimer startedAt={gameState.turnStartedAt} durationMs={gameState.turnTimeoutMs} />
          )}

          {/* Bet slider */}
          <AnimatePresence>
            {showBetInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={minBet}
                    max={myPlayer.chips + (myPlayer.currentBet ?? 0)}
                    step={gameState.bigBlind}
                    value={betAmount}
                    onChange={e => setBetAmount(Number(e.target.value))}
                    className="flex-1 accent-green-400"
                  />
                  <span className="display font-bold tabular-nums text-sm w-20 text-right" style={{ color: 'var(--gold)' }}>
                    {new Intl.NumberFormat('en-US').format(betAmount)}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 'All-in'].map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        if (m === 'All-in') {
                          setBetAmount(myPlayer.chips + (myPlayer.currentBet ?? 0));
                        } else {
                          const target = Number(m) * gameState.bigBlind;
                          setBetAmount(Math.min(Math.max(target, minBet), myPlayer.chips + (myPlayer.currentBet ?? 0)));
                        }
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      {m === 'All-in' ? 'All-in' : `${m}×BB`}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onAction('fold')}
              className="flex-1 py-3.5 rounded-xl font-semibold text-sm"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
            >
              Fold
            </button>

            {canCheck ? (
              <button
                onClick={() => onAction('check')}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              >
                Check
              </button>
            ) : (
              <button
                onClick={() => onAction('call', callAmount)}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm"
                style={{ background: 'rgba(95,190,255,0.12)', border: '1px solid rgba(95,190,255,0.25)', color: '#5fbeff' }}
              >
                Call {new Intl.NumberFormat('en-US').format(callAmount)}
              </button>
            )}

            <button
              onClick={() => {
                if (showBetInput) handleBet();
                else setShowBetInput(true);
              }}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #1e5c38, #2d7a46)', border: '1px solid rgba(74,222,128,0.3)', color: 'white' }}
            >
              {showBetInput ? (gameState.currentBet > 0 ? 'Raise ✓' : 'Bet ✓') : (gameState.currentBet > 0 ? 'Raise' : 'Bet')}
            </button>
          </div>

          {/* Stack / pot info */}
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
            <span>
              Stack:{' '}
              <span className="tabular-nums font-semibold" style={{ color: 'var(--gold)' }}>
                {new Intl.NumberFormat('en-US').format(myPlayer.chips)}
              </span>
            </span>
            <span>
              Pot:{' '}
              <span className="tabular-nums font-semibold" style={{ color: 'var(--gold)' }}>
                {new Intl.NumberFormat('en-US').format(gameState.pot)}
              </span>
            </span>
          </div>
        </>
      ) : (
        <div className="py-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
          {players[gameState.currentPlayerIndex]
            ? `Waiting for ${players[gameState.currentPlayerIndex].id === myPlayerId ? 'you' : players[gameState.currentPlayerIndex].name}…`
            : 'Waiting for next hand…'}
        </div>
      )}
    </div>
  ) : null;

  // ── Waiting bar ─────────────────────────────────────────────────────────────

  const waitingBar = gameState.phase === 'waiting' ? (
    <div
      className="relative z-10 px-4 py-5 text-center space-y-2"
      style={{ background: 'rgba(10,22,40,0.9)', borderTop: '1px solid var(--border)' }}
    >
      <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
        Waiting for players ({players.length}/{tournament.maxPlayers})
      </p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {tournament.maxPlayers - players.length} more needed to start
      </p>
      <div className="flex gap-1 justify-center pt-1">
        {Array.from({ length: tournament.maxPlayers }, (_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full"
            style={{
              width: 22,
              background: i < players.length
                ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
    </div>
  ) : null;

  // ── Shared header ───────────────────────────────────────────────────────────

  const header = (
    <header
      className="flex items-center justify-between px-3 py-2.5 z-10 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)', background: 'rgba(10,22,40,0.95)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onLeave}
          className="p-2 rounded-xl flex-shrink-0"
          style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="display font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>
              Table #{tournament.id.slice(-6)}
            </span>
            {connectionStatus === 'connected'
              ? <Wifi size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
              : <WifiOff size={11} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            }
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
            {phaseLabels[gameState.phase]} · Hand #{gameState.handNumber}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
          <Clock size={11} />
          <span className="tabular-nums">{gameState.smallBlind}/{gameState.bigBlind}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
          background: 'rgba(95,190,255,0.1)', border: '1px solid rgba(95,190,255,0.2)',
        }}>
          <TokenUSDC variant="branded" size={11} />
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
            {tournament.prizePool}
          </span>
        </div>
      </div>
    </header>
  );

  // ── Community cards strip (shared) ──────────────────────────────────────────

  const communityStrip = (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {gameState.phase !== 'waiting' && gameState.phase !== 'preflop' ? (
        <>
          {gameState.communityCards.map((card, i) => (
            <PlayingCard key={`cc-${i}`} card={card} size="md" delay={i * 0.08} />
          ))}
          {Array.from({
            length: Math.max(
              0,
              (gameState.phase === 'flop' ? 3 : gameState.phase === 'turn' ? 4 : 5) -
              gameState.communityCards.length
            ),
          }, (_, i) => (
            <CardPlaceholder key={`ph-${i}`} size="md" />
          ))}
        </>
      ) : (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map(i => <CardPlaceholder key={i} size="md" />)}
        </div>
      )}
    </div>
  );

  // ── MOBILE layout (< sm breakpoint, handled via CSS class) ─────────────────

  const mobileLayout = (
    <div className="sm:hidden flex flex-col min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {header}

      {/* Community cards + pot */}
      <div
        className="flex flex-col items-center gap-1 px-3 py-2"
        style={{ background: 'rgba(30,92,56,0.15)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {phaseLabels[gameState.phase]}
        </div>
        {communityStrip}
        {gameState.pot > 0 && <PotDisplay amount={gameState.pot} />}
      </div>

      {/* Players list — collapsible */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <button
          className="flex items-center justify-between px-3 py-2 text-xs font-semibold"
          style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
          onClick={() => setShowPlayers(v => !v)}
        >
          <span>Players ({players.length}/{tournament.maxPlayers})</span>
          {showPlayers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <AnimatePresence>
          {showPlayers && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 space-y-1.5 overflow-y-auto" style={{ maxHeight: 240 }}>
                {players.map((player, idx) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    isMe={player.id === myPlayerId}
                    isCurrentTurn={idx === gameState.currentPlayerIndex}
                    myCards={player.id === myPlayerId ? myCards : []}
                    gamePhase={gameState.phase}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My cards always visible */}
        {myPlayer && gameState.phase !== 'waiting' && (
          <div className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Your hand</div>
            <div className="flex gap-1.5">
              {myCards.length > 0
                ? myCards.map((card, i) => <PlayingCard key={i} card={card} size="md" delay={i * 0.08} />)
                : (myPlayer.status === 'folded'
                  ? <span className="text-sm" style={{ color: 'var(--subtle)' }}>Folded</span>
                  : <><CardPlaceholder size="md" /><CardPlaceholder size="md" /></>
                )}
            </div>
            {myPlayer.status === 'allin' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>ALL IN</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom: action bar or waiting */}
      {actionBar}
      {waitingBar}
    </div>
  );

  // ── DESKTOP layout (≥ sm) ──────────────────────────────────────────────────

  const desktopLayout = (
    <div className="hidden sm:flex flex-col min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {header}

      {/* Table area */}
      <div className="flex-1 relative overflow-hidden p-4">
        {/* Oval felt */}
        <div
          className="poker-felt absolute"
          style={{ left: '5%', right: '5%', top: '8%', bottom: '25%', borderRadius: '50%' }}
        />

        {/* Center felt content */}
        <div
          className="absolute flex flex-col items-center gap-2"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -68%)', zIndex: 5 }}
        >
          <div
            className="text-xs font-semibold uppercase px-3 py-1 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--muted)',
              letterSpacing: '0.08em',
            }}
          >
            {phaseLabels[gameState.phase]}
          </div>

          {/* Community cards */}
          {gameState.phase !== 'waiting' && gameState.phase !== 'preflop' ? (
            <div className="flex gap-1.5">
              {gameState.communityCards.map((card, i) => (
                <PlayingCard key={`cc-${i}`} card={card} size="md" delay={i * 0.08} />
              ))}
              {Array.from({
                length: Math.max(
                  0,
                  (gameState.phase === 'flop' ? 3 : gameState.phase === 'turn' ? 4 : 5) -
                  gameState.communityCards.length
                ),
              }, (_, i) => (
                <CardPlaceholder key={`ph-${i}`} size="md" />
              ))}
            </div>
          ) : null}

          {gameState.pot > 0 && <PotDisplay amount={gameState.pot} />}

          {isMyTurn && gameState.turnStartedAt > 0 && (
            <div className="w-36">
              <TurnTimer startedAt={gameState.turnStartedAt} durationMs={gameState.turnTimeoutMs} />
            </div>
          )}
        </div>

        {/* Player seats around oval */}
        {players.map((player, idx) => {
          const pos = SEAT_POSITIONS[player.position % SEAT_POSITIONS.length];
          return (
            <div
              key={player.id}
              className="absolute z-10"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <PlayerSeatOval
                player={player}
                isMe={player.id === myPlayerId}
                isCurrentTurn={idx === gameState.currentPlayerIndex}
                myCards={player.id === myPlayerId ? myCards : []}
                gamePhase={gameState.phase}
              />
            </div>
          );
        })}
      </div>

      {actionBar}
      {waitingBar}
    </div>
  );

  return (
    <>
      {mobileLayout}
      {desktopLayout}
    </>
  );
}
