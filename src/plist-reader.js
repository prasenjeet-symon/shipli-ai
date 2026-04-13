import { readFile } from 'node:fs/promises';
import path from 'node:path';
import plist from 'plist';
import fg from 'fast-glob';

// Try to locate a Info.plist for both Flutter and React Native projects.
export async function read(projectDir) {
  // Candidate glob patterns inside ios/ folder
  const candidates = await fg.glob('ios/**/Info.plist', { cwd: projectDir, absolute: true });

  // Prefer ios/Runner/Info.plist if present (Flutter default)
  let plistPath = candidates.find(p => p.endsWith(path.join('ios', 'Runner', 'Info.plist')));
  if (!plistPath) plistPath = candidates[0];

  if (!plistPath) {
    return { found: false, permissions: {}, bundleId: null };
  }

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
      path: plistPath,
    };
  } catch (err) {
    throw err;
  }
}
