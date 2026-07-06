import { useEffect, useState, useCallback } from 'react';
import { Users, Coins, ShieldCheck, Shield } from 'lucide-react';
import {
  PageHeader, AdminTable, AdminBadge,
  SlideOver, FormField, SearchBar,
} from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { adminApi } from '../../lib/adminApi';
import type { AdminUserRow } from '@careerforge/schema';

type TierFilter = 'ALL' | 'FREE' | 'PROFESSIONAL' | 'PREMIUM';
type RoleFilter = 'ALL' | 'USER' | 'ADMIN';

const TIER_BADGE: Record<string, 'gray' | 'blue' | 'amber'> = {
  FREE: 'gray',
  PROFESSIONAL: 'blue',
  PREMIUM: 'amber',
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  // Action panel
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [slideMode, setSlideMode] = useState<'points' | 'role' | null>(null);
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN'>('USER');
  const [isActioning, setIsActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.listUsers({
        search: search || undefined,
        tier: tierFilter !== 'ALL' ? tierFilter : undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setUsers(result.users);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [search, tierFilter, roleFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load]);

  function openPointsPanel(user: AdminUserRow) {
    setSelected(user);
    setPointsAmount('');
    setPointsReason('');
    setActionError(null);
    setActionSuccess(null);
    setSlideMode('points');
  }

  function openRolePanel(user: AdminUserRow) {
    setSelected(user);
    setNewRole(user.role === 'ADMIN' ? 'USER' : 'ADMIN');
    setActionError(null);
    setActionSuccess(null);
    setSlideMode('role');
  }

  async function handleGrantPoints() {
    if (!selected) return;
    const amount = parseInt(pointsAmount, 10);
    if (!amount || !pointsReason.trim()) {
      setActionError('Amount and reason are both required.');
      return;
    }
    setIsActioning(true);
    setActionError(null);
    try {
      const { newBalance } = await adminApi.grantPoints({
        userId: selected.id,
        amount,
        reason: pointsReason.trim(),
      });
      setActionSuccess(`Done. New balance: ${newBalance} points.`);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleUpdateRole() {
    if (!selected) return;
    setIsActioning(true);
    setActionError(null);
    try {
      await adminApi.updateUserRole({ userId: selected.id, role: newRole });
      setActionSuccess(`Role updated to ${newRole}.`);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setIsActioning(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (u: AdminUserRow) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
            {u.fullName?.[0] ?? u.email[0]}
          </div>
          <div>
            <p className="font-medium text-sm">{u.fullName ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'tier',
      label: 'Plan',
      render: (u: AdminUserRow) => (
        <AdminBadge variant={TIER_BADGE[u.subscriptionTier] ?? 'gray'}>
          {u.subscriptionTier.toLowerCase()}
        </AdminBadge>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (u: AdminUserRow) => (
        u.role === 'ADMIN'
          ? <AdminBadge variant="purple"><ShieldCheck size={10} className="mr-1 inline" />Admin</AdminBadge>
          : <span className="text-xs text-muted-foreground">User</span>
      ),
    },
    {
      key: 'points',
      label: 'Points',
      render: (u: AdminUserRow) => (
        <span className="font-mono text-sm text-amber-600 dark:text-amber-400">
          {u.pointsBalance.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'resumes',
      label: 'Resumes',
      render: (u: AdminUserRow) => (
        <span className="text-sm text-muted-foreground">{u.resumeCount}</span>
      ),
    },
    {
      key: 'joined',
      label: 'Joined',
      render: (u: AdminUserRow) => (
        <span className="text-xs text-muted-foreground">
          {new Date(u.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (u: AdminUserRow) => (
        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => openPointsPanel(u)} title="Adjust points">
            <Coins size={13} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openRolePanel(u)} title="Change role">
            <Shield size={13} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Users"
          description={`${total.toLocaleString()} total users`}
        />

        {/* Filters row */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search by name or email…"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['ALL', 'FREE', 'PROFESSIONAL', 'PREMIUM'] as TierFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTierFilter(t); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tierFilter === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'ALL' ? 'All tiers' : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {(['ALL', 'USER', 'ADMIN'] as RoleFilter[]).map((r) => (
              <button
                key={r}
                onClick={() => { setRoleFilter(r); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  roleFilter === r ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === 'ALL' ? 'All roles' : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">{error}</div>
        )}

        <AdminTable
          columns={columns}
          rows={users}
          rowKey={(u) => u.id}
          isLoading={isLoading}
          emptyMessage="No users match your filters."
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Points adjustment panel */}
      <SlideOver
        open={slideMode === 'points'}
        onClose={() => setSlideMode(null)}
        title="Adjust Points"
        description={selected ? `${selected.fullName ?? selected.email} · ${selected.pointsBalance} points` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlideMode(null)} disabled={isActioning}>Cancel</Button>
            <Button onClick={handleGrantPoints} disabled={isActioning}>
              {isActioning ? 'Saving…' : 'Apply adjustment'}
            </Button>
          </>
        }
      >
        <FormField label="Amount" hint="Positive = grant points. Negative = deduct points." required>
          <input
            type="number"
            value={pointsAmount}
            onChange={(e) => setPointsAmount(e.target.value)}
            placeholder="e.g. 500 or -100"
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
        <FormField label="Reason" hint="Appears in the audit log and the user's transaction history." required>
          <input
            value={pointsReason}
            onChange={(e) => setPointsReason(e.target.value)}
            placeholder="Support ticket #1234 — compensation for failed export"
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        {actionSuccess && <p className="text-sm text-emerald-500">{actionSuccess}</p>}
      </SlideOver>

      {/* Role change panel */}
      <SlideOver
        open={slideMode === 'role'}
        onClose={() => setSlideMode(null)}
        title="Change Role"
        description={selected ? `${selected.fullName ?? selected.email} · currently ${selected?.role}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlideMode(null)} disabled={isActioning}>Cancel</Button>
            <Button
              onClick={handleUpdateRole}
              disabled={isActioning}
              className={newRole === 'ADMIN' ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-0' : ''}
            >
              {isActioning ? 'Saving…' : `Set as ${newRole.toLowerCase()}`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {(['USER', 'ADMIN'] as const).map((role) => (
            <label
              key={role}
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-colors ${
                newRole === role ? 'border-indigo-500 bg-indigo-500/5' : 'border-border hover:border-border/80'
              }`}
            >
              <input
                type="radio"
                checked={newRole === role}
                onChange={() => setNewRole(role)}
                className="mt-0.5"
              />
              <div>
                <p className="font-semibold flex items-center gap-1.5">
                  {role === 'ADMIN' && <ShieldCheck size={14} className="text-indigo-500" />}
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {role === 'ADMIN'
                    ? 'Full access to this admin panel and all admin API endpoints.'
                    : 'Standard user access. Cannot access admin panel or endpoints.'}
                </p>
              </div>
            </label>
          ))}
        </div>
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        {actionSuccess && <p className="text-sm text-emerald-500">{actionSuccess}</p>}
      </SlideOver>
    </>
  );
}