import { motion } from 'framer-motion';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { Wallet, TrendingUp, Users, BookOpen, Clock, Shield } from 'lucide-react';
import { TokenUSDC } from '@web3icons/react';

interface HomeScreenProps {
  onPlay: () => void;
  onHistory: () => void;
}

export function HomeScreen({ onPlay, onHistory }: HomeScreenProps) {
  const { isConnected } = useAccount();

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: '5%', left: '10%', width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30, 74, 46, 0.35) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '5%', width: 350, height: 350,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(95, 190, 255, 0.12) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #1e4a2e, #2d7a46)',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 16 }}>♠</span>
          </div>
          <span className="display font-bold text-base truncate" style={{ color: 'var(--ink)' }}>Arc Poker</span>
        </div>
        <div className="flex-shrink-0">
          <ConnectKitButton />
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16 pt-8 gap-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-lg"
        >
          {/* Card fan decoration */}
          <div className="flex justify-center mb-8" style={{ gap: -8 }}>
            {['♠A', '♥K', '♦Q', '♣J'].map((label, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, rotate: (i - 1.5) * 8 - 20 }}
                animate={{ opacity: 1, rotate: (i - 1.5) * 8 }}
                transition={{ delay: i * 0.08, duration: 0.5, type: 'spring' }}
                style={{
                  width: 52,
                  height: 74,
                  background: 'white',
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: label.startsWith('♥') || label.startsWith('♦') ? '#dc2626' : '#111827',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  marginLeft: i > 0 ? -16 : 0,
                  zIndex: i,
                }}
              >
                {label}
              </motion.div>
            ))}
          </div>

          <h1 className="display font-bold mb-3" style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            Real Poker.<br />
            <span style={{
              background: 'linear-gradient(90deg, #4ade80, #5fbeff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Real USDC.
            </span>
          </h1>
          <p className="text-base" style={{ color: 'var(--muted)', maxWidth: '40ch', margin: '0 auto', lineHeight: 1.6 }}>
            Compete in multiplayer Texas Hold'em tournaments. Buy in with USDC, play hands, win the pot — settled on Arc.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-col items-center gap-4 w-full max-w-sm"
        >
          {isConnected ? (
            <button
              onClick={onPlay}
              className="w-full py-4 rounded-2xl font-bold text-lg display"
              style={{
                background: 'linear-gradient(135deg, #1e5c38 0%, #2d7a46 100%)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                color: 'white',
                boxShadow: '0 8px 32px rgba(30, 92, 56, 0.4)',
                letterSpacing: '-0.01em',
              }}
            >
              Play Poker
            </button>
          ) : (
            <div className="w-full flex flex-col items-center gap-3">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to start playing</p>
              <ConnectKitButton label="Connect Wallet to Play" />
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button
              onClick={onHistory}
              className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--ink-2)',
              }}
            >
              <Clock size={16} />
              History
            </button>
            <a
              href="https://docs.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 no-underline"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--ink-2)',
              }}
            >
              <BookOpen size={16} />
              How to Play
            </a>
          </div>
        </motion.div>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-2 max-w-md"
        >
          {[
            { icon: <TokenUSDC variant="branded" size={14} />, label: 'USDC Buy-ins' },
            { icon: <Users size={14} />, label: '2–9 Players' },
            { icon: <TrendingUp size={14} />, label: 'Live Settlement' },
            { icon: <Shield size={14} />, label: 'Smart Contract Escrow' },
            { icon: <Wallet size={14} />, label: 'Arc Network' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--muted)',
              }}
            >
              {icon}
              {label}
            </div>
          ))}
        </motion.div>

        {/* Testnet disclaimer */}
        <div
          className="text-xs text-center px-4 py-2 rounded-lg"
          style={{
            background: 'rgba(95, 190, 255, 0.08)',
            border: '1px solid rgba(95, 190, 255, 0.15)',
            color: 'var(--muted)',
            maxWidth: 400,
          }}
        >
          Running on Arc Testnet — use free test USDC from the sidebar faucet. No real funds at risk.
        </div>
      </main>
    </div>
  );
}
