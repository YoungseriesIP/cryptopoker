interface PlayerAvatarProps {
  seed: string;
  name: string;
  size?: number;
  isActive?: boolean;
  isDealer?: boolean;
  isFolded?: boolean;
  className?: string;
}

// Generate a consistent color from a seed string
function seedColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function PlayerAvatar({ seed, name, size = 40, isActive = false, isDealer = false, isFolded = false, className = '' }: PlayerAvatarProps) {
  const color = seedColor(seed);
  const initials = getInitials(name);

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: isFolded ? 'rgba(100,100,100,0.3)' : color,
          border: isActive ? '2px solid #5fbeff' : isFolded ? '2px solid rgba(255,255,255,0.1)' : '2px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.35,
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          color: isFolded ? 'rgba(255,255,255,0.3)' : 'white',
          opacity: isFolded ? 0.5 : 1,
          boxShadow: isActive ? '0 0 0 3px rgba(95,190,255,0.3), 0 0 20px rgba(95,190,255,0.2)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        {initials}
      </div>
      {isDealer && (
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: size * 0.38,
            height: size * 0.38,
            borderRadius: '50%',
            background: '#f5c842',
            border: '2px solid #0a1628',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.18,
            fontWeight: 700,
            color: '#0a1628',
          }}
        >
          D
        </div>
      )}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid rgba(95,190,255,0.5)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}
