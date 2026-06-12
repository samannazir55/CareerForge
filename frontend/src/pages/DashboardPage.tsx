import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Coins, Crown, Zap, History, Trophy, ArrowRight,
  Plus, Pencil, Trash2, FileText, CheckCircle2, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../context/AppStore';
import { cvApi } from '../../services/api';
import { Button } from '../ui/Button';
import { formatDate, titleCase } from '../../lib/utils';
import type { CVRecord } from '../../types';

interface DashboardPageProps {
  onNavigate: (view: 'chat' | 'editor' | 'marketplace') => void;
  onEditCV: (cv: CVRecord) => void;
}

export function DashboardPage({ onNavigate, onEditCV }: DashboardPageProps) {
  const { user } = useAuth();
  const { pointsBalance, subscriptionPlan, transactions, upgradePlan } = useAppStore();

  const [cvs, setCvs] = useState<CVRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    cvApi
      .list()
      .then((data) => setCvs(data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this resume? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await cvApi.delete(id);
      setCvs((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Failed to delete. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
  };

  return (
    <div className="min-h-full bg-background overflow-y-auto p-5 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome back, {user?.fullName?.split(' ')[0] || 'friend'} 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your resumes and career assets.
            </p>
          </div>
          <Button variant="brand" onClick={() => onNavigate('chat')}>
            <Plus size={16} className="mr-2" /> New Resume
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Points card */}
          <div className="glass-panel rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold mb-3">
                <Coins size={18} /> Points Balance
              </div>
              <div className="text-4xl font-bold mb-1">{pointsBalance}</div>
              <p className="text-sm text-muted-foreground mb-4">Use points to unlock premium templates.</p>
              <Button variant="outline" size="sm" onClick={() => onNavigate('marketplace')}>
                Browse Store
              </Button>
            </div>
          </div>

          {/* Subscription card */}
          <div className="glass-panel rounded-3xl p-6 relative overflow-hidden group md:col-span-2">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold mb-2">
                  <Crown size={18} /> Current Plan
                </div>
                <div className="text-2xl font-bold capitalize mb-2">
                  {titleCase(subscriptionPlan)} Plan
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {subscriptionPlan === 'basic'
                    ? 'Upgrade to Professional or Premium to unlock more templates and get monthly points.'
                    : "You're enjoying premium features and monthly point drops."}
                </p>
              </div>
              {subscriptionPlan === 'basic' && (
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                    onClick={() => upgradePlan('professional')}
                  >
                    Upgrade to Pro ($12/mo)
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:opacity-90"
                    onClick={() => upgradePlan('premium')}
                  >
                    Upgrade to Premium ($29/mo)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Achievements + Resumes + History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Achievements + Resume list */}
          <div className="lg:col-span-2 space-y-6">
            {/* Achievements */}
            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" /> Achievements
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">Profile Completion</span>
                    <span className="text-xs font-bold text-emerald-500">+50 pts</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-emerald-500 w-[60%]" />
                  </div>
                  <span className="text-xs text-muted-foreground">60% complete</span>
                </div>
                <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">Resumes Created</span>
                    <span className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                      <Zap size={11} /> {cvs.length}
                    </span>
                  </div>
                  <div className="flex gap-1 mb-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`h-1.5 flex-1 rounded-full ${n <= cvs.length ? 'bg-indigo-500' : 'bg-muted'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Create {Math.max(0, 5 - cvs.length)} more to earn 25 pts
                  </span>
                </div>
              </div>
            </div>

            {/* Resume list */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">My Resumes</h2>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('chat')}>
                  <Plus size={14} className="mr-1" /> New
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : cvs.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 text-center">
                  <FileText size={40} className="mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-semibold text-foreground mb-1">No resumes yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Chat with our AI to build your first professional resume.
                  </p>
                  <Button variant="brand" onClick={() => onNavigate('chat')}>
                    Get Started <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cvs.map((cv, i) => (
                    <motion.div
                      key={cv.id}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      custom={i}
                      className="glass-panel rounded-2xl p-4 group hover:border-indigo-500/20 transition-colors"
                    >
                      <div className="aspect-[4/3] bg-muted rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
                        <CheckCircle2 size={24} className="text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-background/80 backdrop-blur text-xs font-semibold rounded-md">
                          {titleCase(cv.template_id)}
                        </div>
                      </div>
                      <h4 className="font-semibold text-sm mb-0.5 truncate">{cv.title || 'Untitled Resume'}</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Updated {formatDate(cv.updated_at)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => onEditCV(cv)}
                        >
                          <Pencil size={12} className="mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(cv.id)}
                          disabled={deletingId === cv.id}
                        >
                          {deletingId === cv.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Transaction history */}
          <div className="glass-panel rounded-3xl p-6 h-fit">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
              <History size={18} /> History
            </h2>
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                transactions.slice(0, 10).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm">{tx.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {tx.date.toLocaleDateString()}
                      </div>
                    </div>
                    <div
                      className={`font-bold text-sm ${
                        tx.type === 'earn' ? 'text-emerald-500' : 'text-foreground'
                      }`}
                    >
                      {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
