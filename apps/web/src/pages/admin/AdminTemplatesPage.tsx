import { useEffect, useState } from 'react';
import { LayoutTemplate, Eye, EyeOff, Pencil } from 'lucide-react';
import {
  PageHeader, AdminTable, AdminBadge,
  SlideOver, FormField,
} from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { adminApi } from '../../lib/adminApi';
import type { AdminTemplateRow } from '@careerforge/schema';

export function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<AdminTemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminTemplateRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [formCategory, setFormCategory] = useState<'free' | 'premium'>('free');
  const [formCost, setFormCost] = useState('0');
  const [formActive, setFormActive] = useState(true);
  const [formOrder, setFormOrder] = useState('0');
  const [formThumbnail, setFormThumbnail] = useState('');

  function load() {
    setIsLoading(true);
    adminApi.listTemplates()
      .then((d) => setTemplates(d.templates))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  function openEdit(template: AdminTemplateRow) {
    const l = template.listing;
    setFormCategory(l?.category ?? template.codeCategory);
    setFormCost(String(l?.pointsCost ?? 0));
    setFormActive(l?.isActive ?? true);
    setFormOrder(String(l?.displayOrder ?? 0));
    setFormThumbnail(l?.thumbnailUrl ?? '');
    setSaveError(null);
    setEditTarget(template);
  }

  async function handleSave() {
    if (!editTarget) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await adminApi.updateTemplate(editTarget.id, {
        category: formCategory,
        pointsCost: parseInt(formCost, 10) || 0,
        isActive: formActive,
        displayOrder: parseInt(formOrder, 10) || 0,
        thumbnailUrl: formThumbnail || undefined,
      });
      await load();
      setEditTarget(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(template: AdminTemplateRow) {
    const currentActive = template.listing?.isActive ?? true;
    try {
      await adminApi.updateTemplate(template.id, { isActive: !currentActive });
      await load();
    } catch {
      // Refresh to show real state
      load();
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Template',
      render: (t: AdminTemplateRow) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center shrink-0">
            <LayoutTemplate size={16} className="text-indigo-500" />
          </div>
          <div>
            <p className="font-medium">{t.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{t.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (t: AdminTemplateRow) => {
        const cat = t.listing?.category ?? t.codeCategory;
        return <AdminBadge variant={cat === 'premium' ? 'amber' : 'green'}>{cat}</AdminBadge>;
      },
    },
    {
      key: 'cost',
      label: 'Point Cost',
      render: (t: AdminTemplateRow) => (
        <span className="font-mono text-sm">{t.listing?.pointsCost ?? 0} pts</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (t: AdminTemplateRow) => {
        const active = t.listing?.isActive ?? true;
        return <AdminBadge variant={active ? 'green' : 'red'}>{active ? 'Active' : 'Hidden'}</AdminBadge>;
      },
    },
    {
      key: 'order',
      label: 'Order',
      render: (t: AdminTemplateRow) => (
        <span className="text-muted-foreground text-sm">{t.listing?.displayOrder ?? 0}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (t: AdminTemplateRow) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleToggleActive(t); }}
            title={t.listing?.isActive ?? true ? 'Hide from marketplace' : 'Show in marketplace'}
          >
            {t.listing?.isActive ?? true ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(t); }}>
            <Pencil size={13} className="mr-1.5" /> Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Templates"
          description="Manage visibility, pricing, and ordering for all registered templates. Add new templates by registering a TemplateRenderer in packages/templates."
        />

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">{error}</div>
        )}

        <div className="mb-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">
          <strong>Note:</strong> Template render logic (PDF/DOCX generation) lives in <code className="font-mono text-xs bg-amber-500/10 px-1 py-0.5 rounded">packages/templates</code> and requires a code change to add new templates. This panel manages display metadata only.
        </div>

        <AdminTable
          columns={columns}
          rows={templates}
          rowKey={(t) => t.id}
          isLoading={isLoading}
          emptyMessage="No templates registered."
          onRowClick={openEdit}
        />
      </div>

      <SlideOver
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Edit: ${editTarget?.name}`}
        description="These settings override the code defaults from the template registry."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <FormField label="Category" hint="Overrides the category set in the template's code definition.">
          <select
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value as 'free' | 'premium')}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </FormField>

        <FormField label="Point Cost" hint="Set to 0 for free templates. Ignored for premium-plan subscribers.">
          <input
            type="number"
            min="0"
            value={formCost}
            onChange={(e) => setFormCost(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Display Order" hint="Lower numbers appear first in the marketplace.">
          <input
            type="number"
            value={formOrder}
            onChange={(e) => setFormOrder(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Thumbnail URL" hint="Optional. Shown in marketplace preview cards.">
          <input
            type="url"
            value={formThumbnail}
            onChange={(e) => setFormThumbnail(e.target.value)}
            placeholder="https://cdn.example.com/template-preview.png"
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Visibility">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setFormActive((a) => !a)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${formActive ? 'bg-indigo-500' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${formActive ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm">{formActive ? 'Visible in marketplace' : 'Hidden from marketplace'}</span>
          </label>
        </FormField>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </SlideOver>
    </>
  );
}