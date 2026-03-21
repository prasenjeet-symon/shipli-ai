import { readFile } from 'node:fs/promises';
import path from 'node:path';
import plist from 'plist';

export async function read(projectDir) {
  const plistPath = path.join(projectDir, 'ios', 'Runner', 'Info.plist');

  try {
    const xml = await readFile(plistPath, 'utf-8');
    const parsed = plist.parse(xml);

    const permissions = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('NS') && key.endsWith('UsageDescription')) {
        permissions[key] = value;
      }
    }

    return {
      found: true,
      permissions,
      bundleId: parsed.CFBundleIdentifier || null,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { found: false, permissions: {}, bundleId: null };
    }
    throw err;
  }
}
