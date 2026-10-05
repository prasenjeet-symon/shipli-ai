import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const PROVIDER_DEFAULTS = {
  claude: {
    envKey: 'ANTHROPIC_API_KEY',
    model: 'claude-sonnet-4-6',
  },
  gemini: {
    envKey: 'GEMINI_API_KEY',
    model: 'gemini-2.5-flash',
  },
};

export function detectPlatform(projectDir) {
  const hasIos = existsSync(join(projectDir, 'ios'));
  const hasAndroid = existsSync(join(projectDir, 'android'));

  if (hasIos && hasAndroid) return 'both';
  if (hasIos) return 'ios';
  if (hasAndroid) return 'android';
  return 'both';
}
