import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/blog" or "/blog/my-post". */
  canonical: string;
  image?: string;
}

const SITE_NAME = 'Corvyx';
const SITE_URL = 'https://corvyx.app';

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Lightweight, dependency-free per-page <head> manager for public marketing
 * pages (blog index/post today). Mutates the document's existing
 * <title>/<meta> tags in place on mount and restores the previous title on
 * unmount, so navigating from a blog post to, say, the dashboard never
 * leaves a stale blog title/description behind.
 *
 * Deliberately not react-helmet(-async): this app has no SSR, so there's no
 * need for the string-rendering/dedupe machinery that library exists for —
 * a handful of imperative DOM writes covers everything crawlers and social
 * unfurlers actually read from a client-rendered page.
 */
export function SEO({ title, description, canonical, image }: SEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    const fullTitle = `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', `${SITE_URL}${canonical}`);
    if (image) setMetaTag('property', 'og:image', image);
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);

    setCanonicalLink(`${SITE_URL}${canonical}`);

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, canonical, image]);

  return null;
}
