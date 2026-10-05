import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readProjectMetadata, validateProject } from '../src/project-reader.js';
import { scan } from '../src/scanner.js';

async function withTempProject(setupFn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'shipli-test-'));
  try {
    await setupFn(dir);
    return dir;
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

test('readProjectMetadata detects a React Native app from package.json', async (t) => {
  const dir = await withTempProject(async (projectDir) => {
    await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'rn-app',
      version: '1.0.0',
      dependencies: {
        react: '^19.0.0',
        'react-native': '^0.81.0',
      },
      scripts: {
        start: 'react-native start',
      },
    }, null, 2));
  });

  t.after(async () => rm(dir, { recursive: true, force: true }));

  const validated = validateProject(dir);
  const metadata = await readProjectMetadata(validated);

  assert.equal(metadata.ecosystem, 'react-native');
  assert.equal(metadata.projectType, 'app');
  assert.deepEqual(metadata.scripts, ['start']);
});

test('scan captures React Native JS/TS files from standard app locations', async (t) => {
  const dir = await withTempProject(async (projectDir) => {
    await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'rn-app',
      version: '1.0.0',
      dependencies: {
        react: '^19.0.0',
        'react-native': '^0.81.0',
      },
    }, null, 2));
    await mkdir(path.join(projectDir, 'src', 'screens'), { recursive: true });
    await writeFile(path.join(projectDir, 'App.tsx'), [
      "import React from 'react';",
      "import { View, Text, StyleSheet } from 'react-native';",
      '',
      'export function App() {',
      '  return (',
      '    <View>',
      '      <Text>Hello</Text>',
      '    </View>',
      '  );',
      '}',
      '',
      'const styles = StyleSheet.create({});',
      '',
    ].join('\n'));
    await writeFile(path.join(projectDir, 'src', 'screens', 'HomeScreen.tsx'), [
      "import { useNavigation } from '@react-navigation/native';",
      'export const HomeScreen = () => {',
      '  const navigation = useNavigation();',
      '  return null;',
      '};',
      '',
    ].join('\n'));
  });

  t.after(async () => rm(dir, { recursive: true, force: true }));

  const result = await scan(dir, { ecosystem: 'react-native' });

  assert.equal(result.stats.totalFiles, 2);
  assert.ok(result.files.some((file) => file.relativePath === 'App.tsx'));
  assert.ok(result.files.some((file) => file.relativePath === path.join('src', 'screens', 'HomeScreen.tsx')));
  assert.ok(result.files.some((file) => file.skeleton.includes('StyleSheet.create')));
  assert.ok(result.files.some((file) => file.skeleton.includes('useNavigation')));
});
