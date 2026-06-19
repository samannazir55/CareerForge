export type { TemplateRenderer, TemplateMetadata } from './types.js';
export { getTemplate, getAllTemplateMetadata, isPremiumTemplate } from './registry.js';
// Individual templates exported for direct use in tests or tooling
export { modernTemplate } from './modern.js';
export { classicTemplate } from './classic.js';
