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
import { scan as scanReactNative } from './react-native-scanner.js';
import { read as readPlist } from './plist-reader.js';
import { read as readManifest } from './manifest-reader.js';
import { read as readPubspec } from './pubspec-reader.js';
import { read as readPackage } from './package-reader.js';
import { audit } from './auditor.js';
import { fetchGuidelines } from './guidelines.js';
import { print as printReport } from './reporter.js';
import { PROVIDER_DEFAULTS as DEFAULTS, detectPlatform } from './defaults.js';
import { trackEvent } from './telemetry.js';

/**
 * Detect project type: flutter, react-native, or unknown
 */
async function detectProjectType(projectDir) {
  const hasPubspec = existsSync(join(projectDir, 'pubspec.yaml'));
  const hasPackageJson = existsSync(join(projectDir, 'package.json'));

  if (hasPubspec) {
    return 'flutter';
  }

  if (hasPackageJson) {
    try {
      const content = await readFile(join(projectDir, 'package.json'), 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps['react-native'] || deps['expo']) {
        return 'react-native';
      }
    } catch {
      // Ignore parse errors
    }
  }

  return 'unknown';
}

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
  .requiredOption('--dir <path>', 'Path to project root (Flutter or React Native)')
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

    // Detect project type
    const frameworkType = await detectProjectType(projectDir);
    
    if (frameworkType === 'unknown') {
      console.error(chalk.red(`Error: Could not detect Flutter or React Native project.`));
      console.error(chalk.dim('  Flutter: Requires pubspec.yaml with Flutter SDK'));
      console.error(chalk.dim('  React Native: Requires package.json with react-native or expo'));
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
    const frameworkLabel = frameworkType === 'react-native' ? 'React Native' : 'Flutter';
    let spinner = ora({ text: `Scanning ${frameworkLabel} project (${platformLabel})...`, color: 'cyan' }).start();
    const startTime = Date.now();

    try {
      let files, stats, projectMetadata, projectType;
      let exampleFiles = [];

      if (frameworkType === 'react-native') {
        // React Native project flow
        spinner.text = 'Reading package.json...';
        projectMetadata = await readPackage(projectDir);
        projectType = 'app'; // React Native projects are typically apps
        
        spinner.text = `Detected: ${chalk.cyan(projectMetadata.isExpo ? 'Expo' : 'React Native')} app / ${chalk.cyan(platformLabel)}`;
        
        // Scan React Native source files
        spinner.text = 'Scanning React Native files...';
        const scanResult = await scanReactNative(projectDir);
        files = scanResult.files;
        stats = scanResult.stats;
        spinner.text = `Scanned ${stats.totalFiles} files (${stats.totalLines} lines → ${stats.skeletonLines} skeleton lines)`;
      } else {
        // Flutter project flow
        spinner.text = 'Reading pubspec.yaml...';
        projectMetadata = await readPubspec(projectDir);
        
        // Resolve project type: CLI flag > config > auto-detect from pubspec
        projectType = opts.type || config.type || projectMetadata.projectType;
        spinner.text = `Detected: ${chalk.cyan(projectType)} / ${chalk.cyan(platformLabel)}`;

        // Scan Dart files
        spinner.text = 'Scanning Dart files...';
        const scanResult = await scan(projectDir);
        files = scanResult.files;
        stats = scanResult.stats;
        spinner.text = `Scanned ${stats.totalFiles} files (${stats.totalLines} lines → ${stats.skeletonLines} skeleton lines)`;

        // Scan example/ app for packages (if it exists)
        if (projectType === 'package' && existsSync(join(projectDir, 'example', 'lib'))) {
          spinner.text = 'Scanning example/ app...';
          const exampleResult = await scan(join(projectDir, 'example'));
          exampleFiles = exampleResult.files;
        }
      }

      // Read platform-specific permission files
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

      // Load store guidelines (for store and both modes)
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

        if (frameworkType === 'react-native') {
          spinner.text = 'Loading React Native guidelines...';
          reactNativeGuidelines = await fetchGuidelines('reactNative');
        }
      }

      // Run AI audit
      const modeLabel = { store: 'store compliance', code: 'code quality', both: 'full' }[mode];
      spinner.text = `Running ${modeLabel} audit with ${provider}/${model}...`;
      const result = await audit(
        {
          files,
          exampleFiles,
          permissions: plistData.permissions,
          androidPermissions: manifestData.permissions,
          pubspec: projectMetadata,
          plistFound: (platform === 'ios' || platform === 'both') ? plistData.found : undefined,
          androidManifestFound: (platform === 'android' || platform === 'both') ? manifestData.found : undefined,
          projectType,
          appleGuidelines,
          googleGuidelines,
        },
        { apiKey, model, provider, mode, platform },
      );

      spinner.stop();

      // Print report
      printReport(result, {
        projectType,
        projectName: projectMetadata.name,
        provider,
        model,
        mode,
        platform,
      });

      // Track and exit
      trackEvent('audit_completed', {
        source: 'cli', mode, platform, provider, model,
        project_type: projectType, score: result.score,
        framework: frameworkType,
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
