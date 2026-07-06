import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CreditCard, Check } from 'lucide-react';
import {
  PageHeader, AdminTable, AdminBadge,
  SlideOver, FormField, StatCard,
} from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { adminApi } from '../../lib/adminApi';
import type { SubscriptionPlan, UpsertSubscriptionPlanRequest } from '@careerforge/schema';

const EMPTY_FORM: UpsertSubscriptionPlanRequest = {
  tierKey: '',
  name: '',
  priceMonthlyUsd: 0,
  description: '',
  features: [],
  pointsGrantedMonthly: 0,
  stripePriceId: '',
  isActive: true,
  displayOrder: 0,
};

const CORE_TIERS = ['FREE', 'PROFESSIONAL', 'PREMIUM'];

export function AdminPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertSubscriptionPlanRequest>(EMPTY_FORM);
  const [featuresText, setFeaturesText] = useState('');

  function load() {
    setIsLoading(true);
    adminApi.listPlans()
      .then((d) => setPlans(d.plans))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFeaturesText('');
    setEditingId(null);
    setSaveError(null);
    setSlideOpen(true);
  }

  function openEdit(plan: SubscriptionPlan) {
    setForm({
      tierKey: plan.tierKey,
      name: plan.name,
      priceMonthlyUsd: plan.priceMonthlyUsd,
      description: plan.description ?? '',
      features: plan.features,
      pointsGrantedMonthly: plan.pointsGrantedMonthly,
      stripePriceId: plan.stripePriceId ?? '',
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
    });
    setFeaturesText(plan.features.join('\n'));
    setEditingId(plan.id);
    setSaveError(null);
    setSlideOpen(true);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    const payload: UpsertSubscriptionPlanRequest = {
      ...form,
      features: featuresText.split('\n').map((s) => s.trim()).filter(Boolean),
      stripePriceId: form.stripePriceId || undefined,
      description: form.description || undefined,
    };
    try {
      if (editingId) {
        await adminApi.updatePlan(editingId, payload);
      } else {
        await adminApi.createPlan(payload);
      }
      await load();
      setSlideOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(plan: SubscriptionPlan) {
    if (!window.confirm(`Delete "${plan.name}"? This cannot be undone.`)) return;
    setIsDeleting(plan.id);
    try {
      await adminApi.deletePlan(plan.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setIsDeleting(null);
    }
  }

  const f = (key: keyof UpsertSubscriptionPlanRequest, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const columns = [
    {
      key: 'name',
      label: 'Plan',
      render: (p: SubscriptionPlan) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center">
            <CreditCard size={16} className="text-indigo-500" />
          </div>
          <div>
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{p.tierKey}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      render: (p: SubscriptionPlan) => (
        <span className="font-mono font-semibold">
          {p.priceMonthlyUsd === 0 ? 'Free' : `$${p.priceMonthlyUsd.toFixed(2)}/mo`}
        </span>
      ),
    },
    {
      key: 'points',
      label: 'Monthly Points',
      render: (p: SubscriptionPlan) => (
        <span className="font-mono text-sm text-amber-600 dark:text-amber-400">
          {p.pointsGrantedMonthly > 0 ? `+${p.pointsGrantedMonthly}` : '—'}
        </span>
      ),
    },
    {
      key: 'features',
      label: 'Features',
      render: (p: SubscriptionPlan) => (
        <span className="text-muted-foreground text-sm">{p.features.length} listed</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p: SubscriptionPlan) => (
        <AdminBadge variant={p.isActive ? 'green' : 'red'}>
          {p.isActive ? 'Active' : 'Inactive'}
        </AdminBadge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (p: SubscriptionPlan) => (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
            <Pencil size={13} className="mr-1.5" /> Edit
          </Button>
          {!CORE_TIERS.includes(p.tierKey) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
              disabled={isDeleting === p.id}
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
          title="Subscription Plans"
          description="Manage pricing, features, and point grants for each plan. Core tiers (FREE, PROFESSIONAL, PREMIUM) cannot be deleted."
          action={
            <Button onClick={openCreate}>
              <Plus size={15} className="mr-1.5" /> Add Plan
            </Button>
          }
        />

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">{error}</div>
        )}

        {/* Plan overview cards */}
        {!isLoading && plans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {plans.filter((p) => CORE_TIERS.includes(p.tierKey)).map((p) => (
              <StatCard
                key={p.id}
                label={p.name}
                value={p.priceMonthlyUsd === 0 ? 'Free' : `$${p.priceMonthlyUsd}/mo`}
                sub={p.features.length + ' features · ' + (p.pointsGrantedMonthly > 0 ? `+${p.pointsGrantedMonthly} pts/mo` : 'No points')}
                icon={<CreditCard size={18} />}
                accent={p.tierKey === 'PREMIUM' ? 'amber' : p.tierKey === 'PROFESSIONAL' ? 'indigo' : 'gray'}
                onClick={() => openEdit(p)}
              />
            ))}
          </div>
        )}

        <AdminTable
          columns={columns}
          rows={plans}
          rowKey={(p) => p.id}
          isLoading={isLoading}
          emptyMessage="No plans found. Seed the database to create default plans."
          onRowClick={openEdit}
        />
      </div>

      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editingId ? 'Edit Plan' : 'New Plan'}
        description={editingId && CORE_TIERS.includes(form.tierKey)
          ? 'Core tier — tierKey cannot be changed.'
          : 'Create a new subscription plan.'}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlideOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Create plan'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tier Key" required hint="e.g. PRO_ANNUAL. Immutable after creation.">
            <input
              value={form.tierKey}
              onChange={(e) => f('tierKey', e.target.value.toUpperCase())}
              disabled={Boolean(editingId)}
              placeholder="PROFESSIONAL"
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </FormField>
          <FormField label="Display Name" required>
            <input
              value={form.name}
              onChange={(e) => f('name', e.target.value)}
              placeholder="Professional"
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Price (USD/month)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.priceMonthlyUsd}
              onChange={(e) => f('priceMonthlyUsd', parseFloat(e.target.value) || 0)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
          <FormField label="Monthly Points Grant">
            <input
              type="number"
              min="0"
              value={form.pointsGrantedMonthly}
              onChange={(e) => f('pointsGrantedMonthly', parseInt(e.target.value) || 0)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
        </div>

        <FormField label="Description" hint="Shown on pricing cards and dashboard.">
          <input
            value={form.description ?? ''}
            onChange={(e) => f('description', e.target.value)}
            placeholder="For active job seekers who want more."
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField
          label="Features"
          hint="One feature per line. Shown as bullet points on the pricing page."
        >
          <textarea
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            rows={6}
            placeholder={"Unlimited resumes\nAll premium templates\nAdvanced ATS scoring"}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          {featuresText && (
            <ul className="mt-2 space-y-1">
              {featuresText.split('\n').filter(Boolean).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check size={12} className="text-emerald-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </FormField>

        <FormField label="Stripe Price ID" hint="From your Stripe dashboard — links this plan to a real Stripe price for checkout.">
          <input
            value={form.stripePriceId ?? ''}
            onChange={(e) => f('stripePriceId', e.target.value)}
            placeholder="price_1ABC..."
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Display Order" hint="Lower = appears first.">
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) => f('displayOrder', parseInt(e.target.value) || 0)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
          <FormField label="Status">
            <label className="flex items-center gap-3 mt-1 cursor-pointer">
              <div
                onClick={() => f('isActive', !form.isActive)}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${form.isActive ? 'bg-indigo-500' : 'bg-muted'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${form.isActive ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm">{form.isActive ? 'Active' : 'Inactive'}</span>
            </label>
          </FormField>
        </div>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </SlideOver>
    </>
  );
}