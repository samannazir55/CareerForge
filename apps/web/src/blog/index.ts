import { marked } from 'marked';

export type BlogCategory = 'resume' | 'interview' | 'career' | 'linkedin' | 'job-search' | 'ai-tools';

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO date string
  author: string;
  category: BlogCategory;
  readTime: number; // minutes
  tags: string[];
  coverImage?: string;
  content: string; // raw markdown body (frontmatter stripped)
  html: string; // rendered HTML, with id attributes on h2/h3 for the TOC
  toc: TocEntry[];
}

interface Frontmatter {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: BlogCategory;
  readTime: number;
  tags: string[];
  coverImage?: string;
}

/**
 * Minimal, dependency-free frontmatter parser. Deliberately not gray-matter:
 * that package reaches for Node's Buffer under the hood, which isn't
 * available in a browser bundle without extra polyfill config in
 * vite.config.ts — and the `---\nkey: value\n---` blocks we actually write
 * (flat keys, one array field, one numeric field) are simple enough that a
 * few lines of parsing avoid that dependency and the polyfill entirely.
 */
function parseFrontmatter(raw: string): { data: Frontmatter; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('Blog post is missing a frontmatter block.');

  const [, frontmatterBlock, content] = match;
  const data: Record<string, unknown> = {};

  for (const line of frontmatterBlock.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      data[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (/^\d+$/.test(rawValue)) {
      data[key] = Number(rawValue);
    } else {
      data[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }

  return { data: data as unknown as Frontmatter, content: content.trim() };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * marked renders plain `<h2>text</h2>` / `<h3>text</h3>` with no id
 * attribute by default. Post-processing the rendered HTML to add ids (and
 * collect a table of contents at the same time) avoids depending on
 * marked's token-level renderer API, which has changed shape across major
 * versions and isn't worth coupling to for something this mechanical.
 */
function addHeadingIdsAndCollectToc(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const seen = new Set<string>();

  const withIds = html.replace(/<h([23])>(.*?)<\/h\1>/g, (_full, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let id = slugify(text) || `section-${toc.length + 1}`;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${slugify(text)}-${suffix++}`;
    }
    seen.add(id);
    toc.push({ id, text, level: Number(level) as 2 | 3 });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  return { html: withIds, toc };
}

// Vite inlines every matched file's raw text at build time — no runtime
// fetch, no CMS, no server round trip. New posts just need a new .md file
// in ./posts; nothing else needs to change for it to show up.
const rawPosts = import.meta.glob('./posts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export const ALL_POSTS: BlogPost[] = Object.values(rawPosts)
  .map((raw) => {
    const { data, content } = parseFrontmatter(raw);
    const rendered = marked.parse(content, { async: false }) as string;
    const { html, toc } = addHeadingIdsAndCollectToc(rendered);
    return { ...data, content, html, toc };
  })
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function getPost(slug: string): BlogPost | undefined {
  return ALL_POSTS.find((p) => p.slug === slug);
}

export function getPostsByCategory(category: BlogCategory | 'all'): BlogPost[] {
  if (category === 'all') return ALL_POSTS;
  return ALL_POSTS.filter((p) => p.category === category);
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const post = getPost(slug);
  if (!post) return [];
  const sameCategory = ALL_POSTS.filter((p) => p.slug !== slug && p.category === post.category);
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);
  // Backfill with other recent posts if the category alone doesn't have enough.
  const rest = ALL_POSTS.filter((p) => p.slug !== slug && p.category !== post.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

export const CATEGORY_LABELS: Record<BlogCategory, string> = {
  resume: 'Resume',
  interview: 'Interview',
  career: 'Career',
  linkedin: 'LinkedIn',
  'job-search': 'Job Search',
  'ai-tools': 'AI Tools',
};
