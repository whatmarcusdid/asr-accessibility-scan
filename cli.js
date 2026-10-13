#!/usr/bin/env node

import { program } from 'commander';
import { run } from './lib/scanner.js';
import { compare } from './lib/compare.js';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

program
  .name('asr-scan')
  .description('Attorney Site Rescue Accessibility Scanner - WCAG 2.2 Level AA')
  .version(pkg.version)
  .argument('<source>', 'Sitemap URL or path to text file with URLs')
  .option('-l, --label <label>', 'Run label (before, staging, ongoing)', 'scan')
  .option('-o, --output <dir>', 'Output directory', './results')
  .option('-c, --concurrency <number>', 'Concurrent page scans', '2')
  .option('-t, --timeout <ms>', 'Page timeout in milliseconds', '30000')
  .action(async (source, options) => {
    try {
      await run(source, options);
      console.log('\n✓ Scan complete!');
    } catch (error) {
      console.error('\n✗ Scan failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare two scan runs (before vs staging)')
  .argument('<before-dir>', 'Path to "before" results directory')
  .argument('<staging-dir>', 'Path to "staging" results directory')
  .option('-o, --output <file>', 'Output file path', './comparison-report.html')
  .action(async (beforeDir, stagingDir, options) => {
    try {
      await compare(beforeDir, stagingDir, options.output);
      console.log(`\n✓ Comparison report saved to ${options.output}`);
    } catch (error) {
      console.error('\n✗ Comparison failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
