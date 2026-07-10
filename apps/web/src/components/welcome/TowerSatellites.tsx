import { useRef, type CSSProperties } from 'react';
import { motion, useInView } from 'framer-motion';

interface SatelliteConfig {
  id: number;
  angle: number;
  radius: number;
  size: number;
  colorHex: string;
}

const ACCENT_HEXES = ['#818cf8', '#c084fc', '#f472b6', '#22d3ee'];
const SATELLITE_COUNT = 10;

const SATELLITES: SatelliteConfig[] = Array.from({ length: SATELLITE_COUNT }, (_, i) => ({
  id: i,
  angle: (360 / SATELLITE_COUNT) * i,
  radius: i % 2 === 0 ? 235 : 255,
  size: 9 + (i % 3) * 4,
  colorHex: ACCENT_HEXES[i % ACCENT_HEXES.length],
}));

const ORBIT_DURATION = '42s';

// Renders once per mount; the orbit-track keeps spinning forever from the
// moment this mounts (non-stop), but each satellite starts invisible and
// offset below its slot — so the first time the section scrolls into view,
// they visibly rise up and merge into the already-turning ring.
export function TowerSatellites() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-120px' });

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none z-0">
      {SATELLITES.map((sat, i) => (
        <div
          key={sat.id}
          className="orbit-track orbit-track-cw"
          style={{ '--orbit-duration': ORBIT_DURATION } as CSSProperties}
        >
          <div
            className="orbit-item"
            style={{ transform: `rotate(${sat.angle}deg) translateX(${sat.radius}px)` }}
          >
            <div
              className="orbit-counter orbit-counter-ccw"
              style={{ '--orbit-duration': ORBIT_DURATION } as CSSProperties}
            >
              <motion.div
                className="relative"
                initial={{ opacity: 0, y: 170, scale: 0.4 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  className="satellite-square"
                  style={{
                    width: sat.size,
                    height: sat.size,
                    background: `${sat.colorHex}33`,
                    borderColor: `${sat.colorHex}88`,
                    boxShadow: `0 0 ${sat.size * 1.4}px ${sat.colorHex}55`,
                  }}
                />
                {/* trailing glow echo for a touch of motion elegance */}
                <div
                  className="neon-square-ghost"
                  style={{ width: sat.size * 1.4, height: sat.size * 1.4, background: `${sat.colorHex}40` }}
                />
              </motion.div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}