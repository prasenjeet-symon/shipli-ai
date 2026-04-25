import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { read as readPackage } from './package-reader.js';
import { read as readPubspec } from './pubspec-reader.js';

export function validateProject(projectDir) {
  const resolved = resolve(projectDir);
  const hasPubspec = existsSync(join(resolved, 'pubspec.yaml'));
  const hasPackageJson = existsSync(join(resolved, 'package.json'));

  if (!hasPubspec && !hasPackageJson) {
    throw new Error(`No pubspec.yaml or package.json found in ${resolved}. Shipli currently supports Flutter and React Native projects.`);
  }

  if (hasPubspec && !existsSync(join(resolved, 'lib'))) {
    throw new Error(`No lib/ directory found in ${resolved}. Is this a Flutter project?`);
  }

  return resolved;
}

export async function readProjectMetadata(projectDir) {
  const resolved = resolve(projectDir);

  if (existsSync(join(resolved, 'pubspec.yaml'))) {
    return readPubspec(resolved);
  }

  if (existsSync(join(resolved, 'package.json'))) {
    return readPackage(resolved);
  }

  throw new Error(`No supported project metadata found in ${resolved}.`);
}
