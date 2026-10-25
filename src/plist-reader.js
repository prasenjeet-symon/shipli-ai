import { readFile } from 'node:fs/promises';
import path from 'node:path';
import plist from 'plist';
import fg from 'fast-glob';
import { readProjectFile } from './project-file.js';

async function parse(projectDir, relativePath, framework = 'flutter') {
  const xml = framework === 'react-native'
    ? await readProjectFile(projectDir, relativePath)
    : await readFile(path.join(projectDir, relativePath), 'utf-8');
  const parsed = plist.parse(xml);
  const permissions = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('NS') && key.endsWith('UsageDescription')) permissions[key] = value;
  }
  return { relativePath, permissions, bundleId: parsed.CFBundleIdentifier || null };
}

export async function read(projectDir, framework = 'flutter') {
  if (framework === 'react-native') {
    const candidates = (await fg.glob('ios/**/Info.plist', {
      cwd: projectDir, followSymbolicLinks: false,
      ignore: ['**/Pods/**', '**/build/**', '**/DerivedData/**', '**/node_modules/**'],
    })).filter(file => !file.split('/').some(part => /(?:Tests|UITests|\.xctest)$/i.test(part))).sort();
    const files = await Promise.all(candidates.map(file => parse(projectDir, file, framework)));
    // Keep separate target evidence instead of silently selecting or combining permissions.
    return { found: files.length > 0, permissions: files.length === 1 ? files[0].permissions : {}, bundleId: files.length === 1 ? files[0].bundleId : null, files };
  }
  try {
    return { found: true, ...await parse(projectDir, 'ios/Runner/Info.plist') };
  } catch (err) {
    if (err.code === 'ENOENT') return { found: false, permissions: {}, bundleId: null };
    throw err;
  }
}
