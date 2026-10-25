import test from 'node:test';
import assert from 'node:assert/strict';
import { symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, rn, flutter, plist } from './helpers/project.js';

// Dynamic import keeps a missing implementation an explicit test failure.
const project = () => import('../src/project.js');

test('detects bare apps, RN libraries, and Expo while rejecting unrelated package.json', async (t) => {
  const { detectProject } = await project();
  const app = await fixture(t, rn);
  assert.equal((await detectProject(app)).framework, 'react-native');
  assert.equal((await detectProject(app)).metadata.dependencyVersions['react-native'], '0.82.0');
  const lib = await fixture(t, { 'package.json': { name: 'rn-library', 'react-native': 'src/index.ts', peerDependencies: { 'react-native': '*' }, devDependencies: { 'react-native': '0.82.0' } } });
  assert.equal((await detectProject(lib)).projectType, 'package');
  const managed = await fixture(t, { 'package.json': { dependencies: { expo: '^54' } }, 'app.json': { expo: { platforms: ['ios'], ios: { bundleIdentifier: 'com.demo.app' } } } });
  const expo = await detectProject(managed);
  assert.equal(expo.framework, 'react-native');
  assert.equal(expo.platform, 'ios');
  assert.equal(expo.metadata.expoConfig.ios.bundleIdentifier, 'com.demo.app');
  for (const pkg of [{ dependencies: { react: '*' } }, [], null, { dependencies: ['react-native'] }]) {
    const dir = await fixture(t, { 'package.json': JSON.stringify(pkg) });
    await assert.rejects(detectProject(dir), /React Native|package\.json/);
  }
});

test('preserves Flutter app/plugin detection even beside a tooling package.json', async (t) => {
  const { detectProject } = await project();
  const dir = await fixture(t, { ...flutter, 'package.json': { devDependencies: { prettier: '*' } } });
  assert.equal((await detectProject(dir)).framework, 'flutter');
  const plugin = await fixture(t, { ...flutter, 'pubspec.yaml': `${flutter['pubspec.yaml']}flutter:\n  plugin:\n    platforms:\n      android:\n        package: com.test\n        pluginClass: TestPlugin\n` });
  assert.equal((await detectProject(plugin)).projectType, 'package');
});

test('never executes dynamic Expo config and distinguishes it from resolved native evidence', async (t) => {
  const { detectProject } = await project();
  const dir = await fixture(t, { ...rn, 'package.json': { dependencies: { expo: '*' } },
    'app.config.js': "throw new Error('must never execute project code')",
    'app.json': { expo: { name: 'static-part', extra: { token: 'should-not-send-extra' } } },
  });
  const result = await detectProject(dir);
  assert.deepEqual(result.metadata.dynamicConfigFiles, ['app.config.js']);
  assert.equal(result.metadata.expoConfig.name, 'static-part');
  assert.equal(result.metadata.expoConfig.extra, undefined);
});

test('RN scan covers conventions while excluding dependency/generated files and external symlinks', async (t) => {
  const { collectEvidence } = await project();
  const ignored = ['node_modules/secret.js', 'nested/node_modules/secret.ts', '.expo/cache.js', 'ios/Pods/Vendor/secret.js', 'android/build/generated.js', 'dist/bundle.js', 'coverage/coverage.js', 'src/generated/client.ts', 'src/__generated__/types.ts', 'src/types.d.ts', 'src/file.generated.ts', 'bundle.min.js'];
  const included = ['App.js', 'app/(tabs)/index.tsx', 'src/component.jsx', 'components/Button.ios.tsx', 'lib/index.ts'];
  const dir = await fixture(t, { ...rn, ...Object.fromEntries([...ignored, ...included].map(p => [p, 'export const source = 1;'])) });
  const outside = await fixture(t, { 'secret.js': 'outside-content' });
  await symlink(join(outside, 'secret.js'), join(dir, 'external.js'));
  const { evidence, stats } = await collectEvidence(dir, { mode: 'code' });
  const paths = evidence.files.map(f => f.relativePath);
  for (const p of included) assert.ok(paths.includes(p), p);
  for (const p of [...ignored, 'external.js']) assert.ok(!paths.includes(p), p);
  assert.equal(stats.totalFiles, included.length + 1);
  assert.match(evidence.files.find(f => f.relativePath === 'App.tsx').skeleton, /3: export default/);
  assert.ok(evidence.reactNativeGuidelines.content.includes('RN-001'));
});

