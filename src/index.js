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
import { scan } from './scanner.js';
import { read as readPlist } from './plist-reader.js';
import { read as readManifest } from './manifest-reader.js';
import { read as readPubspec } from './pubspec-reader.js';
import { read as readPackage } from './package-reader.js';
import { scan as scanRN } from './scanner-rn.js';
import { audit } from './auditor.js';
import { fetchGuidelines } from './guidelines.js';
import { print as printReport } from './reporter.js';
import { PROVIDER_DEFAULTS as DEFAULTS, detectPlatform } from './defaults.js';
import { trackEvent } from './telemetry.js';

// Read package version
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('shipli')
  .description('AI-powered store review audit for Flutter projects')
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
  .requiredOption('--dir <path>', 'Path to Flutter project root')
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

    // Allow either Flutter (lib/) or React Native (package.json) projects
    const isFlutter = existsSync(join(projectDir, 'lib'));
    const hasPackageJson = existsSync(join(projectDir, 'package.json'));

    if (!isFlutter && !hasPackageJson) {
      console.error(chalk.red(`Error: Could not find project sources in ${projectDir}. Expected Flutter (lib/) or JS project (package.json).`));
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

    const platform = (opts.platform || config.platform || detectPlatform(projectDir)).toLowerCase();
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
    let spinner = ora({ text: `Scanning Flutter project (${platformLabel})...`, color: 'cyan' }).start();
    const startTime = Date.now();

    try {
      // 1. Read project metadata (pubspec for Flutter, package.json for JS/RN)
      let pubspec = null;
      let packageJson = null;
      let projectTypeAuto = null;

      if (isFlutter) {
        spinner.text = 'Reading pubspec.yaml...';
        pubspec = await readPubspec(projectDir);
        projectTypeAuto = pubspec.projectType;
      } else {
        spinner.text = 'Reading package.json...';
        packageJson = await readPackage(projectDir);
        projectTypeAuto = packageJson.projectType === 'react-native' ? 'app' : packageJson.projectType;
      }

      // 2. Resolve project type: CLI flag > config > auto-detect
      const projectType = opts.type || config.type || projectTypeAuto;
      spinner.text = `Detected: ${chalk.cyan(projectType)} / ${chalk.cyan(platformLabel)}`;

      // 3. Scan source files
      spinner.text = isFlutter ? 'Scanning Dart files...' : 'Scanning JS/TS files...';
      const scanResult = isFlutter ? await scan(projectDir) : await scanRN(projectDir);
      const { files, stats } = scanResult;
      spinner.text = `Scanned ${stats.totalFiles} files (${stats.totalLines} lines → ${stats.skeletonLines} skeleton lines)`;

      // 4. Scan example/ app for packages (if it exists)
      let exampleFiles = [];
      if (projectType === 'package' && existsSync(join(projectDir, 'example'))) {
        spinner.text = 'Scanning example/ app...';
        const examplePath = join(projectDir, 'example');
        const exampleResult = isFlutter ? await scan(examplePath) : await scanRN(examplePath);
        exampleFiles = exampleResult.files;
      }

      // 5. Read platform-specific permission files
      let plistData = { found: false, permissions: {}, bundleId: null };
      let manifestData = { found: false, permissions: [], packageName: null };

      if (projectType === 'app' && (platform === 'ios' || platform === 'both')) {
        spinner.text = 'Reading Info.plist...';
        plistData = await readPlist(projectDir);
      }

      if (projectType === 'app' && (platform === 'android' || platform === 'both')) {
        spinner.text = 'Reading AndroidManifest.xml...';
        manifestData = await readManifest(projectDir);
      }

      // 6. Load store guidelines (for store and both modes)
      let appleGuidelines = null;
      let googleGuidelines = null;
  let reactNativeGuidelines = null;

      if (mode !== 'code') {
        if (platform === 'ios' || platform === 'both') {
          spinner.text = 'Loading App Store guidelines...';
          appleGuidelines = await fetchGuidelines('apple');
          if (appleGuidelines.warning) {
            spinner.warn(chalk.yellow(appleGuidelines.warning));
            spinner = ora({ text: '', color: 'cyan' }).start();
          }
        }

        if (platform === 'android' || platform === 'both') {
          spinner.text = 'Loading Play Store guidelines...';
          googleGuidelines = await fetchGuidelines('google');
          if (googleGuidelines.warning) {
            spinner.warn(chalk.yellow(googleGuidelines.warning));
            spinner = ora({ text: '', color: 'cyan' }).start();
          }
        }
      }

      // Load React Native bundled guidelines (used for code guidance) when auditing JS projects
      if (!isFlutter && mode !== 'store') {
        spinner.text = 'Loading React Native guidelines...';
        reactNativeGuidelines = await fetchGuidelines('react-native');
        if (reactNativeGuidelines.warning) {
          spinner.warn(chalk.yellow(reactNativeGuidelines.warning));
          spinner = ora({ text: '', color: 'cyan' }).start();
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
          androidPermissions: manifestData.permissions,
          pubspec,
          packageJson,
          plistFound: (platform === 'ios' || platform === 'both') ? plistData.found : undefined,
          androidManifestFound: (platform === 'android' || platform === 'both') ? manifestData.found : undefined,
          projectType,
          appleGuidelines,
            googleGuidelines,
            reactNativeGuidelines,
        },
        { apiKey, model, provider, mode, platform },
      );

      spinner.stop();

      // 8. Print report
      printReport(result, {
        projectType,
        projectName: pubspec.name,
        provider,
        model,
        mode,
        platform,
      });

      // 9. Track and exit
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
