import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function read(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');

  try {
    const content = await readFile(pkgPath, 'utf-8');
    const doc = JSON.parse(content);

    const deps = Object.assign({}, doc.dependencies || {}, doc.peerDependencies || {});
    const devDeps = Object.keys(doc.devDependencies || {});

    // Heuristic: if react-native present in dependencies, it's an app or RN package
    const hasRN = !!(deps['react-native'] || deps['react-native-cli']);
    const isPackage = !!doc.name && !!doc.main && !hasRN && (doc.private !== false);

    return {
      name: doc.name || 'unknown',
      version: doc.version || null,
      description: doc.description || null,
      dependencies: Object.keys(deps),
      devDependencies: devDeps,
      projectType: hasRN ? 'react-native' : (isPackage ? 'package' : 'node'),
      raw: doc,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('package.json not found. Is this a JavaScript/React Native project?');
    }
    throw err;
  }
}