test('RN evidence labels every relevant iOS plist and ignores pods and test bundles', async (t) => {
  const { collectEvidence } = await project();
  const dir = await fixture(t, { ...rn,
    'ios/First/Info.plist': plist('com.first', 'First permission'),
    'ios/Second/Info.plist': plist('com.second', 'Second permission'),
    'ios/FirstTests/Info.plist': plist('com.tests', 'Ignore test'),
    'ios/Pods/Vendor/Info.plist': plist('com.vendor', 'Ignore vendor'),
  });
  const { evidence } = await collectEvidence(dir, { mode: 'store' });
  assert.deepEqual(evidence.plistFiles.map(f => f.relativePath), ['ios/First/Info.plist', 'ios/Second/Info.plist']);
  assert.equal(evidence.plistFiles[1].permissions.NSCameraUsageDescription, 'Second permission');
});

test('RN scan reports empty source and keeps strict bounded evidence with truncation notices', async (t) => {
  const { collectEvidence } = await project();
  const empty = await fixture(t, { 'package.json': rn['package.json'] });
  await assert.rejects(collectEvidence(empty, { mode: 'code' }), /No.*(JavaScript|TypeScript|source)/);
  const files = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`src/file${i}.ts`, 'const value = 1;\n'.repeat(400)]));
  const dir = await fixture(t, { 'package.json': rn['package.json'], ...files });
  const { evidence, stats } = await collectEvidence(dir, { mode: 'code' });
  assert.ok(evidence.files.reduce((sum, f) => sum + f.skeleton.split('\n').length, 0) <= 8000);
  assert.ok(stats.truncatedFiles > 0);
  assert.match(evidence.files[0].skeleton, /omitted/);
});

test('RN source preserves unusual project paths and bounds individual long lines', async (t) => {
  const { collectEvidence } = await project();
  const dir = await fixture(t, { ...rn, 'src/# percent %.tsx': 'export const payload = "' + 'x'.repeat(5000) + '";' });
  const { evidence } = await collectEvidence(dir, { mode: 'code' });
  const source = evidence.files.find(f => f.relativePath === 'src/# percent %.tsx');
  assert.ok(source);
  assert.match(source.skeleton, /line omitted after character limit/);
  assert.ok(source.skeleton.length < 2500);
});

test('static Expo config precedence and dynamic overrides do not infer a single platform', async (t) => {
  const { detectProject } = await project();
  const dir = await fixture(t, { 'package.json': { dependencies: { expo: '*' } },
    'app.json': { expo: { name: 'lower', platforms: ['android'] } },
    'app.config.json': { name: 'higher', platforms: ['ios'] },
    'app.config.ts': 'throw new Error("do not execute");',
  });
  const result = await detectProject(dir);
  assert.equal(result.metadata.expoConfig.name, 'higher');
  assert.equal(result.metadata.expoConfigFile, 'app.config.json');
  assert.equal(result.platform, 'both');
});

for (const file of ['app.json', 'app.config.json']) {
  for (const [syntax, config] of [
    ['comments', '{ /* Expo permits comments */ "expo": { "name": "commented", "platforms": ["ios"] } // trailing comment\n}'],
    ['trailing commas', '{ "expo": { "name": "comma", "platforms": ["ios",], }, }'],
    ['JSON5 strings and keys', "{ expo: { name: 'quoted', platforms: ['ios'], updates: { url: 'https://example.test/a/*literal*/?q=//literal' } } }"],
  ]) {
    test(`reads ${syntax} in static Expo ${file}`, async (t) => {
      const { detectProject } = await project();
      const dir = await fixture(t, { 'package.json': { dependencies: { expo: '*' } }, [file]: config });
      const result = await detectProject(dir);
      assert.equal(result.metadata.expoConfigFile, file);
      assert.equal(result.platform, 'ios');
      assert.deepEqual(result.metadata.expoConfig.platforms, ['ios']);
      if (syntax === 'JSON5 strings and keys') {
        assert.equal(result.metadata.expoConfig.updates.url, 'https://example.test/a/*literal*/?q=//literal');
      }
    });
  }
}

test('package.json remains strict JSON even for Expo projects', async (t) => {
  const { detectProject } = await project();
  for (const pkg of [
    '{ /* not permitted in package.json */ "dependencies": { "expo": "*" } }',
    '{ "dependencies": { "expo": "*", }, }',
    "{ dependencies: { expo: '*' } }",
  ]) {
    const dir = await fixture(t, { 'package.json': pkg });
    await assert.rejects(detectProject(dir), /Could not read .*package\.json/);
  }
});

