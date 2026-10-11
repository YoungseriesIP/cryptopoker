import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Users, Clock, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { TokenUSDC } from '@web3icons/react';
import type { LobbyTournament } from '../types/poker';
import { useAccount, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { getUsdc } from '@/onchain-facts';
import { Amount, usdcDecimalsFor } from '@/onchain-money';

const ARC_TESTNET_ID = 5042002;
const usdcFact = getUsdc(ARC_TESTNET_ID);

const BUY_INS = [1, 5, 10, 25, 50];
const MAX_PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 9];

interface LobbyScreenProps {
  tournaments: LobbyTournament[];
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  onBack: () => void;
  onJoin: (tournamentId: string) => void;
  onCreate: (buyIn: number, maxPlayers: number) => void;
  onRefresh?: () => void;
}

function AgoLabel({ createdAt }: { createdAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.floor((now - createdAt) / 60000);
  return <span>{mins}m ago</span>;
}

function StatusBadge({ status }: { status: LobbyTournament['status'] }) {
  const cfg = {
    waiting: { label: 'Open', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    starting: { label: 'Starting', color: '#f5c842', bg: 'rgba(245,200,66,0.12)' },
    active: { label: 'In Progress', color: '#5fbeff', bg: 'rgba(95,190,255,0.12)' },
    completed: { label: 'Done', color: 'var(--muted)', bg: 'rgba(255,255,255,0.06)' },
    cancelled: { label: 'Cancelled', color: 'var(--danger)', bg: 'rgba(248,113,113,0.10)' },
  }[status];

  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

export function LobbyScreen({ tournaments, wsStatus, onBack, onJoin, onCreate, onRefresh }: LobbyScreenProps) {
  const { address } = useAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBuyIn, setSelectedBuyIn] = useState(5);
  const [selectedMax, setSelectedMax] = useState(6);
  const [creating, setCreating] = useState(false);

  const { data: usdcBalance } = useReadContract({
    address: usdcFact?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!usdcFact },
  });

  const formattedBalance = usdcBalance
    ? Amount.fromRaw(usdcBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
    : null;

  const isServerDown = wsStatus !== 'connected';
  const openTournaments = tournaments.filter(t => t.status === 'waiting' || t.status === 'active');
  const pastTournaments = tournaments.filter(t => t.status === 'completed' || t.status === 'cancelled');

  function handleCreate() {
    if (isServerDown) return;
    setCreating(true);
    onCreate(selectedBuyIn, selectedMax);
    setTimeout(() => { setCreating(false); setShowCreate(false); }, 1000);
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: 0, left: '20%', width: 500, height: 300,
          background: 'radial-gradient(ellipse, rgba(30,74,46,0.3) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-3 py-3 border-b gap-2" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl flex-shrink-0"
            style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="display font-bold text-base truncate" style={{ color: 'var(--ink)' }}>Poker Lobby</h1>
            {formattedBalance && (
              <div className="flex items-center gap-1 mt-0.5">
                <TokenUSDC variant="branded" size={11} />
                <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{formattedBalance} USDC</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl"
              style={{ background: 'var(--surface)', color: 'var(--muted)' }}
            >
              <RefreshCw size={15} />
            </button>
          )}
          <button
            onClick={() => !isServerDown && setShowCreate(true)}
            disabled={isServerDown}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm"
            style={{
              background: isServerDown ? 'var(--surface)' : 'linear-gradient(135deg, #1e5c38, #2d7a46)',
              border: isServerDown ? '1px solid var(--border)' : '1px solid rgba(74,222,128,0.3)',
              color: isServerDown ? 'var(--muted)' : 'white',
              opacity: isServerDown ? 0.6 : 1,
              cursor: isServerDown ? 'not-allowed' : 'pointer',
            }}
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </header>

      {/* Server status banner */}
      {isServerDown && (
        <div
          className="relative z-10 flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
          style={{
            background: wsStatus === 'connecting' ? 'rgba(245,200,66,0.12)' : 'rgba(248,113,113,0.12)',
            borderBottom: `1px solid ${wsStatus === 'connecting' ? 'rgba(245,200,66,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: wsStatus === 'connecting' ? '#f5c842' : '#f87171',
          }}
        >
          <Loader2 size={12} className={wsStatus === 'connecting' ? 'animate-spin' : ''} />
          {wsStatus === 'connecting'
            ? 'Connecting to game server…'
            : 'Game server unreachable — reconnecting…'}
        </div>
      )}

      <main className="relative z-10 flex-1 px-4 py-4 pb-8 space-y-6 overflow-y-auto">
        {/* Live Tables */}
        <section>
          <h2 className="text-sm font-semibold mb-3 uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
            Available Tables ({openTournaments.length})
          </h2>
          {openTournaments.length === 0 ? (
            <div
              className="text-center py-12 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="text-4xl mb-3" style={{ opacity: 0.3 }}>♠</div>
              <p style={{ color: 'var(--muted)' }} className="text-sm">No tables open right now.</p>
              <p style={{ color: 'var(--subtle)' }} className="text-xs mt-1">Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openTournaments.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: 'linear-gradient(135deg, #1e4a2e, #2d7a46)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18,
                        }}
                      >
                        ♦
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm display" style={{ color: 'var(--ink)' }}>
                            Table #{t.id.slice(-6)}
                          </span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <TokenUSDC variant="branded" size={12} />
                          <span className="text-xs tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>
                            {t.buyIn} USDC buy-in
                          </span>
                        </div>
                      </div>
                    </div>
                    {t.status === 'waiting' && (
                      <button
                        onClick={() => !isServerDown && onJoin(t.id)}
                        disabled={isServerDown}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl font-semibold text-sm"
                        style={{
                          background: isServerDown ? 'var(--surface)' : 'linear-gradient(135deg, #1e5c38, #2d7a46)',
                          border: isServerDown ? '1px solid var(--border)' : '1px solid rgba(74,222,128,0.3)',
                          color: isServerDown ? 'var(--muted)' : 'white',
                          opacity: isServerDown ? 0.5 : 1,
                          cursor: isServerDown ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Join
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      <span>{t.currentPlayers}/{t.maxPlayers} players</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Prize pool:</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--gold)' }}>
                        {t.prizePool.toFixed(2)} USDC
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <AgoLabel createdAt={t.createdAt} />
                    </div>
                  </div>
                  {/* Player bar */}
                  <div className="mt-3">
                    <div className="flex gap-1">
                      {Array.from({ length: t.maxPlayers }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1, height: 4, borderRadius: 2,
                            background: i < t.currentPlayers
                              ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                              : 'rgba(255,255,255,0.08)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Past */}
        {pastTournaments.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Recent ({pastTournaments.length})
            </h2>
            <div className="space-y-2">
              {pastTournaments.slice(0, 5).map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <span className="text-sm mono" style={{ color: 'var(--muted)' }}>#{t.id.slice(-6)}</span>
                  <StatusBadge status={t.status} />
                  <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
                    {t.buyIn} USDC × {t.maxPlayers}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Create table sheet */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 35 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
              style={{ background: '#0f1e33', border: '1px solid var(--border)', borderBottom: 'none' }}
            >
              {/* Spectral strip */}
              <div style={{
                position: 'absolute', top: 0, left: '10%', right: '10%', height: 3, borderRadius: '0 0 3px 3px',
                background: 'linear-gradient(90deg, #5fbeff, #4ade80, #f5c842)',
              }} />
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />

              <h2 className="display font-bold text-xl mb-6" style={{ color: 'var(--ink)' }}>Create Table</h2>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold uppercase mb-3 block" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
                    Buy-in Amount
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {BUY_INS.map(b => (
                      <button
                        key={b}
                        onClick={() => setSelectedBuyIn(b)}
                        className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-semibold text-sm"
                        style={{
                          background: selectedBuyIn === b ? 'linear-gradient(135deg, #1e5c38, #2d7a46)' : 'var(--surface)',
                          border: selectedBuyIn === b ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--border)',
                          color: selectedBuyIn === b ? 'white' : 'var(--ink-2)',
                        }}
                      >
                        <TokenUSDC variant="branded" size={14} />
                        {b} USDC
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase mb-3 block" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
                    Max Players
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {MAX_PLAYERS_OPTIONS.map(n => (
                      <button
                        key={n}
                        onClick={() => setSelectedMax(n)}
                        className="px-3 py-2.5 rounded-xl font-semibold text-sm"
                        style={{
                          background: selectedMax === n ? 'linear-gradient(135deg, #1e5c38, #2d7a46)' : 'var(--surface)',
                          border: selectedMax === n ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--border)',
                          color: selectedMax === n ? 'white' : 'var(--ink-2)',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
                >
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted)' }}>Buy-in</span>
                    <div className="flex items-center gap-1">
                      <TokenUSDC variant="branded" size={14} />
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{selectedBuyIn} USDC</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted)' }}>Max players</span>
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>{selectedMax}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Max prize pool</span>
                    <div className="flex items-center gap-1">
                      <TokenUSDC variant="branded" size={14} />
                      <span className="font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
                        {(selectedBuyIn * selectedMax).toFixed(2)} USDC
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full py-4 rounded-2xl font-bold text-base display flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #1e5c38, #2d7a46)',
                    border: '1px solid rgba(74,222,128,0.3)',
                    color: 'white',
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? <Loader2 size={18} className="animate-spin" /> : null}
                  {creating ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
