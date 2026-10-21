import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { read as readPubspec } from './pubspec-reader.js';
import { read as readPackage } from './package-reader.js';
import { read as readPlist } from './plist-reader.js';
import { read as readManifest } from './manifest-reader.js';
import { scan as scanDart } from './scanner.js';
import { scan as scanReactNative } from './react-native-scanner.js';
import { detectPlatform } from './defaults.js';
import { fetchGuidelines } from './guidelines.js';

/** One detection path shared by the CLI and both MCP tools. */
export async function detectProject(projectDir) {
  const dir = resolve(projectDir);
  let directory;
  try { directory = await stat(dir); } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`Directory not found: ${dir}`);
    throw err;
  }
  if (!directory.isDirectory()) throw new Error(`Not a project directory: ${dir}`);

  // A Flutter project can also have package.json for JS build/lint tooling.
  if (existsSync(join(dir, 'pubspec.yaml')) && existsSync(join(dir, 'lib'))) {
    const metadata = await readPubspec(dir);
    return { dir, framework: 'flutter', label: 'Flutter', metadata, projectType: metadata.projectType, platform: detectPlatform(dir) };
  }
  const metadata = await readPackage(dir);
  if (!metadata) throw new Error('Unsupported project. Expected Flutter (pubspec.yaml and lib/) or React Native/Expo dependencies in package.json.');
  let platform = detectPlatform(dir);
  if (!existsSync(join(dir, 'ios')) && !existsSync(join(dir, 'android')) && !metadata.dynamicConfigFiles.length) {
    const platforms = metadata.expoConfig?.platforms;
    if (Array.isArray(platforms)) {
      const ios = platforms.includes('ios'), android = platforms.includes('android');
      if (ios && !android) platform = 'ios';
      if (android && !ios) platform = 'android';
    }
  }
  return { dir, framework: 'react-native', label: 'React Native', metadata, projectType: metadata.projectType, platform };
}

/** Collect identical evidence for every entry point; code mode does not load store policies. */
export async function collectEvidence(projectDir, { project, mode = 'both', platform, projectType } = {}) {
  project ||= await detectProject(projectDir);
  const { dir, framework, metadata } = project;
  platform ||= project.platform;
  projectType ||= project.projectType;
  const scanner = framework === 'react-native' ? scanReactNative : scanDart;
  const { files, stats } = await scanner(dir);
  let exampleFiles = [];
  if (projectType === 'package' && framework === 'flutter' && existsSync(join(dir, 'example', 'lib'))) {
    exampleFiles = (await scanDart(join(dir, 'example'))).files;
  }

  const ios = mode !== 'code' && (platform === 'ios' || platform === 'both');
  const android = mode !== 'code' && (platform === 'android' || platform === 'both');
  const plist = projectType === 'app' && ios ? await readPlist(dir, framework) : { permissions: {}, found: undefined };
  const manifest = projectType === 'app' && android ? await readManifest(dir, framework) : { permissions: [], found: undefined };
  return {
    project, platform, projectType, stats,
    evidence: {
      framework, files, exampleFiles, projectType,
      // Retain the Flutter metadata interface for existing auditor callers.
      pubspec: metadata, packageJson: framework === 'react-native' ? metadata : undefined,
      permissions: plist.permissions, androidPermissions: manifest.permissions,
      plistFound: plist.found, androidManifestFound: manifest.found, plistFiles: plist.files,
      appleGuidelines: ios ? await fetchGuidelines('apple') : null,
      googleGuidelines: android ? await fetchGuidelines('google') : null,
      reactNativeGuidelines: framework === 'react-native' ? await fetchGuidelines('react-native') : null,
      scanStats: stats,
    },
  };
}
