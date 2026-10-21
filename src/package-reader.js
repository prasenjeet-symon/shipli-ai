import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readProjectFile } from './project-file.js';

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(projectDir, file) {
  const path = join(projectDir, file);
  try {
    const value = JSON.parse(await readProjectFile(projectDir, file));
    if (!object(value)) throw new Error('expected a JSON object');
    return value;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`Could not read ${path}: ${err.message}`);
  }
}

function dependencies(pkg, key) {
  if (pkg[key] === undefined) return {};
  if (!object(pkg[key]) || Object.values(pkg[key]).some(v => typeof v !== 'string')) {
    throw new Error(`Invalid ${key} in package.json: expected dependency version strings`);
  }
  return pkg[key];
}

/** Read static metadata only. Never import or execute project configuration. */
export async function read(projectDir) {
  const pkg = await readJson(projectDir, 'package.json');
  if (!pkg) return null;
  const deps = dependencies(pkg, 'dependencies');
  const dev = dependencies(pkg, 'devDependencies');
  const peers = dependencies(pkg, 'peerDependencies');
  const all = { ...dev, ...peers, ...deps };
  if (!Object.hasOwn(all, 'react-native') && !Object.hasOwn(all, 'expo')) return null;

  const isExpo = Object.hasOwn(all, 'expo');
  let expoConfig = null;
  let expoConfigFile = null;
  if (isExpo) {
    // app.config.json takes precedence over app.json; executable configs are not evaluated.
    for (const file of ['app.config.json', 'app.json']) {
      const config = await readJson(projectDir, file);
      if (!config) continue;
      const source = object(config.expo) ? config.expo : config;
      // Do not transmit unrelated config.extra values such as service credentials.
      expoConfig = Object.fromEntries(['name', 'slug', 'version', 'scheme', 'platforms', 'ios', 'android', 'plugins', 'runtimeVersion', 'updates', 'newArchEnabled']
        .filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
      expoConfigFile = file;
      break;
    }
  }
  const dynamicConfigFiles = isExpo ? ['js', 'ts', 'mjs', 'cjs', 'mts', 'cts'].map(ext => `app.config.${ext}`).filter(file => existsSync(join(projectDir, file))) : [];
  return {
    name: typeof pkg.name === 'string' ? pkg.name : 'unknown',
    version: typeof pkg.version === 'string' ? pkg.version : null,
    description: typeof pkg.description === 'string' ? pkg.description : null,
    dependencies: Object.keys(deps), devDependencies: Object.keys(dev),
    dependencyVersions: deps, devDependencyVersions: dev, peerDependencies: peers,
    // Libraries commonly declare react-native as a peer and expose a native source entry.
    projectType: !pkg.private && Object.hasOwn(peers, 'react-native') && !isExpo ? 'package' : 'app',
    entryPoint: typeof pkg['react-native'] === 'string' ? pkg['react-native'] : typeof pkg.main === 'string' ? pkg.main : null,
    isExpo, expoConfig, expoConfigFile, dynamicConfigFiles,
  };
}
