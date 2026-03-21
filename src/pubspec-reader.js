import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

export async function read(projectDir) {
  const pubspecPath = path.join(projectDir, 'pubspec.yaml');

  try {
    const content = await readFile(pubspecPath, 'utf-8');
    const doc = yaml.load(content);

    const flutterSection = doc.flutter || {};
    const isPlugin = !!flutterSection.plugin;

    return {
      name: doc.name || 'unknown',
      version: doc.version || null,
      description: doc.description || null,
      dependencies: Object.keys(doc.dependencies || {}),
      devDependencies: Object.keys(doc.dev_dependencies || {}),
      projectType: isPlugin ? 'package' : 'app',
      pluginPlatforms: isPlugin ? (flutterSection.plugin.platforms || null) : null,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('pubspec.yaml not found. Is this a Flutter project?');
    }
    throw err;
  }
}
