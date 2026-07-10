import { useRef, useState } from 'react';
import { motion, useAnimationFrame, useMotionValue, useSpring } from 'framer-motion';
import type { FeatureItem } from './FeatureCard';
import { NeonTower } from './NeonTower';
import { TowerSatellites } from './TowerSatellites';

const ACCENT_HEX: Record<FeatureItem['accent'], string> = {
  indigo: '#818cf8',
  purple: '#c084fc',
  pink: '#f472b6',
  cyan: '#22d3ee',
};

interface NeonPipeCarouselProps {
  features: FeatureItem[];
}

// Drag-to-spin, auto-rotating 3D carousel: feature cards mounted around a
// glowing hollow "pipe" made of layered conic/radial-gradient rings.
// Pure CSS 3D (preserve-3d + rotateY/translateZ) — no WebGL dependency.
export function NeonPipeCarousel({ features }: NeonPipeCarouselProps) {
  const rotation = useMotionValue(0);
  const smoothRotation = useSpring(rotation, { stiffness: 45, damping: 18 });
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const rotationStart = useRef(0);
  const autoSpin = useRef(true);
  const resumeTimeout = useRef<ReturnType<typeof setTimeout>>();

  useAnimationFrame((_, delta) => {
    if (autoSpin.current && !dragging) {
      rotation.set(rotation.get() + delta * 0.01);
    }
  });

  const radius = 360;
  const angleStep = 360 / features.length;

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    autoSpin.current = false;
    clearTimeout(resumeTimeout.current);
    dragStartX.current = e.clientX;
    rotationStart.current = rotation.get();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    rotation.set(rotationStart.current + (e.clientX - dragStartX.current) * 0.35);
  };
  const onPointerUp = () => {
    setDragging(false);
    resumeTimeout.current = setTimeout(() => (autoSpin.current = true), 1500);
  };

  return (
    <div
      className="relative w-full h-[560px] flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing"
      style={{ perspective: '1700px' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Satellite squares — rise up and join a permanent orbit around the tower */}
      <TowerSatellites />

      {/* Dark royal-blue lattice tower with glowing halo rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="pipe-ring pipe-ring-a" />
        <div className="pipe-ring pipe-ring-b" />
        <div className="pipe-ring pipe-ring-c" />
        <NeonTower />
      </div>

      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d', rotateY: smoothRotation }}
      >
        {features.map((feature, i) => {
          const angle = angleStep * i;
          const hex = ACCENT_HEX[feature.accent];
          return (
            <motion.div
              key={feature.title}
              className="absolute top-1/2 left-1/2 w-56 -ml-28 -mt-24"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
              }}
              whileHover={{ scale: 1.07, z: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <div
                className="neon-carousel-card rounded-2xl p-5 backdrop-blur-md"
                style={{
                  borderColor: `${hex}55`,
                  boxShadow: `0 0 26px ${hex}30, inset 0 0 30px ${hex}12`,
                }}
              >
                <feature.icon size={22} style={{ color: hex }} className="mb-3" />
                <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{feature.description}</p>
                <span
                  className="inline-block mt-3 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{
                    color: feature.status === 'live' ? '#4ade80' : '#facc15',
                    background: feature.status === 'live' ? '#4ade8018' : '#facc1518',
                  }}
                >
                  {feature.status === 'live' ? 'Live' : 'Coming soon'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <p className="absolute bottom-2 text-[11px] text-white/25 tracking-wide">drag to spin</p>
    </div>
  );
}