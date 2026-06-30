import { useMemo, type CSSProperties } from 'react';

const NEON_COLORS = [
  'rgba(99, 102, 241, 0.18)',  // indigo
  'rgba(168, 85, 247, 0.16)',  // purple
  'rgba(236, 72, 153, 0.14)',  // pink
  'rgba(34, 211, 238, 0.14)',  // cyan
];

const NEON_BORDERS = [
  'rgba(129, 140, 248, 0.5)',
  'rgba(192, 132, 252, 0.5)',
  'rgba(244, 114, 182, 0.45)',
  'rgba(103, 232, 249, 0.45)',
];

interface SquareConfig {
  id: number;
  size: number;
  top: string;
  left: string;
  colorIdx: number;
  duration: number;
  delay: number;
  dx: number;
  dy: number;
  rot: number;
}

/**
 * Ambient decorative layer for the welcome page hero — small glowing squares
 * that drift slowly in the background. Purely visual, aria-hidden, and
 * pointer-events-none so it never interferes with content or accessibility.
 *
 * Configs are generated once via useMemo (not on every render) but are not
 * seeded — fine here since this is a client-only SPA with no SSR/hydration
 * to keep in sync.
 */
export function FloatingSquares({ count = 16 }: { count?: number }) {
  const squares = useMemo<SquareConfig[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const colorIdx = i % NEON_COLORS.length;
      return {
        id: i,
        size: 14 + Math.random() * 46,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        colorIdx,
        duration: 7 + Math.random() * 8,
        delay: Math.random() * 5,
        dx: -20 + Math.random() * 40,
        dy: -28 + Math.random() * 40,
        rot: -8 + Math.random() * 16,
      };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {squares.map((sq) => (
        <div
          key={sq.id}
          className="neon-square"
          style={
            {
              width: sq.size,
              height: sq.size,
              top: sq.top,
              left: sq.left,
              background: NEON_COLORS[sq.colorIdx],
              borderColor: NEON_BORDERS[sq.colorIdx],
              boxShadow: `0 0 ${sq.size * 0.6}px ${NEON_COLORS[sq.colorIdx]}`,
              animationDuration: `${sq.duration}s`,
              animationDelay: `${sq.delay}s`,
              '--dx': `${sq.dx}px`,
              '--dy': `${sq.dy}px`,
              '--rot': '0deg',
              '--rot2': `${sq.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
