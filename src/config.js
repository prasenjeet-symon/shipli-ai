import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function readConfigFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Config must be a JSON object');
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
    }
    throw err;
  }
}

export async function loadConfig(projectDir) {
  // Load home-level config first, then project-level overrides
  const homeConfig = await readConfigFile(join(homedir(), '.shipli'));
  const projectConfig = projectDir
    ? await readConfigFile(join(projectDir, '.shipli'))
    : null;

  const merged = {
    ...(homeConfig || {}),
    ...(projectConfig || {}),
  };

  return {
    provider: merged.provider || undefined,
    model: merged.model || undefined,
    key: merged.key || undefined,
    type: merged.type || undefined,
    mode: merged.mode || undefined,
    platform: merged.platform || undefined,
  };
}
