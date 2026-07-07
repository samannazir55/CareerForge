import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, Eye, EyeOff, Pencil, Plus, Sparkles, Trash2, RefreshCw } from 'lucide-react';
import {
  PageHeader, AdminTable, AdminBadge,
  SlideOver, FormField,
} from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { adminApi, type DynamicTemplate } from '../../lib/adminApi';
import type { AdminTemplateRow } from '@careerforge/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'code' | 'dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = ['free', 'premium'];

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Dynamic Template Preview iframe
// ---------------------------------------------------------------------------

function TemplatePreviewFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && html) {
      // POST to preview endpoint and inject result into iframe srcdoc
      fetch('/api/admin/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html }),
      })
        .then((r) => r.text())
        .then((rendered) => {
          if (iframeRef.current) iframeRef.current.srcdoc = rendered;
        })
        .catch(() => undefined);
    }
  }, [html]);

  return (
    <div className="relative w-full rounded-xl border border-border overflow-hidden bg-white" style={{ height: 420 }}>
      <iframe
        ref={iframeRef}
        title="Template preview"
        sandbox=""
        style={{
          width: 794,
          height: 1123,
          border: 'none',
          transformOrigin: 'top left',
          transform: `scale(${420 / 1123})`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit Dynamic Template SlideOver
// ---------------------------------------------------------------------------

interface DynamicTemplateSlideOverProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editTarget?: DynamicTemplate | null;
}

function DynamicTemplateSlideOver({ open, onClose, onSaved, editTarget }: DynamicTemplateSlideOverProps) {
  const isEdit = Boolean(editTarget);

  // Prompt step
  const [prompt, setPrompt]   = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Template fields
  const [name, setName]             = useState('');
  const [slug, setSlug]             = useState('');
  const [category, setCategory]     = useState<'free' | 'premium'>('free');
  const [pointsCost, setPointsCost] = useState('0');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [isActive, setIsActive]     = useState(true);
  const [promptUsed, setPromptUsed] = useState('');

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [previewKey, setPreviewKey]   = useState(0); // bump to force re-render
  const [isSaving, setIsSaving]       = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  // Populate form when editing an existing template
  useEffect(() => {
    if (editTarget) {
      setName(editTarget.name);
      setSlug(editTarget.slug);
      setCategory(editTarget.category as 'free' | 'premium');
      setPointsCost(String(editTarget.pointsCost));
      setDisplayOrder(String(editTarget.displayOrder));
      setThumbnailUrl(editTarget.thumbnailUrl ?? '');
      setTemplateHtml(editTarget.templateHtml);
      setIsActive(editTarget.isActive);
      setPromptUsed(editTarget.promptUsed ?? '');
      setShowPreview(false);
      setPrompt('');
    } else {
      // Reset for create
      setPrompt('');
      setName('');
      setSlug('');
      setCategory('free');
      setPointsCost('0');
      setDisplayOrder('0');
      setThumbnailUrl('');
      setTemplateHtml('');
      setIsActive(true);
      setPromptUsed('');
      setShowPreview(false);
    }
    setGenerateError(null);
    setSaveError(null);
  }, [editTarget, open]);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const result = await adminApi.generateTemplate(prompt.trim());
      setName(result.name);
      setSlug(result.slug);
      setCategory(result.category as 'free' | 'premium');
      setTemplateHtml(result.html);
      setPromptUsed(prompt.trim());
      setShowPreview(true);
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generation failed. Try a more specific prompt.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !slug.trim() || !templateHtml.trim()) {
      setSaveError('Name, slug, and template HTML are required.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      if (isEdit && editTarget) {
        await adminApi.updateDynamicTemplate(editTarget.id, {
          name, slug, category,
          pointsCost:   parseInt(pointsCost,   10) || 0,
          displayOrder: parseInt(displayOrder, 10) || 0,
          thumbnailUrl: thumbnailUrl || undefined,
          templateHtml,
          isActive,
        });
      } else {
        await adminApi.createDynamicTemplate({
          name, slug, category,
          templateHtml,
          thumbnailUrl:  thumbnailUrl  || undefined,
          pointsCost:    parseInt(pointsCost,   10) || 0,
          displayOrder:  parseInt(displayOrder, 10) || 0,
          isActive:      true,
          promptUsed:    promptUsed || undefined,
        } as any);
      }
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }

  const hasHtml = templateHtml.trim().length > 0;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit: ${editTarget?.name}` : 'Add Template with AI'}
      description={
        isEdit
          ? 'Update the template fields or regenerate the HTML with a new prompt.'
          : 'Describe the visual style and the AI will generate a complete HTML template. Review and save when ready.'
      }
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving || isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isGenerating || !hasHtml}>
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Save template'}
          </Button>
        </>
      }
    >
      {/* ── AI Prompt ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <FormField
          label="AI Prompt"
          hint='Describe the visual style — colours, layout, tone. E.g. "A dark navy executive template with gold accents and a two-column layout, serif headings."'
        >
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the template style you want…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </FormField>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full gap-2"
          variant={hasHtml ? 'outline' : 'default'}
        >
          <Sparkles size={14} />
          {isGenerating
            ? 'Generating template…'
            : hasHtml
            ? 'Regenerate with new prompt'
            : 'Generate template'}
        </Button>
        {generateError && (
          <p className="text-xs text-destructive">{generateError}</p>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border my-2" />

      {/* ── Template fields (always shown; editable after generation) ───── */}
      <FormField label="Template Name" hint="Shown in the marketplace and admin panel.">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!isEdit) setSlug(slugify(e.target.value));
          }}
          placeholder="e.g. Executive Dark"
          className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </FormField>

      <FormField label="Slug" hint="Used as the templateId in resumes. Lowercase, hyphens only. Cannot match a built-in template slug.">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          placeholder="e.g. executive-dark"
          className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as 'free' | 'premium')}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Point Cost">
          <input
            type="number"
            min="0"
            value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Display Order" hint="Lower = appears first.">
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Thumbnail URL" hint="Optional preview image.">
          <input
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://…"
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
      </div>

      {/* ── HTML editor ─────────────────────────────────────────────────── */}
      <FormField
        label="Template HTML"
        hint="Generated by AI, or paste your own. Uses {{name}}, {{#experiences}}…{{/experiences}} etc."
      >
        <textarea
          rows={8}
          value={templateHtml}
          onChange={(e) => { setTemplateHtml(e.target.value); setShowPreview(false); }}
          placeholder="AI-generated HTML will appear here, or paste your own…"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </FormField>

      {/* ── Preview toggle ───────────────────────────────────────────────── */}
      {hasHtml && (
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => { setShowPreview((v) => !v); setPreviewKey((k) => k + 1); }}
          >
            <Eye size={14} />
            {showPreview ? 'Hide preview' : 'Show preview with sample data'}
          </Button>
          {showPreview && <TemplatePreviewFrame key={previewKey} html={templateHtml} />}
        </div>
      )}

      {isEdit && (
        <FormField label="Visibility">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsActive((a) => !a)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-indigo-500' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${isActive ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm">{isActive ? 'Visible in marketplace' : 'Hidden from marketplace'}</span>
          </label>
        </FormField>
      )}

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
    </SlideOver>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function AdminTemplatesPage() {
  const [tab, setTab]                     = useState<Tab>('code');
  const [codeTemplates, setCodeTemplates] = useState<AdminTemplateRow[]>([]);
  const [dynamicTemplates, setDynamicTemplates] = useState<DynamicTemplate[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // Code template edit
  const [editTarget, setEditTarget]       = useState<AdminTemplateRow | null>(null);
  const [isSaving, setIsSaving]           = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [formCategory, setFormCategory]   = useState<'free' | 'premium'>('free');
  const [formCost, setFormCost]           = useState('0');
  const [formActive, setFormActive]       = useState(true);
  const [formOrder, setFormOrder]         = useState('0');
  const [formThumbnail, setFormThumbnail] = useState('');

  // Dynamic template create/edit
  const [dynamicSlideOver, setDynamicSlideOver] = useState(false);
  const [dynamicEditTarget, setDynamicEditTarget] = useState<DynamicTemplate | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget]   = useState<DynamicTemplate | null>(null);
  const [isDeleting, setIsDeleting]       = useState(false);

  function load() {
    setIsLoading(true);
    adminApi.listTemplates()
      .then((d) => {
        setCodeTemplates(d.templates);
        setDynamicTemplates(d.dynamicTemplates ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  // ── Code template handlers ───────────────────────────────────────────────

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
        category:     formCategory,
        pointsCost:   parseInt(formCost, 10) || 0,
        isActive:     formActive,
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
      load();
    }
  }

  // ── Dynamic template handlers ────────────────────────────────────────────

  async function handleDeleteDynamic() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteDynamicTemplate(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch {
      load();
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Code template columns ────────────────────────────────────────────────

  const codeColumns = [
    {
      key: 'name', label: 'Template',
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
      key: 'category', label: 'Category',
      render: (t: AdminTemplateRow) => {
        const cat = t.listing?.category ?? t.codeCategory;
        return <AdminBadge variant={cat === 'premium' ? 'amber' : 'green'}>{cat}</AdminBadge>;
      },
    },
    {
      key: 'cost', label: 'Point Cost',
      render: (t: AdminTemplateRow) => (
        <span className="font-mono text-sm">{t.listing?.pointsCost ?? 0} pts</span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (t: AdminTemplateRow) => {
        const active = t.listing?.isActive ?? true;
        return <AdminBadge variant={active ? 'green' : 'red'}>{active ? 'Active' : 'Hidden'}</AdminBadge>;
      },
    },
    {
      key: 'order', label: 'Order',
      render: (t: AdminTemplateRow) => (
        <span className="text-muted-foreground text-sm">{t.listing?.displayOrder ?? 0}</span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (t: AdminTemplateRow) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost" size="sm"
            onClick={(e) => { e.stopPropagation(); handleToggleActive(t); }}
            title={t.listing?.isActive ?? true ? 'Hide' : 'Show'}
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

  // ── Dynamic template columns ─────────────────────────────────────────────

  const dynamicColumns = [
    {
      key: 'name', label: 'Template',
      render: (t: DynamicTemplate) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500/15 to-pink-500/15 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-violet-500" />
          </div>
          <div>
            <p className="font-medium">{t.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category', label: 'Category',
      render: (t: DynamicTemplate) => (
        <AdminBadge variant={t.category === 'premium' ? 'amber' : 'green'}>{t.category}</AdminBadge>
      ),
    },
    {
      key: 'cost', label: 'Point Cost',
      render: (t: DynamicTemplate) => (
        <span className="font-mono text-sm">{t.pointsCost} pts</span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (t: DynamicTemplate) => (
        <AdminBadge variant={t.isActive ? 'green' : 'red'}>{t.isActive ? 'Active' : 'Hidden'}</AdminBadge>
      ),
    },
    {
      key: 'source', label: 'Source',
      render: (t: DynamicTemplate) => (
        <span className="text-xs text-muted-foreground">
          {t.promptUsed ? '✦ AI-generated' : 'Hand-crafted'}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (t: DynamicTemplate) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost" size="sm"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 size={14} />
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={(e) => { e.stopPropagation(); setDynamicEditTarget(t); setDynamicSlideOver(true); }}
          >
            <Pencil size={13} className="mr-1.5" /> Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <PageHeader
            title="Templates"
            description="Manage code-registered templates and create new AI-generated ones without a deployment."
          />
          <Button
            onClick={() => { setDynamicEditTarget(null); setDynamicSlideOver(true); }}
            className="shrink-0 gap-2 ml-4 mt-1"
          >
            <Plus size={15} />
            Add Template
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">{error}</div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-muted w-fit">
          {(['code', 'dynamic'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'code' ? `Built-in (${codeTemplates.length})` : `AI-created (${dynamicTemplates.length})`}
            </button>
          ))}
        </div>

        {/* ── Code templates tab ── */}
        {tab === 'code' && (
          <>
            <div className="mb-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> These templates are defined in{' '}
              <code className="font-mono text-xs bg-amber-500/10 px-1 py-0.5 rounded">packages/templates</code>{' '}
              and require a code change to add new ones. Use the <strong>AI-created</strong> tab to add templates without deploying.
            </div>
            <AdminTable
              columns={codeColumns}
              rows={codeTemplates}
              rowKey={(t) => t.id}
              isLoading={isLoading}
              emptyMessage="No built-in templates registered."
              onRowClick={openEdit}
            />
          </>
        )}

        {/* ── Dynamic templates tab ── */}
        {tab === 'dynamic' && (
          <>
            {dynamicTemplates.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <Sparkles size={24} className="text-violet-500" />
                </div>
                <p className="font-semibold text-lg mb-1">No AI-created templates yet</p>
                <p className="text-sm text-muted-foreground max-w-xs mb-5">
                  Click <strong>Add Template</strong> to describe a style and let the AI generate a complete HTML template.
                </p>
                <Button onClick={() => { setDynamicEditTarget(null); setDynamicSlideOver(true); }} className="gap-2">
                  <Plus size={14} />Add your first template
                </Button>
              </div>
            ) : (
              <AdminTable
                columns={dynamicColumns}
                rows={dynamicTemplates}
                rowKey={(t) => t.id}
                isLoading={isLoading}
                emptyMessage="No AI-created templates yet."
              />
            )}
          </>
        )}
      </div>

      {/* ── Edit code template SlideOver ── */}
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
        <FormField label="Point Cost" hint="Set to 0 for free templates.">
          <input type="number" min="0" value={formCost}
            onChange={(e) => setFormCost(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
        <FormField label="Display Order" hint="Lower numbers appear first.">
          <input type="number" value={formOrder}
            onChange={(e) => setFormOrder(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
        <FormField label="Thumbnail URL" hint="Optional. Shown in marketplace preview cards.">
          <input type="url" value={formThumbnail}
            onChange={(e) => setFormThumbnail(e.target.value)}
            placeholder="https://cdn.example.com/template-preview.png"
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
        <FormField label="Visibility">
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setFormActive((a) => !a)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${formActive ? 'bg-indigo-500' : 'bg-muted'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${formActive ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm">{formActive ? 'Visible in marketplace' : 'Hidden from marketplace'}</span>
          </label>
        </FormField>
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </SlideOver>

      {/* ── Create / Edit dynamic template SlideOver ── */}
      <DynamicTemplateSlideOver
        open={dynamicSlideOver}
        onClose={() => { setDynamicSlideOver(false); setDynamicEditTarget(null); }}
        onSaved={load}
        editTarget={dynamicEditTarget}
      />

      {/* ── Delete confirm SlideOver ── */}
      <SlideOver
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete template"
        description="This cannot be undone. Resumes using this template will fall back to the default."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button
              onClick={handleDeleteDynamic}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : `Delete "${deleteTarget?.name}"`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          You are about to permanently delete <strong className="text-foreground">{deleteTarget?.name}</strong> (slug: <code className="font-mono text-xs">{deleteTarget?.slug}</code>).
          Any resume that currently uses this template will render with the default template instead.
        </p>
      </SlideOver>
    </>
  );
}
