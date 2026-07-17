import { useEffect, useState } from 'react';
import { Plus, Ticket, Send, Trash2, Copy, Check } from 'lucide-react';
import {
  PageHeader, AdminTable, AdminBadge,
  SlideOver, FormField,
} from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { adminApi } from '../../lib/adminApi';
import type { PromoCode, CreatePromoCodeRequest, PromoAudience } from '@careerforge/schema';

const EMPTY_FORM: CreatePromoCodeRequest = {
  code: '',
  pointsValue: 100,
  description: '',
  maxRedemptions: undefined,
  perUserLimit: 1,
  expiresAt: undefined,
  isActive: true,
};

const AUDIENCES: { id: PromoAudience; label: string }[] = [
  { id: 'ALL', label: 'All users' },
  { id: 'FREE', label: 'Free tier' },
  { id: 'PROFESSIONAL', label: 'Professional tier' },
  { id: 'PREMIUM', label: 'Premium tier' },
];

export function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/edit slide-over
  const [slideOpen, setSlideOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePromoCodeRequest>(EMPTY_FORM);

  // Send campaign slide-over
  const [sendTarget, setSendTarget] = useState<PromoCode | null>(null);
  const [audience, setAudience] = useState<PromoAudience>('ALL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ recipientCount: number; emailsSent: number; emailsFailed: number } | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    adminApi.listPromoCodes()
      .then((d) => setCodes(d.promoCodes))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load promo codes.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setSaveError(null);
    setSlideOpen(true);
  }

  function openSend(code: PromoCode) {
    setSendTarget(code);
    setAudience('ALL');
    setSubject(`🎉 Here's ${code.pointsValue} free points`);
    setMessage(`Use the code below to claim ${code.pointsValue} free points on us.`);
    setSendError(null);
    setSendResult(null);
  }

  const f = (key: keyof CreatePromoCodeRequest, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  async function handleCreate() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await adminApi.createPromoCode({
        ...form,
        code: form.code.trim().toUpperCase(),
        description: form.description || undefined,
        expiresAt: form.expiresAt || undefined,
      });
      await load();
      setSlideOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create promo code.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate(code: PromoCode) {
    if (!window.confirm(`Deactivate "${code.code}"? It will stop working immediately.`)) return;
    try {
      await adminApi.deactivatePromoCode(code.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate.');
    }
  }

  async function handleSend() {
    if (!sendTarget) return;
    setIsSending(true);
    setSendError(null);
    try {
      const result = await adminApi.sendPromoCampaign(sendTarget.id, { audience, subject, message });
      setSendResult(result);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send campaign.');
    } finally {
      setIsSending(false);
    }
  }

  function copyCode(code: PromoCode) {
    navigator.clipboard.writeText(code.code).then(() => {
      setCopiedId(code.id);
      setTimeout(() => setCopiedId((id) => (id === code.id ? null : id)), 1500);
    });
  }

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (c: PromoCode) => (
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center shrink-0">
            <Ticket size={16} className="text-amber-500" />
          </div>
          <div>
            <p className="font-mono font-semibold">{c.code}</p>
            {c.description && <p className="text-xs text-muted-foreground max-w-[220px] truncate">{c.description}</p>}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); copyCode(c); }}
            className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-accent transition-colors ml-1"
            title="Copy code"
          >
            {copiedId === c.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-muted-foreground" />}
          </button>
        </div>
      ),
    },
    {
      key: 'points',
      label: 'Points',
      render: (c: PromoCode) => (
        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">+{c.pointsValue}</span>
      ),
    },
    {
      key: 'redemptions',
      label: 'Redemptions',
      render: (c: PromoCode) => (
        <span className="text-sm text-muted-foreground">
          {c.redemptionCount}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
        </span>
      ),
    },
    {
      key: 'perUser',
      label: 'Per user',
      render: (c: PromoCode) => <span className="text-sm text-muted-foreground">{c.perUserLimit}</span>,
    },
    {
      key: 'expires',
      label: 'Expires',
      render: (c: PromoCode) => (
        <span className="text-xs text-muted-foreground">
          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (c: PromoCode) => (
        <AdminBadge variant={c.isActive ? 'green' : 'red'}>{c.isActive ? 'Active' : 'Inactive'}</AdminBadge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (c: PromoCode) => (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openSend(c); }} disabled={!c.isActive}>
            <Send size={13} className="mr-1.5" /> Send
          </Button>
          {c.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleDeactivate(c); }}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Promo Codes"
          description="Create codes that grant subscribers bonus points, then email + notify a segment of users in one click (e.g. a New Year campaign)."
          action={
            <Button onClick={openCreate}>
              <Plus size={15} className="mr-1.5" /> New code
            </Button>
          }
        />

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">{error}</div>
        )}

        <AdminTable
          columns={columns}
          rows={codes}
          rowKey={(c) => c.id}
          isLoading={isLoading}
          emptyMessage="No promo codes yet. Create one to run your first points campaign."
        />
      </div>

      {/* Create promo code */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title="New Promo Code"
        description="Once created, use “Send” from the table to email it to your subscribers."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlideOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving || !form.code.trim() || form.pointsValue < 1}>
              {isSaving ? 'Creating…' : 'Create code'}
            </Button>
          </>
        }
      >
        <FormField label="Code" required hint="Letters, numbers, - and _ only. Stored uppercase.">
          <input
            value={form.code}
            onChange={(e) => f('code', e.target.value.toUpperCase())}
            placeholder="NEWYEAR2027"
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Points value" required>
          <input
            type="number"
            min="1"
            value={form.pointsValue}
            onChange={(e) => f('pointsValue', parseInt(e.target.value) || 0)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Description" hint="Shown in the user's points history and the campaign email.">
          <input
            value={form.description ?? ''}
            onChange={(e) => f('description', e.target.value)}
            placeholder="New Year gift — free points"
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Per-user limit" hint="How many times one user can redeem it.">
            <input
              type="number"
              min="1"
              value={form.perUserLimit}
              onChange={(e) => f('perUserLimit', parseInt(e.target.value) || 1)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
          <FormField label="Max total redemptions" hint="Leave blank for unlimited.">
            <input
              type="number"
              min="1"
              value={form.maxRedemptions ?? ''}
              onChange={(e) => f('maxRedemptions', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Unlimited"
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
        </div>

        <FormField label="Expires" hint="Leave blank for a code that never expires.">
          <input
            type="date"
            value={form.expiresAt ? form.expiresAt.slice(0, 10) : ''}
            onChange={(e) => f('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </SlideOver>

      {/* Send campaign */}
      <SlideOver
        open={sendTarget !== null}
        onClose={() => setSendTarget(null)}
        title={`Send "${sendTarget?.code ?? ''}"`}
        description="Emails the code to every matching user and drops an in-dashboard notification for each of them."
        footer={
          sendResult ? (
            <Button onClick={() => setSendTarget(null)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setSendTarget(null)} disabled={isSending}>Cancel</Button>
              <Button onClick={handleSend} disabled={isSending || !subject.trim() || !message.trim()}>
                {isSending ? 'Sending…' : 'Send campaign'}
              </Button>
            </>
          )
        }
      >
        {sendResult ? (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-sm">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Campaign sent</p>
            <p className="text-muted-foreground">
              {sendResult.recipientCount} matching users · {sendResult.emailsSent} emails sent
              {sendResult.emailsFailed > 0 && `, ${sendResult.emailsFailed} failed`} · in-dashboard notifications delivered to all of them.
            </p>
          </div>
        ) : (
          <>
            <FormField label="Audience" required>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as PromoAudience)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </FormField>

            <FormField label="Email subject" required>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </FormField>

            <FormField label="Message" required hint="The code, point value, and expiry are appended automatically.">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </FormField>

            {sendError && <p className="text-sm text-destructive">{sendError}</p>}
          </>
        )}
      </SlideOver>
    </>
  );
}
