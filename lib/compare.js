import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Load scan results from directory
 */
function loadScanResults(dir) {
  const metadata = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8'));
  const results = JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8'));
  
  const analysis = {
    label: metadata.label,
    timestamp: metadata.timestamp,
    totalUrls: metadata.totalUrls,
    axeViolations: 0,
    pagesWithViolations: new Set(),
    violationsByRule: {},
  };

  for (const result of results) {
    if (result.axe?.violations) {
      const violationCount = result.axe.violations.reduce((sum, v) => sum + v.nodes.length, 0);
      
      if (violationCount > 0) {
        analysis.axeViolations += violationCount;
        analysis.pagesWithViolations.add(result.url);

        for (const violation of result.axe.violations) {
          analysis.violationsByRule[violation.id] = 
            (analysis.violationsByRule[violation.id] || 0) + violation.nodes.length;
        }
      }
    }
  }

  analysis.pagesWithViolations = analysis.pagesWithViolations.size;

  return analysis;
}

/**
 * Generate comparison HTML report
 */
function generateComparisonHTML(before, staging) {
  const violationDelta = staging.axeViolations - before.axeViolations;
  const violationDeltaPercent = before.axeViolations > 0 
    ? ((violationDelta / before.axeViolations) * 100).toFixed(1) 
    : 0;
  
  const pageDelta = staging.pagesWithViolations - before.pagesWithViolations;
  
  const improved = violationDelta < 0;
  const statusClass = improved ? 'improved' : (violationDelta > 0 ? 'worse' : 'same');

  const allRules = new Set([
    ...Object.keys(before.violationsByRule),
    ...Object.keys(staging.violationsByRule)
  ]);

  let ruleRows = '';
  for (const rule of Array.from(allRules).sort()) {
    const beforeCount = before.violationsByRule[rule] || 0;
    const stagingCount = staging.violationsByRule[rule] || 0;
    const delta = stagingCount - beforeCount;
    const deltaClass = delta < 0 ? 'improved' : (delta > 0 ? 'worse' : 'same');
    const deltaSign = delta > 0 ? '+' : '';
    
    ruleRows += `      <tr>
        <td>${rule}</td>
        <td>${beforeCount}</td>
        <td>${stagingCount}</td>
        <td class="${deltaClass}">${deltaSign}${delta}</td>
      </tr>\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASR Accessibility Comparison Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1a1a1a; }
    .header { background: #f8f9fa; padding: 30px; border-radius: 8px; margin: 20px 0; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }
    .column h2 { margin-top: 0; }
    .metric { font-size: 3em; font-weight: bold; margin: 10px 0; }
    .delta { font-size: 1.5em; font-weight: bold; margin: 10px 0; }
    .improved { color: #28a745; }
    .worse { color: #dc3545; }
    .same { color: #6c757d; }
    .summary-box { background: white; padding: 25px; border: 2px solid #dee2e6; border-radius: 8px; }
    .summary-box.improved { border-color: #28a745; background: #d4edda; }
    .summary-box.worse { border-color: #dc3545; background: #f8d7da; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .metadata { font-size: 0.9em; color: #6c757d; }
  </style>
</head>
<body>
  <h1>ASR Accessibility Comparison Report</h1>
  
  <div class="header">
    <h2>Before vs Staging Comparison</h2>
    <p class="metadata">
      <strong>Before:</strong> ${before.label} (${new Date().toLocaleString()})<br>
      <strong>Staging:</strong> ${staging.label} (${new Date().toLocaleString()})
    </p>
  </div>

  <div class="summary-box ${statusClass}">
    <h2>${improved ? '✓ Improvements Detected' : (violationDelta > 0 ? '⚠ More Violations' : 'No Change')}</h2>
    <div class="delta ${statusClass}">
      ${violationDelta > 0 ? '+' : ''}${violationDelta} violations 
      ${violationDeltaPercent !== 0 ? `(${violationDelta > 0 ? '+' : ''}${violationDeltaPercent}%)` : ''}
    </div>
    <div class="delta ${pageDelta < 0 ? 'improved' : (pageDelta > 0 ? 'worse' : 'same')}">
      ${pageDelta > 0 ? '+' : ''}${pageDelta} pages with violations
    </div>
  </div>

  <div class="comparison">
    <div class="column">
      <h2>Before</h2>
      <div class="summary-box">
        <div class="metric">${before.axeViolations}</div>
        <p>Total Violations</p>
        <div class="metric">${before.pagesWithViolations}</div>
        <p>Pages with Violations</p>
        <div class="metric">${before.totalUrls}</div>
        <p>Total URLs Scanned</p>
      </div>
    </div>

    <div class="column">
      <h2>Staging</h2>
      <div class="summary-box">
        <div class="metric">${staging.axeViolations}</div>
        <p>Total Violations</p>
        <div class="metric">${staging.pagesWithViolations}</div>
        <p>Pages with Violations</p>
        <div class="metric">${staging.totalUrls}</div>
        <p>Total URLs Scanned</p>
      </div>
    </div>
  </div>

  <h2>Violations by Rule</h2>
  <table>
    <thead>
      <tr>
        <th>Rule ID</th>
        <th>Before</th>
        <th>Staging</th>
        <th>Change</th>
      </tr>
    </thead>
    <tbody>
${ruleRows}
    </tbody>
  </table>

  <hr>
  <p><em>Generated by ASR Accessibility Scanner</em></p>
</body>
</html>`;
}

/**
 * Compare two scan runs
 */
export async function compare(beforeDir, stagingDir, outputFile) {
  console.log('Comparing scan results...\n');

  const before = loadScanResults(beforeDir);
  console.log(`Before (${before.label}): ${before.axeViolations} violations across ${before.pagesWithViolations} pages`);

  const staging = loadScanResults(stagingDir);
  console.log(`Staging (${staging.label}): ${staging.axeViolations} violations across ${staging.pagesWithViolations} pages`);

  const delta = staging.axeViolations - before.axeViolations;
  console.log(`\nChange: ${delta > 0 ? '+' : ''}${delta} violations`);

  const html = generateComparisonHTML(before, staging);
  writeFileSync(outputFile, html);
}
