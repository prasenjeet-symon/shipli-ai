#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from './scanner.js';
import { read as readPlist } from './plist-reader.js';
import { read as readManifest } from './manifest-reader.js';
import { fetchGuidelines } from './guidelines.js';
import { audit } from './auditor.js';
import { PROVIDER_DEFAULTS, detectPlatform } from './defaults.js';
import { readProjectMetadata, validateProject } from './project-reader.js';
import { trackEvent } from './telemetry.js';

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

// ── Create server ──

const server = new McpServer({
  name: 'shipli',
  version: pkg.version,
});

// ── Tool: shipli_store_audit ──

server.tool(
  'shipli_store_audit',
  'Run a store compliance audit on a Flutter or React Native project against Apple App Store and/or Google Play guidelines. Scans source files plus native permission manifests and returns structured JSON with PASS/WARNING/FAIL scores, guideline citations, and actionable fixes.',
  {
    projectDir: z.string().describe('Absolute path to the Flutter or React Native project root directory. Example: "/Users/you/projects/my-mobile-app"'),
    platform: z.enum(['ios', 'android', 'both']).optional().describe('Target platform: "ios" (App Store only), "android" (Play Store only), or "both" (both stores). Auto-detected from ios/ and android/ directory presence if omitted.'),
  },
  async ({ projectDir, platform }) => {
    const startTime = Date.now();
    try {
      const dir = validateProject(projectDir);
      const { provider, model, apiKey } = resolveConfig(dir);

      const metadata = await readProjectMetadata(dir);
      const projectType = metadata.projectType;
      const resolvedPlatform = platform || detectPlatform(dir);

      const { files } = await scan(dir, { ecosystem: metadata.ecosystem });

      let exampleFiles = [];
      if (projectType === 'package' && metadata.ecosystem === 'flutter' && existsSync(join(dir, 'example', 'lib'))) {
        const exampleResult = await scan(join(dir, 'example'), { ecosystem: metadata.ecosystem });
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
          metadata,
          plistFound: (resolvedPlatform === 'ios' || resolvedPlatform === 'both') ? plistData.found : undefined,
          androidManifestFound: (resolvedPlatform === 'android' || resolvedPlatform === 'both') ? manifestData.found : undefined,
          projectType,
          appleGuidelines,
          googleGuidelines,
        },
        { apiKey, model, provider, mode: 'store', platform: resolvedPlatform },
      );

      trackEvent('audit_completed', {
        source: 'mcp', mode: 'store', platform: resolvedPlatform,
        provider, model, project_type: projectType, score: result.score,
        duration_ms: Date.now() - startTime,
        tokens_input: result._tokens?.actual?.input ?? null,
        tokens_output: result._tokens?.actual?.output ?? null,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      trackEvent('audit_error', {
        source: 'mcp', mode: 'store',
        duration_ms: Date.now() - startTime,
        error_message: err.message.slice(0, 200),
      });
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
  'Run a code quality and security review on a Flutter or React Native project. Scans source files plus project metadata, then checks architecture, error handling, performance issues, dependency hygiene, and security vulnerabilities.',
  {
    projectDir: z.string().describe('Absolute path to the Flutter or React Native project root directory. Example: "/Users/you/projects/my-mobile-app"'),
  },
  async ({ projectDir }) => {
    const startTime = Date.now();
    try {
      const dir = validateProject(projectDir);
      const { provider, model, apiKey } = resolveConfig(dir);

      const metadata = await readProjectMetadata(dir);
      const projectType = metadata.projectType;

      const { files } = await scan(dir, { ecosystem: metadata.ecosystem });

      let exampleFiles = [];
      if (projectType === 'package' && metadata.ecosystem === 'flutter' && existsSync(join(dir, 'example', 'lib'))) {
        const exampleResult = await scan(join(dir, 'example'), { ecosystem: metadata.ecosystem });
        exampleFiles = exampleResult.files;
      }

      const result = await audit(
        {
          files,
          exampleFiles,
          permissions: {},
          androidPermissions: [],
          metadata,
          plistFound: undefined,
          androidManifestFound: undefined,
          projectType,
          appleGuidelines: null,
          googleGuidelines: null,
        },
        { apiKey, model, provider, mode: 'code', platform: 'both' },
      );

      trackEvent('audit_completed', {
        source: 'mcp', mode: 'code', platform: 'both',
        provider, model, project_type: projectType, score: result.score,
        duration_ms: Date.now() - startTime,
        tokens_input: result._tokens?.actual?.input ?? null,
        tokens_output: result._tokens?.actual?.output ?? null,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      trackEvent('audit_error', {
        source: 'mcp', mode: 'code',
        duration_ms: Date.now() - startTime,
        error_message: err.message.slice(0, 200),
      });
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
