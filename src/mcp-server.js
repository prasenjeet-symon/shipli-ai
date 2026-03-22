#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from './scanner.js';
import { read as readPubspec } from './pubspec-reader.js';
import { read as readPlist } from './plist-reader.js';
import { read as readManifest } from './manifest-reader.js';
import { fetchGuidelines } from './guidelines.js';
import { audit } from './auditor.js';
import { loadConfig } from './config.js';
import { PROVIDER_DEFAULTS, detectPlatform } from './defaults.js';

// ── Read package version ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8'));

// ── Resolve provider config from env vars at startup ──

function resolveConfig(projectDir) {
  const provider = (process.env.SHIPLI_PROVIDER || 'gemini').toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    throw new Error(`Unknown provider "${provider}". Set SHIPLI_PROVIDER to "gemini" or "claude".`);
  }

  const model = process.env.SHIPLI_MODEL || defaults.model;
  const apiKey = process.env[defaults.envKey];

  if (!apiKey) {
    throw new Error(
      `No API key found. Set ${defaults.envKey} in your MCP server env config.`
    );
  }

  return { provider, model, apiKey };
}

// ── Validate project directory ──

function validateProject(projectDir) {
  const resolved = resolve(projectDir);
  if (!existsSync(resolved)) {
    throw new Error(`Directory not found: ${resolved}`);
  }
  if (!existsSync(join(resolved, 'lib'))) {
    throw new Error(`No lib/ directory found in ${resolved}. Is this a Flutter project?`);
  }
  return resolved;
}

// ── Create server ──

const server = new McpServer({
  name: 'shipli',
  version: pkg.version,
});

// ── Tool: shipli_store_audit ──

server.tool(
  'shipli_store_audit',
  'Run a store compliance audit on a Flutter project against Apple App Store and/or Google Play guidelines. Scans Dart source files, pubspec.yaml, Info.plist (iOS), and AndroidManifest.xml (Android). Returns structured JSON with PASS/WARNING/FAIL scores, specific guideline citations, and actionable fix suggestions. Supports both Flutter apps and packages.',
  {
    projectDir: z.string().describe('Absolute path to the Flutter project root directory. Must contain a pubspec.yaml and a lib/ folder. Example: "/Users/you/projects/my-flutter-app"'),
    platform: z.enum(['ios', 'android', 'both']).optional().describe('Target platform: "ios" (App Store only), "android" (Play Store only), or "both" (both stores). Auto-detected from ios/ and android/ directory presence if omitted.'),
  },
  async ({ projectDir, platform }) => {
    try {
      const dir = validateProject(projectDir);
      const { provider, model, apiKey } = resolveConfig(dir);

      const pubspec = await readPubspec(dir);
      const projectType = pubspec.projectType;
      const resolvedPlatform = platform || detectPlatform(dir);

      const { files } = await scan(dir);

      let exampleFiles = [];
      if (projectType === 'package' && existsSync(join(dir, 'example', 'lib'))) {
        const exampleResult = await scan(join(dir, 'example'));
        exampleFiles = exampleResult.files;
      }

      let plistData = { found: false, permissions: {}, bundleId: null };
      let manifestData = { found: false, permissions: [], packageName: null };

      if (projectType === 'app' && (resolvedPlatform === 'ios' || resolvedPlatform === 'both')) {
        plistData = await readPlist(dir);
      }
      if (projectType === 'app' && (resolvedPlatform === 'android' || resolvedPlatform === 'both')) {
        manifestData = await readManifest(dir);
      }

      let appleGuidelines = null;
      let googleGuidelines = null;

      if (resolvedPlatform === 'ios' || resolvedPlatform === 'both') {
        appleGuidelines = await fetchGuidelines('apple');
      }
      if (resolvedPlatform === 'android' || resolvedPlatform === 'both') {
        googleGuidelines = await fetchGuidelines('google');
      }

      const result = await audit(
        {
          files,
          exampleFiles,
          permissions: plistData.permissions,
          androidPermissions: manifestData.permissions,
          pubspec,
          plistFound: (resolvedPlatform === 'ios' || resolvedPlatform === 'both') ? plistData.found : undefined,
          androidManifestFound: (resolvedPlatform === 'android' || resolvedPlatform === 'both') ? manifestData.found : undefined,
          projectType,
          appleGuidelines,
          googleGuidelines,
        },
        { apiKey, model, provider, mode: 'store', platform: resolvedPlatform },
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: shipli_code_review ──

server.tool(
  'shipli_code_review',
  'Run a code quality and security review on a Flutter project. Scans all Dart source files and pubspec.yaml. Checks architecture patterns, error handling, performance issues, dependency hygiene, and security vulnerabilities. Returns structured JSON with findings, severity levels, and fix suggestions. Supports both Flutter apps and packages (including example/ directories).',
  {
    projectDir: z.string().describe('Absolute path to the Flutter project root directory. Must contain a pubspec.yaml and a lib/ folder. Example: "/Users/you/projects/my-flutter-app"'),
  },
  async ({ projectDir }) => {
    try {
      const dir = validateProject(projectDir);
      const { provider, model, apiKey } = resolveConfig(dir);

      const pubspec = await readPubspec(dir);
      const projectType = pubspec.projectType;

      const { files } = await scan(dir);

      let exampleFiles = [];
      if (projectType === 'package' && existsSync(join(dir, 'example', 'lib'))) {
        const exampleResult = await scan(join(dir, 'example'));
        exampleFiles = exampleResult.files;
      }

      const result = await audit(
        {
          files,
          exampleFiles,
          permissions: {},
          androidPermissions: [],
          pubspec,
          plistFound: undefined,
          androidManifestFound: undefined,
          projectType,
          appleGuidelines: null,
          googleGuidelines: null,
        },
        { apiKey, model, provider, mode: 'code', platform: 'both' },
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// ── Start server ──

const transport = new StdioServerTransport();
await server.connect(transport);
