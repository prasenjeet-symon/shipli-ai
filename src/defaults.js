import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Keep these aligned with the providers offered by `shipli init`.
export const PROVIDER_DEFAULTS = {
  gemini: { model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  claude: { model: 'claude-sonnet-4-6', envKey: 'ANTHROPIC_API_KEY' },
};

export function detectPlatform(projectDir) {
  const ios = existsSync(join(projectDir, 'ios'));
  const android = existsSync(join(projectDir, 'android'));
  if (ios && !android) return 'ios';
  if (android && !ios) return 'android';
  return 'both';
}
