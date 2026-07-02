import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { PageHeader, AdminTable, AdminBadge } from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { adminApi } from '../../lib/adminApi';
import type { AdminAuditLogEntry } from '@careerforge/schema';

const ACTION_BADGE: Record<string, 'blue' | 'amber' | 'red' | 'green' | 'purple' | 'gray'> = {
  POINTS_GRANT: 'amber',
  PLAN_CREATE: 'green',
  PLAN_UPDATE: 'blue',
  PLAN_DELETE: 'red',
  TEMPLATE_LISTING_UPDATE: 'blue',
  ROLE_CHANGE: 'purple',
};

export function AdminAuditPage() {
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setError(null);
    adminApi.getAuditLog(200)
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load audit log.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const columns = [
    {
      key: 'time',
      label: 'Time',
      render: (e: AdminAuditLogEntry) => (
        <div className="whitespace-nowrap">
          <p className="text-sm font-mono">{new Date(e.createdAt).toLocaleTimeString()}</p>
          <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      key: 'admin',
      label: 'Admin',
      render: (e: AdminAuditLogEntry) => (
        <span className="text-sm text-muted-foreground">{e.adminEmail}</span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (e: AdminAuditLogEntry) => (
        <AdminBadge variant={ACTION_BADGE[e.action] ?? 'gray'}>
          {e.action.replace(/_/g, ' ').toLowerCase()}
        </AdminBadge>
      ),
    },
    {
      key: 'target',
      label: 'Target',
      render: (e: AdminAuditLogEntry) => (
        <div>
          <p className="text-xs font-mono text-muted-foreground">{e.targetType}</p>
          <p className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">{e.targetId}</p>
        </div>
      ),
    },
    {
      key: 'metadata',
      label: 'Details',
      render: (e: AdminAuditLogEntry) => {
        if (!e.metadata) return <span className="text-xs text-muted-foreground">—</span>;
        const meta = e.metadata as Record<string, unknown>;
        const entries = Object.entries(meta).slice(0, 3);
        return (
          <div className="space-y-0.5">
            {entries.map(([k, v]) => (
              <p key={k} className="text-xs text-muted-foreground">
                <span className="font-mono text-foreground/70">{k}:</span>{' '}
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </p>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Audit Log"
          description="All admin mutations — append-only. Every points grant, plan edit, template toggle, and role change is recorded here."
          action={
            <Button variant="outline" onClick={load} disabled={isLoading}>
              <RefreshCw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">{error}</div>
        )}

        {entries.length === 0 && !isLoading && !error && (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <ScrollText size={32} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No admin actions recorded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Actions appear here as soon as an admin makes a change.
            </p>
          </div>
        )}

        {(entries.length > 0 || isLoading) && (
          <AdminTable
            columns={columns}
            rows={entries}
            rowKey={(e) => e.id}
            isLoading={isLoading}
            emptyMessage="No audit entries yet."
          />
        )}
      </div>
    </AdminLayout>
  );
}
