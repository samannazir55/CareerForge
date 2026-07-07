import { useEffect, useState } from 'react';
import { Coins, TrendingUp, TrendingDown } from 'lucide-react';
import { PageHeader, StatCard, AdminTable, AdminBadge } from '../../components/admin/AdminUI';
import { adminApi } from '../../lib/adminApi';
import type { AdminDashboardStats } from '@careerforge/schema';
import { request } from '../../lib/api';

interface TransactionRow {
  id: string;
  userId: string;
  userEmail: string;
  userFullName: string | null;
  type: string;
  amount: number;
  earnReason: string | null;
  spendReason: string | null;
  description: string | null;
  createdAt: string;
}

export function AdminPointsPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getDashboardStats()
      .then(setStats)
      .finally(() => setIsLoadingStats(false));

    // Global transaction ledger — admin-specific endpoint that joins user data
    request<{ transactions: TransactionRow[] }>('/admin/points/transactions')
      .then((d) => setTransactions(d.transactions))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load transactions.'))
      .finally(() => setIsLoadingTx(false));
  }, []);

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (t: TransactionRow) => (
        <div>
          <p className="text-sm font-medium">{t.userFullName ?? t.userEmail}</p>
          <p className="text-xs text-muted-foreground">{t.userEmail}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (t: TransactionRow) => (
        <AdminBadge variant={t.type === 'EARN' ? 'green' : 'red'}>
          {t.type.toLowerCase()}
        </AdminBadge>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (t: TransactionRow) => (
        <span className="text-xs text-muted-foreground font-mono">
          {t.earnReason ?? t.spendReason ?? '—'}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (t: TransactionRow) => (
        <span className="text-sm text-muted-foreground">{t.description ?? '—'}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (t: TransactionRow) => (
        <div className="flex items-center gap-1">
          {t.type === 'EARN'
            ? <TrendingUp size={13} className="text-emerald-500" />
            : <TrendingDown size={13} className="text-rose-500" />}
          <span className={`font-mono font-semibold tabular-nums ${
            t.type === 'EARN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {t.type === 'EARN' ? '+' : '-'}{Math.abs(t.amount)}
          </span>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (t: TransactionRow) => (
        <span className="text-xs text-muted-foreground">
          {new Date(t.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Points Economy"
          description="Global view of points in circulation and all transactions. Grant or deduct points from individual users via the Users page."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Points in Circulation"
            value={isLoadingStats ? '—' : (stats?.pointsInCirculation ?? 0).toLocaleString()}
            sub="Total across all user balances"
            icon={<Coins size={18} />}
            accent="amber"
          />
          <StatCard
            label="Template Purchases"
            value={isLoadingStats ? '—' : (stats?.totalTemplatePurchases ?? 0).toLocaleString()}
            sub="Points redeemed for templates"
            icon={<TrendingDown size={18} />}
            accent="rose"
          />
          <StatCard
            label="Active Paid Users"
            value={isLoadingStats ? '—' : (
              ((stats?.activeSubscriptions.PROFESSIONAL ?? 0) +
               (stats?.activeSubscriptions.PREMIUM ?? 0)).toLocaleString()
            )}
            sub="Receive monthly point grants"
            icon={<TrendingUp size={18} />}
            accent="emerald"
          />
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">
            {error} — the global transactions endpoint may not be deployed yet. Grant/deduct points via Users page.
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4">Transaction Ledger</h2>
        <AdminTable
          columns={columns}
          rows={transactions}
          rowKey={(t) => t.id}
          isLoading={isLoadingTx}
          emptyMessage="No transactions yet."
        />
      </div>
  );
}
