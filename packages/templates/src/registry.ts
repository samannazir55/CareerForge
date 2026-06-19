import type { TemplateRenderer, TemplateMetadata } from './types.js';
import { modernTemplate } from './modern.js';
import { classicTemplate } from './classic.js';

/**
 * The template registry is the single source of truth for which templates
 * exist and what their capabilities are. Adding a new template means:
 * 1. Create its .ts file (renderHtml + buildDocx)
 * 2. Import it here and add it to REGISTRY
 * Nothing else changes — the export service, premium gating, and marketplace
 * all derive their knowledge of templates from this registry at runtime.
 */
const REGISTRY: Map<string, TemplateRenderer> = new Map([
  [modernTemplate.id, modernTemplate],
  [classicTemplate.id, classicTemplate],
]);

export function getTemplate(templateId: string): TemplateRenderer {
  const template = REGISTRY.get(templateId);
  if (!template) {
    // Graceful fallback: if a user's saved templateId no longer exists
    // (e.g. a premium template was removed), render with Modern rather
    // than throwing a 500. The export service logs a warning.
    const fallback = REGISTRY.get('modern');
    if (!fallback) throw new Error('Template registry is empty — this is a bug.');
    return fallback;
  }
  return template;
}

export function getAllTemplateMetadata(): TemplateMetadata[] {
  return Array.from(REGISTRY.values()).map(({ id, name, category, previewClass }) => ({
    id,
    name,
    category,
    previewClass,
  }));
}

export function isPremiumTemplate(templateId: string): boolean {
  return REGISTRY.get(templateId)?.category === 'premium';
}
