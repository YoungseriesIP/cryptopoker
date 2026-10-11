import { TokenUSDC } from '@web3icons/react';

interface ChipDisplayProps {
  amount: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'chips' | 'usdc';
  className?: string;
}

export function ChipDisplay({ amount, label, size = 'md', variant = 'chips', className = '' }: ChipDisplayProps) {
  const formatted = variant === 'usdc'
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : new Intl.NumberFormat('en-US').format(amount);

  const textSize = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size];
  const amountSize = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }[size];

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {label && (
        <span style={{ color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }} className={`${textSize} font-semibold`}>
          {label}
        </span>
      )}
      <div className="flex items-center gap-1">
        {variant === 'usdc' ? (
          <TokenUSDC variant="branded" size={size === 'sm' ? 14 : size === 'md' ? 16 : 20} />
        ) : (
          <span style={{ fontSize: size === 'sm' ? 12 : size === 'md' ? 14 : 18 }}>🪙</span>
        )}
        <span
          className={`${amountSize} font-bold tabular-nums display`}
          style={{ color: variant === 'usdc' ? 'var(--accent)' : 'var(--gold)' }}
        >
          {formatted}
        </span>
        {variant === 'usdc' && (
          <span style={{ color: 'var(--muted)' }} className={textSize}>USDC</span>
        )}
      </div>
    </div>
  );
}

interface PotDisplayProps {
  amount: number;
  className?: string;
}

export function PotDisplay({ amount, className = '' }: PotDisplayProps) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full ${className}`}
      style={{
        background: 'rgba(245, 200, 66, 0.12)',
        border: '1px solid rgba(245,200,66,0.25)',
      }}
    >
      <span style={{ fontSize: 14 }}>🪙</span>
      <span
        className="display font-bold tabular-nums text-sm"
        style={{ color: 'var(--gold)' }}
      >
        {new Intl.NumberFormat('en-US').format(amount)}
      </span>
    </div>
  );
}
