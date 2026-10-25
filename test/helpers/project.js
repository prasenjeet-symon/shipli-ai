import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const root = process.env.SHIPLI_TEST_ROOT || sourceRoot;
export const preload = join(sourceRoot, 'test/helpers/model-boundary.cjs');
export async function fixture(t, files = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'shipli-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}
export function env(dir, extra = {}) {
  return {
    PATH: process.env.PATH, HOME: dir, USERPROFILE: dir,
    SHIPLI_TELEMETRY: 'off', DO_NOT_TRACK: '1', NO_COLOR: '1',
    GEMINI_API_KEY: 'shipli-test-dummy-key', SHIPLI_PROVIDER: 'gemini',
    SHIPLI_TEST_REQUEST_LOG: join(dir, 'requests.jsonl'), ...extra,
  };
}
export async function requests(dir) {
  try { return (await readFile(join(dir, 'requests.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
}
export const rn = {
  'package.json': { name: 'camera-mobile', version: '1.0.0', private: true, dependencies: { react: '^19.0.0', 'react-native': '0.82.0', '@react-navigation/native': '^7.0.0' } },
  'App.tsx': "import React from 'react';\nimport { Camera } from 'react-native-vision-camera';\nexport default function App() { return <Camera />; }",
};
export const flutter = {
  'pubspec.yaml': 'name: flutter_fixture\nversion: 1.0.0\ndependencies:\n  flutter:\n    sdk: flutter\n',
  'lib/main.dart': 'import \'package:flutter/material.dart\';\nclass App extends StatelessWidget {\n Widget build(BuildContext context) => Container();\n}',
};
export function plist(name, permission) {
  return `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${name}</string><key>NSCameraUsageDescription</key><string>${permission}</string></dict></plist>`;
}
