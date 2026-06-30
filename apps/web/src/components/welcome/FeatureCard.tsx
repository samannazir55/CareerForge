import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
  status: 'live' | 'soon';
  accent: 'indigo' | 'purple' | 'pink' | 'cyan';
}

const ACCENT_STYLES: Record<FeatureItem['accent'], { ring: string; iconBg: string; glow: string }> = {
  indigo: { ring: 'group-hover:ring-indigo-400/40', iconBg: 'bg-indigo-500/15 text-indigo-300', glow: 'group-hover:shadow-indigo-500/20' },
  purple: { ring: 'group-hover:ring-purple-400/40', iconBg: 'bg-purple-500/15 text-purple-300', glow: 'group-hover:shadow-purple-500/20' },
  pink: { ring: 'group-hover:ring-pink-400/40', iconBg: 'bg-pink-500/15 text-pink-300', glow: 'group-hover:shadow-pink-500/20' },
  cyan: { ring: 'group-hover:ring-cyan-400/40', iconBg: 'bg-cyan-500/15 text-cyan-300', glow: 'group-hover:shadow-cyan-500/20' },
};

interface FeatureCardProps {
  feature: FeatureItem;
  index: number;
}

export function FeatureCard({ feature, index }: FeatureCardProps) {
  const Icon = feature.icon;
  const styles = ACCENT_STYLES[feature.accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: (index % 6) * 0.06, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className={`group relative rounded-2xl p-5 bg-white/[0.03] border border-white/10 ring-1 ring-transparent transition-all duration-300 shadow-lg shadow-black/20 ${styles.ring} ${styles.glow}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${styles.iconBg}`}>
          <Icon size={18} />
        </div>
        <span
          className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${
            feature.status === 'live'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20'
              : 'bg-white/5 text-white/50 border border-white/10'
          }`}
        >
          {feature.status === 'live' ? 'Live' : 'Soon'}
        </span>
      </div>
      <h3 className="font-semibold text-sm text-white/90 mb-1.5">{feature.title}</h3>
      <p className="text-xs text-white/50 leading-relaxed">{feature.description}</p>
    </motion.div>
  );
}
