import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BadRequestError, BadGatewayError } from './errors.js';

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  description: string; // cleaned plain text, max 5000 chars
  url: string;
}

/**
 * Returns true for any address that shouldn't be reachable from the server
 * — loopback, link-local, private (RFC1918/RFC4193), and other reserved
 * ranges. Used both on the hostname (cheap, catches literal IPs typed
 * straight into the URL) and again on whatever the hostname actually
 * resolves to (catches DNS rebinding / a public-looking hostname that
 * resolves to an internal address).
 */
function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (version === 6) {
    const normalised = address.toLowerCase();
    if (normalised === '::1') return true; // loopback
    if (normalised.startsWith('fe80:')) return true; // link-local
    if (normalised.startsWith('fc') || normalised.startsWith('fd')) return true; // unique local
    if (normalised.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 — check the embedded v4 address too
      return isBlockedAddress(normalised.slice('::ffff:'.length));
    }
    return false;
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

/**
 * Fetches a job listing URL and extracts the relevant text content.
 * Works for most job boards (LinkedIn, Indeed, Glassdoor, Greenhouse,
 * Lever, Workday, company career pages) by extracting the largest
 * meaningful text block on the page.
 *
 * This is best-effort — some sites block scraping. When scraping fails
 * we throw, and the caller (the /ai/scrape-job route) surfaces a message
 * telling the user to paste the description manually instead.
 */
export async function scrapeJobUrl(rawUrl: string): Promise<ScrapedJob> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestError('That does not look like a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestError('Only http/https URLs are supported.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || isBlockedAddress(hostname)) {
    throw new BadRequestError('That URL is not accessible.');
  }

  // Resolve DNS ourselves and reject if it points somewhere internal —
  // closes the gap where a public hostname is configured (or rebinds) to
  // resolve to a private/loopback/link-local address.
  try {
    const { address } = await lookup(hostname);
    if (isBlockedAddress(address)) {
      throw new BadRequestError('That URL is not accessible.');
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError('Could not resolve that URL.');
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Corvyx/1.0; +https://corvyx.app)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new BadGatewayError('Could not reach that URL.');
  }

  if (!res.ok) throw new BadGatewayError(`Failed to fetch URL: ${res.status}`);

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new BadRequestError('That URL does not look like a job listing page.');
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, nav, header, footer, iframe, noscript, [aria-hidden="true"]').remove();

  // Try known job board selectors first
  const SELECTORS = [
    '[data-testid="job-description"]', // LinkedIn
    '.job-description', // Generic
    '#job-description', // Generic
    '.jobsearch-jobDescriptionText', // Indeed
    '.description__text', // LinkedIn alt
    '[class*="jobDescription"]', // Greenhouse/Lever
    '[class*="job-details"]', // Various
    'main article', // Company career pages
    'main', // Fallback
  ];

  let description = '';
  for (const selector of SELECTORS) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 200) {
      description = el.text().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      break;
    }
  }

  // Last resort: grab the body text
  if (!description) {
    description = $('body').text().replace(/\s+/g, ' ').trim();
  }

  if (!description) {
    throw new BadGatewayError("Couldn't find any job description text on that page.");
  }

  // Extract title from og:title or <title> or h1
  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    $('title').text().split('|')[0].trim() ||
    'Job Listing';

  // Extract company from og:site_name or meta
  const company =
    $('meta[property="og:site_name"]').attr('content')?.trim() ||
    $('[class*="company"]').first().text().trim() ||
    '';

  return {
    title: title.slice(0, 200),
    company: company.slice(0, 100),
    location: '',
    description: description.slice(0, 5000),
    url: parsed.toString(),
  };
}
