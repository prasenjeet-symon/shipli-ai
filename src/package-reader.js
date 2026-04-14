import { readFile } from 'node:fs/promises';
import path from 'node:path';

function isReactNativePackage(pkg) {
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };

  return Boolean(deps['react-native'] || deps.expo);
}

export async function read(projectDir) {
  const packagePath = path.join(projectDir, 'package.json');

  try {
    const content = await readFile(packagePath, 'utf-8');
    const pkg = JSON.parse(content);

    if (!isReactNativePackage(pkg)) {
      throw new Error('package.json found, but no react-native or expo dependency is declared.');
    }

    return {
      name: pkg.name || 'unknown',
      version: pkg.version || null,
      description: pkg.description || null,
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      scripts: Object.keys(pkg.scripts || {}),
      projectType: 'app',
      ecosystem: 'react-native',
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('package.json not found. Is this a React Native project?');
    }
    throw err;
  }
}
