// Minimal defaults used by the CLI and tests. This file is intentionally small
// and provides sensible defaults for local testing.

export const PROVIDER_DEFAULTS = {
  gemini: { envKey: 'GEMINI_API_KEY', model: 'gemini-small' },
  claude: { envKey: 'CLAUDE_API_KEY', model: 'claude-v1' },
};

/**
 * Simple platform detection used when --platform is not provided.
 * Heuristic: check for ios/ and android/ folders inside projectDir.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

export function detectPlatform(projectDir) {
  const hasIos = existsSync(path.join(projectDir, 'ios'));
  const hasAndroid = existsSync(path.join(projectDir, 'android'));
  if (hasIos && hasAndroid) return 'both';
  if (hasIos) return 'ios';
  if (hasAndroid) return 'android';
  return 'both';
}
