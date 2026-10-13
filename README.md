# ASR Accessibility Scanner

Automated WCAG 2.2 Level AA accessibility scanner for Attorney Site Rescue law-firm website migrations.

Runs comprehensive accessibility audits using three industry-standard tools:
- **axe-core** (pass/fail criteria)
- **Lighthouse** (informational)
- **pa11y** (informational)

Tests at two viewports (desktop 1280px and mobile 320px) and generates detailed reports with screenshots of violations.

## Features

- ✅ **Multi-tool scanning**: axe-core, Lighthouse, and pa11y
- ✅ **WCAG 2.2 AA compliance**: Tests against wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa tags
- ✅ **Dual viewport testing**: Desktop (1280x1024) and mobile (320x568)
- ✅ **Flexible input**: Accepts sitemap.xml URLs (including sitemap indexes) or local text files with URLs
- ✅ **Screenshot capture**: Automatically screenshots failing elements
- ✅ **Multiple report formats**: JSON, CSV, Markdown, and HTML
- ✅ **Clear pass/fail criteria**: Zero axe-core violations = PASS
- ✅ **Comparison mode**: Before-vs-after analysis for client reports
- ✅ **Configurable concurrency**: Control scan speed and server load
- ✅ **Error handling**: Continues scanning even if individual pages fail

## Installation

```bash
npm install
npx playwright install chromium
```

## Usage

### Basic Scan

Scan URLs from a sitemap:

```bash
npx asr-scan https://example.com/sitemap.xml --label before
```

Scan URLs from a local file:

```bash
npx asr-scan examples/sample-urls.txt --label staging
```

### Options

```
npx asr-scan <source> [options]

Arguments:
  source                  Sitemap URL or path to text file with URLs

Options:
  -l, --label <label>     Run label (before, staging, ongoing) (default: "scan")
  -o, --output <dir>      Output directory (default: "./results")
  -c, --concurrency <n>   Concurrent page scans (default: "2")
  -t, --timeout <ms>      Page timeout in milliseconds (default: "30000")
  -h, --help              Display help
  -V, --version           Display version
```

### Examples

**Scan with custom label and output directory:**

```bash
npx asr-scan https://example.com/sitemap.xml \
  --label before \
  --output ./scans/client-name
```

**Scan with higher concurrency (be polite to servers!):**

```bash
npx asr-scan urls.txt \
  --label staging \
  --concurrency 4
```

**Run the included demo:**

```bash
npm run demo
```

### Comparison Mode

Compare two scan runs (before vs staging) to generate a client report:

```bash
npx asr-scan compare \
  results/2024-10-13T14-00-00_before \
  results/2024-10-13T15-00-00_staging \
  --output client-report.html
```

This generates a single-page HTML report showing:
- Before and after violation counts
- Change in pages with violations
- Per-rule breakdown of improvements or regressions

## Output Structure

Each scan creates a timestamped directory with the following files:

```
results/
└── 2024-10-13T14-30-45_before/
    ├── metadata.json          # Scan metadata and configuration
    ├── results.json           # Raw results from all tools
    ├── results.csv            # Tabular format (Date, URL, Tool, Rule, etc.)
    ├── summary.md             # Markdown summary with pass/fail status
    ├── summary.html           # Interactive HTML report
    ├── errors.json            # Pages that failed to scan (if any)
    └── screenshots/           # Screenshots of violations
        ├── desktop/
        └── mobile/
```

## Pass/Fail Criteria

**PASS Rule**: Zero axe-core violations

- ✓ **Lighthouse** and **pa11y** findings are reported for informational purposes but **do not fail** the scan
- ✗ Any axe-core violations (critical, serious, moderate, or minor) will fail the scan
- The summary clearly shows **✓ PASS** or **✗ FAIL** at the top

## URL Input Formats

### Sitemap URL

```bash
npx asr-scan https://example.com/sitemap.xml --label before
```

Supports:
- Standard sitemap.xml files
- Sitemap index files (automatically follows sub-sitemaps)

### Local Text File

Create a text file with one URL per line:

```
https://example.com/page1
https://example.com/page2
https://example.com/page3
# Comments are ignored
```

Then scan it:

```bash
npx asr-scan urls.txt --label staging
```

## WCAG 2.2 AA Coverage

The scanner tests against these axe-core tags:
- `wcag2a` - WCAG 2.0 Level A
- `wcag2aa` - WCAG 2.0 Level AA
- `wcag21a` - WCAG 2.1 Level A
- `wcag21aa` - WCAG 2.1 Level AA
- `wcag22aa` - WCAG 2.2 Level AA

This ensures comprehensive coverage of WCAG 2.2 Level AA requirements.

## Tools Used

### axe-core (Pass/Fail Criteria)

The Deque axe-core accessibility engine. Industry-leading automated testing with high accuracy and low false positives.

- **Impact levels**: critical, serious, moderate, minor
- **Help URLs**: Direct links to remediation guidance
- **Screenshots**: Captured for up to 5 violations per page

### Lighthouse (Informational)

Google's Lighthouse accessibility category.

- Provides additional context and best practices
- Findings do not affect pass/fail status
- Includes accessibility score (0-100)
- **Note**: Lighthouse may fail to connect in some environments. This is informational only and does not affect scan results.

### pa11y (Informational)

HTML_CodeSniffer-based accessibility testing.

- Additional verification layer
- Findings do not affect pass/fail status
- Uses WCAG2AA standard

## Performance Considerations

- **Default concurrency**: 2 simultaneous page scans (gentle on servers)
- **Page timeout**: 30 seconds (configurable)
- **Error handling**: Continues past failed pages and reports them separately
- **Politeness**: Configurable delays between requests via concurrency setting

For large sites (100+ pages), consider:
- Running scans during off-peak hours
- Using lower concurrency (1-2)
- Increasing timeout for slow pages

## Demo

The repository includes a demo scan against two public pages:

1. **W3C WAI "bad" demo**: https://www.w3.org/WAI/demos/bad/before/home.html (has known violations)
2. **example.com**: https://example.com (simple reference page)

Run it with:

```bash
npm run demo
```

Sample output is committed under `examples/demo-output/`.

## Example Reports

After running a scan, you'll find:

**summary.html** - Interactive HTML report with:
- Clear PASS/FAIL status
- Total violation counts
- Breakdown by impact level
- Violations by page and by rule
- Sortable tables

**results.csv** - Import into Excel/Google Sheets:
- One row per violation
- Includes date, URL, viewport, tool, rule ID, impact, selector, help URL

**summary.md** - Readable Markdown summary for documentation

## Troubleshooting

### "Failed to fetch sitemap"

- Verify the sitemap URL is publicly accessible
- Check for authentication requirements
- Try downloading the sitemap manually first

### "Page timeout"

- Increase timeout: `--timeout 60000` (60 seconds)
- Check if pages require authentication
- Verify pages are accessible via browser

### High memory usage

- Reduce concurrency: `--concurrency 1`
- Scan smaller batches of URLs
- Close other applications

### Playwright browser not found

Run the installation again:

```bash
npx playwright install chromium
```

## License

MIT

## Support

For issues or questions about Attorney Site Rescue services, contact your ASR representative.

## Credits

Built with:
- [axe-core](https://github.com/dequelabs/axe-core) by Deque
- [Lighthouse](https://github.com/GoogleChrome/lighthouse) by Google
- [pa11y](https://github.com/pa11y/pa11y)
- [Playwright](https://playwright.dev/)
