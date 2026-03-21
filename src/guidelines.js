import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const GUIDELINES_URL = 'https://developer.apple.com/app-store/review/guidelines/';
const CACHE_DIR = join(homedir(), '.shipli-cache');
const CACHE_FILE = join(CACHE_DIR, 'apple-guidelines.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function stripHtml(html) {
  let text = html
    // Remove script and style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Convert headers to markdown-style
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    // Convert list items
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    // Convert paragraphs and breaks to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8212;/g, '—')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Extract just the guidelines body (from "Introduction" to end of content)
  const introIdx = text.indexOf('Introduction');
  if (introIdx > 0) {
    text = text.slice(introIdx);
  }

  // Trim trailing navigation/footer noise after "Last Updated"
  const lastUpdated = text.lastIndexOf('Last Updated');
  if (lastUpdated > 0) {
    // Keep the "Last Updated" line itself
    const lineEnd = text.indexOf('\n', lastUpdated);
    if (lineEnd > 0) {
      text = text.slice(0, lineEnd).trim();
    }
  }

  return text;
}

async function readCache() {
  try {
    const raw = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(content) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify({
      fetchedAt: new Date().toISOString(),
      url: GUIDELINES_URL,
      content,
    }, null, 2));
  } catch {
    // Cache write failure is non-fatal
  }
}

function isCacheFresh(cache) {
  if (!cache?.fetchedAt) return false;
  const age = Date.now() - new Date(cache.fetchedAt).getTime();
  return age < CACHE_TTL_MS;
}

export async function fetchGuidelines() {
  // 1. Check cache
  const cache = await readCache();
  if (cache?.content && isCacheFresh(cache)) {
    const ageInDays = Math.floor((Date.now() - new Date(cache.fetchedAt).getTime()) / (24 * 60 * 60 * 1000));
    return {
      content: cache.content,
      source: 'cache',
      fetchedAt: cache.fetchedAt,
      age: `${ageInDays}d`,
    };
  }

  // 2. Fetch live
  try {
    const res = await fetch(GUIDELINES_URL, {
      headers: {
        'User-Agent': 'Shipli/1.0 (App Store Audit CLI)',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const content = stripHtml(html);

    // Sanity check — guidelines should be substantial
    if (content.length < 5000) {
      throw new Error('Fetched content too short — page may have changed');
    }

    await writeCache(content);

    return {
      content,
      source: 'live',
      fetchedAt: new Date().toISOString(),
      age: 'fresh',
    };
  } catch (err) {
    // 3. Fall back to stale cache if available
    if (cache?.content) {
      return {
        content: cache.content,
        source: 'stale-cache',
        fetchedAt: cache.fetchedAt,
        age: 'stale',
        warning: `Failed to fetch latest guidelines (${err.message}). Using cached version from ${cache.fetchedAt}.`,
      };
    }

    // 4. No cache, no network — return null
    return {
      content: null,
      source: 'unavailable',
      warning: `Could not fetch App Store guidelines (${err.message}). Audit will proceed using the AI model's built-in knowledge.`,
    };
  }
}
