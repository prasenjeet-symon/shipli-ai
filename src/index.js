#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { runInit } from './init.js';
import { scan } from './scanner.js';
import { read as readPlist } from './plist-reader.js';
import { read as readPubspec } from './pubspec-reader.js';
import { audit } from './auditor.js';
import { fetchGuidelines } from './guidelines.js';
import { print as printReport } from './reporter.js';

// Read package version
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8'));

const DEFAULTS = {
  gemini: { model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  claude: { model: 'claude-sonnet-4-6', envKey: 'ANTHROPIC_API_KEY' },
};

const program = new Command();

program
  .name('shipli')
  .description('AI-powered App Store review audit for Flutter projects')
  .version(pkg.version);

// Init subcommand
program
  .command('init')
  .description('Create a .shipli config file in the current directory')
  .action(async () => {
    await runInit();
    process.exit(0);
  });

// Default audit command (runs when no subcommand is given)
program
  .command('audit', { isDefault: true })
  .description('Run the audit (default command)')
  .requiredOption('--dir <path>', 'Path to Flutter project root')
  .option('--key <apiKey>', 'API key (or set in .shipli / env var)')
  .option('--provider <provider>', 'AI provider: gemini or claude')
  .option('--model <model>', 'Model to use (defaults per provider)')
  .option('--type <type>', 'Project type: app or package (auto-detected if omitted)')
  .option('--mode <mode>', 'Audit mode: store, code, or both', 'both')
  .action(async (opts) => {
    const projectDir = resolve(opts.dir);

    // Validate directory
    if (!existsSync(projectDir)) {
      console.error(chalk.red(`Error: Directory not found: ${projectDir}`));
      process.exit(1);
    }

    if (!existsSync(join(projectDir, 'lib'))) {
      console.error(chalk.red(`Error: No lib/ directory found in ${projectDir}. Is this a Flutter project?`));
      process.exit(1);
    }

    // Load .shipli config (project-level > home-level)
    const config = await loadConfig(projectDir);

    // Resolve values: CLI flag > .shipli > env var > default
    const provider = (opts.provider || config.provider || 'gemini').toLowerCase();

    if (!DEFAULTS[provider]) {
      console.error(chalk.red(`Error: Unknown provider "${provider}". Use "gemini" or "claude".`));
      process.exit(1);
    }

    if (opts.type && !['app', 'package'].includes(opts.type)) {
      console.error(chalk.red(`Error: --type must be "app" or "package", got "${opts.type}".`));
      process.exit(1);
    }

    const mode = (opts.mode || config.mode || 'both').toLowerCase();
    if (!['store', 'code', 'both'].includes(mode)) {
      console.error(chalk.red(`Error: --mode must be "store", "code", or "both", got "${mode}".`));
      process.exit(1);
    }

    const apiKey = opts.key || config.key || process.env[DEFAULTS[provider].envKey];
    const model = opts.model || config.model || DEFAULTS[provider].model;

    if (!apiKey) {
      console.error(chalk.red('Error: No API key provided.'));
      console.error(chalk.dim('  Run ') + chalk.cyan('shipli init') + chalk.dim(' to create a .shipli config file,'));
      console.error(chalk.dim(`  or pass --key YOUR_KEY, or set ${DEFAULTS[provider].envKey} in your environment.`));
      process.exit(1);
    }

    let spinner = ora({ text: 'Scanning Flutter project...', color: 'cyan' }).start();

    try {
      // 1. Read pubspec.yaml first (needed for type detection)
      spinner.text = 'Reading pubspec.yaml...';
      const pubspec = await readPubspec(projectDir);

      // 2. Resolve project type: CLI flag > config > auto-detect from pubspec
      const projectType = opts.type || config.type || pubspec.projectType;
      spinner.text = `Detected project type: ${chalk.cyan(projectType)}`;

      // 3. Scan Dart files
      spinner.text = 'Scanning Dart files...';
      const { files, stats } = await scan(projectDir);
      spinner.text = `Scanned ${stats.totalFiles} files (${stats.totalLines} lines → ${stats.skeletonLines} skeleton lines)`;

      // 4. Scan example/ app for packages (if it exists)
      let exampleFiles = [];
      if (projectType === 'package' && existsSync(join(projectDir, 'example', 'lib'))) {
        spinner.text = 'Scanning example/ app...';
        const exampleResult = await scan(join(projectDir, 'example'));
        exampleFiles = exampleResult.files;
      }

      // 5. Read Info.plist (skip for packages)
      let plistData = { found: false, permissions: {}, bundleId: null };
      if (projectType === 'app') {
        spinner.text = 'Reading Info.plist...';
        plistData = await readPlist(projectDir);
      }

      // 6. Fetch Apple guidelines (for store and both modes)
      let guidelines = null;
      if (mode !== 'code') {
        spinner.text = 'Fetching Apple App Store guidelines...';
        guidelines = await fetchGuidelines();
        if (guidelines.warning) {
          spinner.warn(chalk.yellow(guidelines.warning));
          spinner = ora({ text: '', color: 'cyan' }).start();
        } else {
          spinner.text = `Guidelines loaded (${guidelines.source}, ${guidelines.age})`;
        }
      }

      // 7. Run AI audit
      const modeLabel = { store: 'store compliance', code: 'code quality', both: 'full' }[mode];
      spinner.text = `Running ${modeLabel} audit with ${provider}/${model}...`;
      const result = await audit(
        {
          files,
          exampleFiles,
          permissions: plistData.permissions,
          pubspec,
          plistFound: plistData.found,
          projectType,
          guidelines,
        },
        { apiKey, model, provider, mode },
      );

      spinner.stop();

      // 7. Print report
      printReport(result, {
        projectType,
        projectName: pubspec.name,
        provider,
        model,
        mode,
      });

      // 8. Exit with appropriate code
      process.exit(result.score === 'FAIL' ? 1 : 0);
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  });

program.parse();
