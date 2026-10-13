import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import pa11y from 'pa11y';
import axe from 'axe-core';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { getUrls } from './sitemap-parser.js';
import { generateReports } from './reporters.js';

const VIEWPORTS = {
  desktop: { width: 1280, height: 1024, label: 'desktop' },
  mobile: { width: 320, height: 568, label: 'mobile' }
};

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Run axe-core scan on a page
 */
async function runAxe(page, url, viewport) {
  await page.setViewportSize(viewport);
  
  const axeSource = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  await page.addInitScript(axeSource);
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  const results = await page.evaluate((tags) => {
    if (typeof window.axe === 'undefined') {
      throw new Error('axe-core not loaded');
    }
    return window.axe.run({ runOnly: { type: 'tag', values: tags } });
  }, AXE_TAGS);

  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    timestamp: results.timestamp
  };
}

/**
 * Run Lighthouse accessibility audit
 */
async function runLighthouse(url, viewport) {
  const options = {
    onlyCategories: ['accessibility'],
    output: 'json',
    logLevel: 'error',
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
    screenEmulation: {
      mobile: viewport.label === 'mobile',
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      disabled: false,
    },
    formFactor: viewport.label === 'mobile' ? 'mobile' : 'desktop',
  };

  try {
    const result = await lighthouse(url, options);
    if (!result || !result.lhr) {
      throw new Error('Invalid Lighthouse result');
    }
    return {
      score: result.lhr.categories.accessibility.score,
      audits: Object.entries(result.lhr.audits)
        .filter(([_, audit]) => audit.score !== null && audit.score < 1)
        .map(([id, audit]) => ({
          id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
        })),
    };
  } catch (error) {
    console.warn(`  Lighthouse failed for ${url}: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Run pa11y scan
 */
async function runPa11y(url, viewport) {
  try {
    const playwrightChromium = '/home/ubuntu/.cache/ms-playwright/chromium-1091/chrome-linux/chrome';
    const options = {
      standard: 'WCAG2AA',
      viewport: viewport,
      timeout: 30000,
      chromeLaunchConfig: {
        executablePath: playwrightChromium,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      }
    };

    const results = await pa11y(url, options);

    return {
      issues: results.issues.map(issue => ({
        type: issue.type,
        code: issue.code,
        message: issue.message,
        selector: issue.selector,
        runner: issue.runner,
      })),
    };
  } catch (error) {
    console.warn(`  pa11y failed for ${url}: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Take screenshot of element
 */
async function screenshotElement(page, selector, outputPath) {
  try {
    const element = await page.locator(selector).first();
    if (await element.count() > 0) {
      await element.screenshot({ path: outputPath });
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

/**
 * Scan a single URL
 */
async function scanUrl(browser, url, viewport, options, runDir) {
  const results = {
    url,
    viewport: viewport.label,
    timestamp: new Date().toISOString(),
  };

  try {
    const page = await browser.newPage();
    
    console.log(`  [${viewport.label}] Running axe-core...`);
    results.axe = await runAxe(page, url, viewport);

    const screenshotsDir = join(runDir, 'screenshots', viewport.label, Buffer.from(url).toString('base64').slice(0, 50));
    mkdirSync(screenshotsDir, { recursive: true });

    for (let i = 0; i < Math.min(results.axe.violations.length, 5); i++) {
      const violation = results.axe.violations[i];
      if (violation.nodes.length > 0) {
        const selector = violation.nodes[0].target[0];
        const filename = `${violation.id}-${i}.png`;
        await screenshotElement(page, selector, join(screenshotsDir, filename));
      }
    }

    await page.close();

    console.log(`  [${viewport.label}] Running Lighthouse...`);
    results.lighthouse = await runLighthouse(url, viewport);

    console.log(`  [${viewport.label}] Running pa11y...`);
    results.pa11y = await runPa11y(url, viewport);

  } catch (error) {
    results.error = error.message;
    console.error(`  [${viewport.label}] Error: ${error.message}`);
  }

  return results;
}

/**
 * Process URLs with concurrency limit
 */
async function processUrls(browser, urls, options, runDir) {
  const results = [];
  const errors = [];
  const concurrency = parseInt(options.concurrency);

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    console.log(`\nScanning ${i + 1}-${Math.min(i + concurrency, urls.length)} of ${urls.length} URLs...`);

    const batchPromises = batch.flatMap(url =>
      Object.values(VIEWPORTS).map(viewport =>
        scanUrl(browser, url, viewport, options, runDir).catch(error => {
          errors.push({ url, error: error.message });
          return null;
        })
      )
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(r => r !== null));
  }

  return { results, errors };
}

/**
 * Main scan runner
 */
export async function run(source, options) {
  console.log('ASR Accessibility Scanner');
  console.log('=========================\n');

  const urls = await getUrls(source);
  console.log(`Found ${urls.length} URLs to scan\n`);

  if (urls.length === 0) {
    throw new Error('No URLs found to scan');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = join(options.output, `${timestamp}_${options.label}`);
  mkdirSync(runDir, { recursive: true });

  console.log(`Output directory: ${runDir}`);

  const browser = await chromium.launch();

  try {
    const { results, errors } = await processUrls(browser, urls, options, runDir);

    const metadata = {
      timestamp,
      label: options.label,
      source,
      totalUrls: urls.length,
      scannedUrls: urls.length - errors.length,
      errors: errors.length,
      options: {
        concurrency: options.concurrency,
        timeout: options.timeout,
      }
    };

    writeFileSync(join(runDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    writeFileSync(join(runDir, 'results.json'), JSON.stringify(results, null, 2));

    if (errors.length > 0) {
      writeFileSync(join(runDir, 'errors.json'), JSON.stringify(errors, null, 2));
      console.log(`\n⚠ ${errors.length} URLs had errors (see errors.json)`);
    }

    await generateReports(results, metadata, runDir);

  } finally {
    await browser.close();
  }
}
