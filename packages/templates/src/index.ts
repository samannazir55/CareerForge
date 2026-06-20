export type { TemplateRenderer, TemplateMetadata } from './types';
export { getTemplate, getAllTemplateMetadata, isPremiumTemplate } from './registry';
// Individual templates exported for direct use in tests or tooling
export { modernTemplate } from './modern';
export { classicTemplate } from './classic';
