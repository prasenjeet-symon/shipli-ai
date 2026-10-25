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
import { runInit, runConfig } from './init.js';
import { audit } from './auditor.js';
import { detectProject, collectEvidence } from './project.js';
import { print as printReport } from './reporter.js';
import { PROVIDER_DEFAULTS as DEFAULTS } from './defaults.js';
import { trackEvent } from './telemetry.js';

// Read package version
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('shipli')
  .description('AI-powered store review audit for Flutter and React Native projects')
  .version(pkg.version);

// Init subcommand
program
  .command('init')
  .description('Create a .shipli config file in the current directory')
  .action(async () => {
    await runInit();
    process.exit(0);
  });

// Config subcommand
program
  .command('config')
  .description('Update provider, model, or API key in .shipli')
  .action(async () => {
    await runConfig();
    process.exit(0);
  });

// Default audit command (runs when no subcommand is given)
program
  .command('audit', { isDefault: true })
  .description('Run the audit (default command)')
  .requiredOption('--dir <path>', 'Path to Flutter or React Native project root')
  .option('--key <apiKey>', 'API key (or set in .shipli / env var)')
  .option('--provider <provider>', 'AI provider: gemini or claude')
  .option('--model <model>', 'Model to use (defaults per provider)')
  .option('--type <type>', 'Project type: app or package (auto-detected if omitted)')
  .option('--mode <mode>', 'Audit mode: store, code, or both', 'both')
  .option('--platform <platform>', 'Target: ios, android, or both (auto-detected if omitted)')
  .action(async (opts) => {
    const projectDir = resolve(opts.dir);

    // Validate directory
    if (!existsSync(projectDir)) {
      console.error(chalk.red(`Error: Directory not found: ${projectDir}`));
      process.exit(1);
    }

    let project;
    try {
      project = await detectProject(projectDir);
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
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

    const platform = (opts.platform || config.platform || project.platform).toLowerCase();
    if (!['ios', 'android', 'both'].includes(platform)) {
      console.error(chalk.red(`Error: --platform must be "ios", "android", or "both", got "${platform}".`));
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

    const platformLabel = { ios: 'iOS', android: 'Android', both: 'iOS + Android' }[platform];
    let spinner = ora({ text: `Scanning ${project.label} project (${platformLabel})...`, color: 'cyan' }).start();
    const startTime = Date.now();

    try {
      const projectType = opts.type || config.type || project.projectType;
      if (!['app', 'package'].includes(projectType)) {
        throw new Error(`Project type must be "app" or "package", got "${projectType}".`);
      }
      spinner.text = `Scanning ${project.label} source and metadata...`;
      const { evidence, stats } = await collectEvidence(projectDir, { project, projectType, platform, mode });
      spinner.text = `Scanned ${stats.totalFiles} files (${stats.totalLines} lines → ${stats.skeletonLines} evidence lines)`;
      for (const guidelines of [evidence.appleGuidelines, evidence.googleGuidelines, evidence.reactNativeGuidelines]) {
        if (guidelines?.warning) {
          spinner.warn(chalk.yellow(guidelines.warning));
          spinner = ora({ text: '', color: 'cyan' }).start();
        }
      }

      // Run AI audit
      const modeLabel = { store: 'store compliance', code: 'code quality', both: 'full' }[mode];
      spinner.text = `Running ${modeLabel} audit with ${provider}/${model}...`;
      const result = await audit(evidence, { apiKey, model, provider, mode, platform });

      spinner.stop();

      // Print report
      printReport(result, {
        projectType,
        projectName: project.metadata.name,
        provider,
        model,
        mode,
        platform,
      });

      // Track and exit
      trackEvent('audit_completed', {
        source: 'cli', mode, platform, provider, model,
        project_type: projectType, score: result.score,
        duration_ms: Date.now() - startTime,
        tokens_input: result._tokens?.actual?.input ?? null,
        tokens_output: result._tokens?.actual?.output ?? null,
      });
      process.exitCode = result.score === 'FAIL' ? 1 : 0;
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      trackEvent('audit_error', {
        source: 'cli', mode, platform, provider, model,
        duration_ms: Date.now() - startTime,
        error_message: err.message.slice(0, 200),
      });
      process.exitCode = 1;
    }
  });

program.parse();
