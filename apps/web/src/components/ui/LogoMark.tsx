import { motion } from 'framer-motion';

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Pulses the two wing layers, used inside BrandLoader. Static everywhere else. */
  animate?: boolean;
}

/**
 * The Corvyx mark — two overlapping triangles forming a layered, folded-wing
 * silhouette. Renders in `currentColor`, so wrap it in a text-color class
 * (or an indigo/purple gradient text class) to theme it.
 */
export function LogoMark({ size = 24, className, animate = false }: LogoMarkProps) {
  if (!animate) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
        <polygon points="20,4 5,33 20,27" fill="currentColor" opacity={0.55} />
        <polygon points="20,4 35,33 20,27" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <motion.polygon
        points="20,4 5,33 20,27"
        fill="currentColor"
        initial={{ opacity: 0.35 }}
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.polygon
        points="20,4 35,33 20,27"
        fill="currentColor"
        initial={{ opacity: 0.75 }}
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
      />
    </svg>
  );
}
