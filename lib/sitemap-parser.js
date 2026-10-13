import { parseStringPromise } from 'xml2js';
import { readFileSync, existsSync } from 'fs';

/**
 * Fetch and parse a sitemap XML
 */
async function fetchSitemap(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  return parseStringPromise(xml);
}

/**
 * Extract URLs from a sitemap or sitemap index
 */
async function extractUrlsFromSitemap(sitemapUrl, visited = new Set()) {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);

  const sitemap = await fetchSitemap(sitemapUrl);
  const urls = [];

  if (sitemap.sitemapindex?.sitemap) {
    for (const sub of sitemap.sitemapindex.sitemap) {
      const subUrl = sub.loc[0];
      urls.push(...(await extractUrlsFromSitemap(subUrl, visited)));
    }
  }

  if (sitemap.urlset?.url) {
    for (const entry of sitemap.urlset.url) {
      urls.push(entry.loc[0]);
    }
  }

  return urls;
}

/**
 * Read URLs from a local text file (one per line)
 */
function readUrlsFromFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

/**
 * Get URLs from source (sitemap URL or file path)
 */
export async function getUrls(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    console.log(`Fetching sitemap: ${source}`);
    return extractUrlsFromSitemap(source);
  }

  if (existsSync(source)) {
    console.log(`Reading URLs from file: ${source}`);
    return readUrlsFromFile(source);
  }

  throw new Error(`Source not found or invalid: ${source}`);
}
