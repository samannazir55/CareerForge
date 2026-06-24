import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { pointsApi } from '../../lib/api';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface TemplateItem {
  id: string;
  name: string;
  category: 'free' | 'premium';
  cost: number;
}

export function MarketplacePage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([pointsApi.getTemplates(), pointsApi.get()])
      .then(([tData, pData]) => {
        setTemplates(tData.templates as TemplateItem[]);
        setBalance(pData.balance);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load templates.'));
  }, []);

  async function handlePurchase(templateId: string, cost: number) {
    if (balance < cost) {
      setError(`You need ${cost} points but only have ${balance}.`);
      return;
    }
    setPurchasing(templateId);
    setError(null);
    try {
      await pointsApi.purchaseTemplate(templateId);
      setPurchased((prev) => new Set([...prev, templateId]));
      setBalance((b) => b - cost);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Purchase failed.');
    } finally {
      setPurchasing(null);
    }
  }

  const isPremiumUser = user?.subscriptionTier === 'PREMIUM';

  return (
    <AppShell>
      <div className="p-6 sm:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Template Marketplace</h1>
            <p className="text-muted-foreground mt-1">
              {isPremiumUser ? 'All templates unlocked with your Premium plan.' : `${balance} points available`}
            </p>
          </div>
        </div>

        {error && <p className="text-destructive mb-6">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, i) => {
            const isOwned = purchased.has(template.id) || template.category === 'free' || isPremiumUser;
            const canAfford = balance >= template.cost;

            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard className="flex flex-col gap-4">
                  {/* Preview placeholder */}
                  <div className={cn(
                    'h-48 rounded-xl flex items-center justify-center relative overflow-hidden',
                    template.category === 'free' ? 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10' : 'bg-gradient-to-br from-amber-500/10 to-orange-500/10'
                  )}>
                    <span className="text-4xl">
                      {template.category === 'free' ? '📄' : '⭐'}
                    </span>
                    {template.category === 'premium' && !isOwned && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                          PREMIUM
                        </span>
                      </div>
                    )}
                    {isOwned && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Check size={10} /> Owned
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold">{template.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{template.category}</p>
                  </div>

                  {template.category === 'free' ? (
                    <Button variant="secondary" size="sm" disabled>
                      Free template
                    </Button>
                  ) : isOwned ? (
                    <Button variant="secondary" size="sm" disabled>
                      <Check size={14} className="mr-1.5" /> Owned
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canAfford || purchasing === template.id}
                      onClick={() => handlePurchase(template.id, template.cost)}
                      className={cn(!canAfford && 'opacity-50')}
                    >
                      {purchasing === template.id ? (
                        'Purchasing…'
                      ) : canAfford ? (
                        <>⭐ {template.cost} points</>
                      ) : (
                        <><Lock size={12} className="mr-1" /> {template.cost} points needed</>
                      )}
                    </Button>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {!isPremiumUser && (
          <GlassCard className="mt-8 bg-gradient-ai">
            <div className="flex items-center gap-4">
              <div className="text-3xl">💎</div>
              <div>
                <p className="font-semibold">Go Premium — Unlock Everything</p>
                <p className="text-sm text-muted-foreground">All templates, unlimited exports, advanced AI features.</p>
              </div>
              <a href="/settings" className="ml-auto">
                <Button size="sm">Upgrade to Premium</Button>
              </a>
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
