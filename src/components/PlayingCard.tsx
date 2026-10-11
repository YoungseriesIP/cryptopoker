import { motion } from 'framer-motion';
import type { Card } from '../types/poker';
import { getSuitSymbol, getSuitColor } from '../lib/poker-engine';

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
  className?: string;
}

const SIZE_PX = {
  sm: { w: 32, h: 48 },
  md: { w: 48, h: 72 },
  lg: { w: 64, h: 96 },
};

export function PlayingCard({ card, hidden = false, size = 'md', delay = 0, className = '' }: PlayingCardProps) {
  const dims = SIZE_PX[size];

  if (hidden || !card) {
    return (
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay }}
        className={`playing-card-back flex items-center justify-center ${className}`}
        style={{ width: dims.w, height: dims.h, minWidth: dims.w }}
      >
        <div style={{
          width: dims.w - 8,
          height: dims.h - 8,
          background: 'linear-gradient(135deg, rgba(95,190,255,0.15), rgba(95,190,255,0.05))',
          borderRadius: 4,
          border: '1px solid rgba(95,190,255,0.2)',
        }} />
      </motion.div>
    );
  }

  const color = getSuitColor(card.suit);
  const symbol = getSuitSymbol(card.suit);

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0, y: -10 }}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, type: 'spring', stiffness: 300 }}
      className={`playing-card flex flex-col justify-between p-1 ${className}`}
      style={{
        width: dims.w,
        height: dims.h,
        minWidth: dims.w,
        color: color === 'red' ? '#dc2626' : '#111827',
      }}
    >
      <div style={{ lineHeight: 1, fontWeight: 700, fontSize: size === 'sm' ? 11 : size === 'md' ? 13 : 16 }}>
        <div>{card.rank}</div>
        <div style={{ fontSize: size === 'sm' ? 10 : 12 }}>{symbol}</div>
      </div>
      <div style={{
        textAlign: 'center',
        fontSize: size === 'sm' ? 14 : size === 'md' ? 20 : 28,
        lineHeight: 1,
      }}>
        {symbol}
      </div>
      <div style={{
        lineHeight: 1,
        fontWeight: 700,
        fontSize: size === 'sm' ? 11 : size === 'md' ? 13 : 16,
        transform: 'rotate(180deg)',
        textAlign: 'right',
      }}>
        <div>{card.rank}</div>
        <div style={{ fontSize: size === 'sm' ? 10 : 12 }}>{symbol}</div>
      </div>
    </motion.div>
  );
}

export function CardPlaceholder({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = SIZE_PX[size];
  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        minWidth: dims.w,
        borderRadius: 6,
        border: '1px dashed rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.03)',
      }}
    />
  );
}
