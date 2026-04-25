import { readFile } from 'node:fs/promises';
import path from 'node:path';
import plist from 'plist';
import fg from 'fast-glob';

export async function read(projectDir) {
  const candidates = [
    path.join(projectDir, 'ios', 'Runner', 'Info.plist'),
    ...(await fg.glob('ios/**/Info.plist', {
      cwd: projectDir,
      absolute: true,
      ignore: ['**/Pods/**', '**/build/**'],
    })),
  ];
  const plistPath = candidates[0];

  try {
    if (!plistPath) {
      return { found: false, permissions: {}, bundleId: null };
    }
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
