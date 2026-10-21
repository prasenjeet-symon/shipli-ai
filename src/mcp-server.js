#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit } from './auditor.js';
import { collectEvidence, detectProject } from './project.js';
import { PROVIDER_DEFAULTS } from './defaults.js';
import { trackEvent } from './telemetry.js';

// ── Read package version ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8'));

// ── Resolve provider config from env vars at startup ──

function resolveConfig() {
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
  'Run a store compliance audit on a Flutter or React Native/Expo project against Apple App Store and/or Google Play guidelines. Scans source files, dependency metadata, and native or static Expo configuration. Returns structured JSON with PASS/WARNING/FAIL scores, guideline citations, and actionable suggestions. Supports apps and packages.',
  {
    projectDir: z.string().describe('Absolute path to a Flutter root (pubspec.yaml and lib/) or React Native/Expo root (package.json declaring react-native or expo).'),
    platform: z.enum(['ios', 'android', 'both']).optional().describe('Target platform: "ios" (App Store only), "android" (Play Store only), or "both" (both stores). Auto-detected from ios/ and android/ directory presence if omitted.'),
  },
  async ({ projectDir, platform }) => {
    const startTime = Date.now();
    try {
      const project = await detectProject(projectDir);
      const { provider, model, apiKey } = resolveConfig();
      const { evidence, projectType, platform: resolvedPlatform } = await collectEvidence(projectDir, { project, mode: 'store', platform });
      const result = await audit(evidence, { apiKey, model, provider, mode: 'store', platform: resolvedPlatform });

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
  'Run a code quality and security review on a Flutter or React Native/Expo project. Scans Dart or JavaScript/TypeScript source and dependencies. React Native guidance covers navigation, state, native modules, and performance. Returns structured JSON with findings, severity levels, and suggestions. Supports apps and packages.',
  {
    projectDir: z.string().describe('Absolute path to a Flutter root (pubspec.yaml and lib/) or React Native/Expo root (package.json declaring react-native or expo).'),
  },
  async ({ projectDir }) => {
    const startTime = Date.now();
    try {
      const project = await detectProject(projectDir);
      const { provider, model, apiKey } = resolveConfig();
      const { evidence, projectType } = await collectEvidence(projectDir, { project, mode: 'code' });
      const result = await audit(evidence, { apiKey, model, provider, mode: 'code', platform: 'both' });

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
