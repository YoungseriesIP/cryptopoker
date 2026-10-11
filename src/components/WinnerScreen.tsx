import { motion } from 'framer-motion';
import { Trophy, ExternalLink } from 'lucide-react';
import { TokenUSDC } from '@web3icons/react';
import type { Tournament } from '../types/poker';
import { PlayerAvatar } from './PlayerAvatar';
import { buildTxExplorerUrl } from '@/onchain-facts';

const ARC_TESTNET_ID = 5042002;

interface WinnerScreenProps {
  tournament: Tournament;
  myPlayerId: string | null;
  onPlayAgain: () => void;
  onHome: () => void;
}

// Pre-generate confetti data outside component to avoid re-render randomness
const CONFETTI_DATA = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: (i * 3.33) % 100,
  color: ['#4ade80', '#5fbeff', '#f5c842', '#f87171', '#a78bfa'][i % 5],
  delay: (i * 0.027) % 0.8,
  duration: 1.5 + (i * 0.033) % 1,
  isCircle: i % 2 === 0,
  rotateDir: i % 2 === 0 ? 1 : -1,
}));

// Confetti particle
function Confetti() {
  const particles = CONFETTI_DATA;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: 0, rotate: 360 * p.rotateDir }}
          transition={{ delay: p.delay, duration: p.duration, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            top: 0,
            width: 8,
            height: 8,
            borderRadius: p.isCircle ? '50%' : 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

export function WinnerScreen({ tournament, myPlayerId, onPlayAgain, onHome }: WinnerScreenProps) {
  const winner = tournament.players.find(p => p.id === tournament.winner);
  const isWinner = tournament.winner === myPlayerId;

  if (!winner) return null;

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center relative px-6 py-12"
      style={{ background: 'var(--bg-gradient)' }}
    >
      <Confetti />

      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div style={{
          position: 'absolute',
          top: '20%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${isWinner ? 'rgba(245,200,66,0.2)' : 'rgba(95,190,255,0.1)'} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-sm w-full">
        {/* Trophy */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          className="flex items-center justify-center"
          style={{
            width: 80, height: 80, borderRadius: 20,
            background: isWinner
              ? 'linear-gradient(135deg, #b45309, #f5c842)'
              : 'linear-gradient(135deg, #1e3a5f, #2d5a8e)',
            boxShadow: isWinner
              ? '0 0 60px rgba(245,200,66,0.4)'
              : '0 0 40px rgba(95,190,255,0.2)',
          }}
        >
          <Trophy size={40} color={isWinner ? '#fff' : '#5fbeff'} />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          {isWinner ? (
            <>
              <h1 className="display font-bold" style={{ fontSize: 'clamp(2rem, 8vw, 2.8rem)', color: '#f5c842', letterSpacing: '-0.03em' }}>
                You Won!
              </h1>
              <p className="text-base mt-1" style={{ color: 'var(--muted)' }}>
                Congratulations — you outlasted everyone.
              </p>
            </>
          ) : (
            <>
              <h1 className="display font-bold" style={{ fontSize: 'clamp(1.8rem, 7vw, 2.4rem)', color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                Tournament Over
              </h1>
              <p className="text-base mt-1" style={{ color: 'var(--muted)' }}>
                Better luck next time.
              </p>
            </>
          )}
        </motion.div>

        {/* Winner card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55 }}
          className="glass-card rounded-2xl p-5 w-full space-y-4"
        >
          {/* Winner info */}
          <div className="flex items-center gap-4">
            <PlayerAvatar
              seed={winner.avatarSeed}
              name={winner.name}
              size={52}
            />
            <div>
              <div className="text-xs uppercase font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>Winner</div>
              <div className="display font-bold text-lg" style={{ color: 'var(--ink)' }}>
                {winner.id === myPlayerId ? 'You' : winner.name}
              </div>
              <div className="text-xs mono" style={{ color: 'var(--subtle)' }}>
                {winner.address.slice(0, 6)}…{winner.address.slice(-4)}
              </div>
            </div>
          </div>

          {/* Prize */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)' }}
          >
            <div>
              <div className="text-xs uppercase font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
                Prize Pool
              </div>
              <div className="flex items-center gap-2 mt-1">
                <TokenUSDC variant="branded" size={20} />
                <span className="display font-bold text-2xl tabular-nums" style={{ color: '#f5c842' }}>
                  {tournament.prizePool.toFixed(2)}
                </span>
                <span className="font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
              </div>
            </div>
            <div className="text-4xl">🏆</div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Players', value: tournament.players.length },
              { label: 'Buy-in', value: `${tournament.buyIn} USDC` },
              { label: 'Hands', value: tournament.gameState.handNumber },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="text-center rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
              >
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
                <div className="font-bold text-sm tabular-nums mt-0.5" style={{ color: 'var(--ink)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Settlement */}
          <div
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Settlement status</span>
              {tournament.settlementTxHash ? (
                <a
                  href={buildTxExplorerUrl(ARC_TESTNET_ID, tournament.settlementTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  View on Explorer
                  <ExternalLink size={11} />
                </a>
              ) : (
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  Pending settlement
                </span>
              )}
            </div>
            <div
              className="mt-2 text-xs flex items-center gap-1.5"
              style={{ color: tournament.settlementTxHash ? 'var(--success)' : 'var(--muted)' }}
            >
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: tournament.settlementTxHash ? 'var(--success)' : 'rgba(255,255,255,0.3)',
                }}
              />
              {tournament.settlementTxHash ? 'USDC sent to winner on Arc' : 'Awaiting block confirmation'}
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex gap-3 w-full"
        >
          <button
            onClick={onPlayAgain}
            className="flex-1 py-4 rounded-2xl font-bold display"
            style={{
              background: 'linear-gradient(135deg, #1e5c38, #2d7a46)',
              border: '1px solid rgba(74,222,128,0.3)',
              color: 'white',
            }}
          >
            Play Again
          </button>
          <button
            onClick={onHome}
            className="flex-1 py-4 rounded-2xl font-semibold"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--ink-2)',
            }}
          >
            Home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
