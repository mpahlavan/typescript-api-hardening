import { TemplateRow } from './types';

// Templates change infrequently, so we cache the full list for 60 seconds
// to avoid hitting the database on every request.
const TEMPLATES_CACHE_TTL_MS = 60 * 1000;

let templatesCache: TemplateRow[] | null = null;
let templatesCacheLoadedAt: number | null = null;

export function isTemplateCacheValid(): boolean {
  return (
    templatesCache !== null &&
    templatesCacheLoadedAt !== null &&
    Date.now() - templatesCacheLoadedAt < TEMPLATES_CACHE_TTL_MS
  );
}

export function getTemplatesCache(): TemplateRow[] | null {
  return templatesCache;
}

export function setTemplatesCache(rows: TemplateRow[]): void {
  templatesCache = rows;
  templatesCacheLoadedAt = Date.now();
}

// Call this after any write (create, update, delete) so the next read reflects the change
export function invalidateTemplatesCache(): void {
  templatesCache = null;
  templatesCacheLoadedAt = null;
}
