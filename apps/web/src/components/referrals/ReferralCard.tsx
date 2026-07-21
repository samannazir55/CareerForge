import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Copy, Check, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { referralsApi, ApiError } from '../../lib/api';
import type { ReferralStats } from '@careerforge/schema';

export function ReferralCard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    referralsApi
      .getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your referral link.'));
  }, []);

  async function handleCopy() {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied/unavailable — the link is still
      // visible and selectable in the input below, so this isn't fatal.
    }
  }

  const shareText = "I've been building my resume with Corvyx's AI tools — you should try it:";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="glass-panel rounded-3xl p-6 relative overflow-hidden group"
    >
      <div className="absolute -right-14 -top-14 w-52 h-52 bg-pink-500/10 rounded-full blur-3xl group-hover:bg-pink-500/20 transition-colors" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-medium mb-2">
          <Gift size={20} />
          <span>Refer a friend, earn points</span>
        </div>
        <p className="text-sm text-muted-foreground mb-5 max-w-md">
          Share your link. When a friend signs up and verifies their email, you both get 50 points.
        </p>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {stats && (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <input
                readOnly
                value={stats.referralUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground/90 truncate"
              />
              <Button variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`${shareText} ${stats.referralUrl}`)}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(stats.referralUrl)}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                Share on X
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    `mailto:?subject=${encodeURIComponent('Try Corvyx')}&body=${encodeURIComponent(`${shareText}\n\n${stats.referralUrl}`)}`,
                  )
                }
              >
                Email
              </Button>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-muted-foreground" />
                <span className="font-semibold tabular-nums">{stats.rewardedReferrals}</span>
                <span className="text-muted-foreground">
                  {stats.rewardedReferrals === 1 ? 'friend joined' : 'friends joined'}
                </span>
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{stats.pointsEarned}</span> points
                earned from referrals
              </div>
              {stats.totalReferred > stats.rewardedReferrals && (
                <div className="text-muted-foreground text-xs">
                  +{stats.totalReferred - stats.rewardedReferrals} pending verification
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