test('static Expo configs reject malformed input and non-object roots', async (t) => {
  const { detectProject } = await project();
  for (const file of ['app.json', 'app.config.json']) {
    for (const config of ['null', '[]', 'true', '42', '"string"', '{ "expo": { "name": } }']) {
      const dir = await fixture(t, { 'package.json': { dependencies: { expo: '*' } }, [file]: config });
      await assert.rejects(detectProject(dir), new RegExp(`Could not read .*${file.replaceAll('.', '\\.')}`));
    }
  }
});

test('static Expo configuration does not evaluate JavaScript expressions', async (t) => {
  const { detectProject } = await project();
  const marker = '__shipliStaticConfigExecuted';
  assert.equal(globalThis[marker], undefined);
  t.after(() => { delete globalThis[marker]; });
  for (const file of ['app.json', 'app.config.json']) {
    const dir = await fixture(t, { 'package.json': { dependencies: { expo: '*' } },
      [file]: `{ expo: { name: (() => { globalThis.${marker} = true; return 'executed'; })() } }`,
    });
    await assert.rejects(detectProject(dir), /Could not read/);
    assert.equal(globalThis[marker], undefined);
  }
});

test('all supported dynamic Expo config extensions are reported without execution', async (t) => {
  const { detectProject } = await project();
  for (const extension of ['js', 'ts', 'mjs', 'cjs', 'mts', 'cts']) {
    const dir = await fixture(t, { 'package.json': { dependencies: { expo: '*' } },
      'app.json': { expo: { platforms: ['ios'] } },
      [`app.config.${extension}`]: 'throw new Error("must never execute");',
    });
    const result = await detectProject(dir);
    assert.deepEqual(result.metadata.dynamicConfigFiles, [`app.config.${extension}`]);
    assert.equal(result.platform, 'both');
  }
});

test('RN scanner ignores symlinked directories outside the audited project', async (t) => {
  const { collectEvidence } = await project();
  const dir = await fixture(t, rn);
  const outside = await fixture(t, { 'source.ts': 'export const doNotRead = 1;' });
  await symlink(outside, join(dir, 'linked-folder'), 'dir');
  const { evidence } = await collectEvidence(dir, { mode: 'code' });
  assert.deepEqual(evidence.files.map(f => f.relativePath), ['App.tsx']);
});

test('RN metadata rejects files outside the project but allows an internal config symlink', async (t) => {
  const { detectProject } = await project();
  const outside = await fixture(t, { 'app.json': { expo: { name: 'outside-metadata' } }, 'package.json': { dependencies: { expo: '*' } }, 'app.config.json': { expo: { name: 'outside-config' } } });
  for (const file of ['package.json', 'app.json', 'app.config.json']) {
    const dir = await fixture(t, file === 'package.json' ? {} : { 'package.json': { dependencies: { expo: '*' } } });
    await symlink(join(outside, file), join(dir, file));
    await assert.rejects(detectProject(dir), /outside.*project/i);
  }
  const inside = await fixture(t, { 'package.json': { dependencies: { expo: '*' } }, 'config/app.json': { expo: { name: 'inside' } } });
  await symlink(join(inside, 'config/app.json'), join(inside, 'app.json'));
  assert.equal((await detectProject(inside)).metadata.expoConfig.name, 'inside');
});

test('RN native metadata cannot escape through file or ancestor symlinks', async (t) => {
  const { collectEvidence } = await project();
  const outside = await fixture(t, {
    'AndroidManifest.xml': '<manifest><uses-permission android:name="outside.marker" /></manifest>',
    'Info.plist': plist('outside.marker', 'outside.marker'),
    'Native/Info.plist': plist('outside.marker', 'outside.marker'),
  });
  for (const ancestor of [false, true]) {
    const android = await fixture(t, { ...rn, 'android/app/src/main/.keep': '' });
    if (ancestor) {
      const { rm } = await import('node:fs/promises');
      await rm(join(android, 'android/app/src/main'), { recursive: true });
      await symlink(outside, join(android, 'android/app/src/main'), 'dir');
    } else await symlink(join(outside, 'AndroidManifest.xml'), join(android, 'android/app/src/main/AndroidManifest.xml'));
    await assert.rejects(collectEvidence(android, { mode: 'store', platform: 'android' }), /outside.*project/i);

    const ios = await fixture(t, { ...rn, 'ios/.keep': '' });
    if (ancestor) await symlink(join(outside, 'Native'), join(ios, 'ios/Native'), 'dir');
    else await symlink(join(outside, 'Info.plist'), join(ios, 'ios/Info.plist'));
    const { evidence } = await collectEvidence(ios, { mode: 'store', platform: 'ios' });
    assert.equal(evidence.plistFound, false);
    assert.deepEqual(evidence.plistFiles, []);
  }
});
