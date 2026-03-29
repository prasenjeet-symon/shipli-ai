import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const PROVIDER_DEFAULTS = {
  gemini: { model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  claude: { model: 'claude-sonnet-4-6', envKey: 'ANTHROPIC_API_KEY' },
};

export function detectPlatform(projectDir) {
  const hasIos = existsSync(join(projectDir, 'ios'));
  const hasAndroid = existsSync(join(projectDir, 'android'));
  if (hasIos && hasAndroid) return 'both';
  if (hasIos) return 'ios';
  if (hasAndroid) return 'android';
  return 'both';
}
