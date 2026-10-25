import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixture, env, requests, rn, flutter, plist, root, preload } from './helpers/project.js';

const exec = promisify(execFile);
async function cli(dir, args = [], extra = {}) {
  try {
    const result = await exec(process.execPath, ['--require', preload, join(root, 'src/index.js'), '--dir', dir, ...args], { env: env(dir, extra), timeout: 20000 });
    return { ...result, code: 0 };
  } catch (err) { return { stdout: err.stdout, stderr: err.stderr, code: err.code }; }
}
function prompt(request) {
  return { system: request.body.system_instruction?.parts[0].text || request.body.system,
    user: request.body.contents?.[0].parts[0].text || request.body.messages[0].content };
}
async function mcp(t, dir, extra = {}) {
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--require', preload, join(root, 'src/mcp-server.js')], env: env(dir, extra), stderr: 'pipe' });
  const client = new Client({ name: 'shipli-offline-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);
  return client;
}

test('CLI starts and describes both supported frameworks', async (t) => {
  const dir = await fixture(t);
  const { stdout } = await exec(process.execPath, [join(root, 'src/index.js'), '--help'], { env: env(dir), timeout: 10000 });
  assert.match(stdout, /React Native/);
});

test('real CLI audits bare React Native through all modes with native evidence', async (t) => {
  const dir = await fixture(t, { ...rn,
    'ios/CameraMobile/Info.plist': plist('com.example.camera', 'Scan a QR code'),
    'android/app/src/main/AndroidManifest.xml': '<manifest package="com.example.camera"><uses-permission android:name="android.permission.CAMERA" /></manifest>',
  });
  for (const mode of ['code', 'store', 'both']) {
    const result = await cli(dir, ['--mode', mode]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Controlled test response/);
    const { system, user } = prompt((await requests(dir)).at(-1));
    assert.match(system, /React Native/);
    assert.doesNotMatch(system, /Flutter|Dart|pub\.dev/);
    assert.match(user, /PACKAGE_JSON_METADATA/);
    assert.match(user, /react-native.*0\.82\.0/);
    assert.match(user, /REACT_NATIVE_GUIDELINES/);
    assert.match(user, /RN-001/);
    assert.match(user, /App\.tsx/);
    assert.match(user, /<Camera/);
    assert.doesNotMatch(user, /PUBSPEC_METADATA|DART_SKELETONS|ios\/Runner/);
    if (mode !== 'code') {
      assert.match(user, /Scan a QR code/);
      assert.match(user, /android\.permission\.CAMERA/);
      assert.match(user, /APPLE_APP_STORE_GUIDELINES/);
      assert.match(user, /GOOGLE_PLAY_GUIDELINES/);
    } else assert.doesNotMatch(user, /APPLE_APP_STORE_GUIDELINES|GOOGLE_PLAY_GUIDELINES/);
  }
});

test('real MCP protocol advertises and runs both tools for Expo and bare React Native', async (t) => {
  const bare = await fixture(t, rn);
  const expo = await fixture(t, { ...rn,
    'package.json': { name: 'managed-app', dependencies: { expo: '^54.0.0', 'react-native': '0.81.0' } },
    'app.json': `{ // JSON5 static Expo configuration
      expo: { name: 'Managed', ios: { infoPlist: { NSCameraUsageDescription: 'Take profile photos' } }, android: { permissions: ['CAMERA',] }, },
    }`,
    'app/(tabs)/index.tsx': 'export default function Home() { return <Text>Home</Text>; }',
  });
  const client = await mcp(t, bare);
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 2);
  for (const tool of listed.tools) {
    assert.match(tool.description, /React Native/);
    for (const projectDir of [bare, expo]) {
      const result = await client.callTool({ name: tool.name, arguments: { projectDir } });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      assert.equal(JSON.parse(result.content[0].text).score, 'PASS');
      const { system, user } = prompt((await requests(bare)).at(-1));
      assert.match(system, /React Native/);
      assert.match(user, /REACT_NATIVE_GUIDELINES/);
      assert.match(user, /RN-001/);
      assert.match(user, /JS_TS_SOURCE/);
      if (projectDir === expo) {
        assert.match(user, /EXPO_CONFIG/);
        assert.match(user, /Take profile photos/);
        assert.match(user, /app\/\(tabs\)\/index\.tsx/);
      }
    }
  }
});

test('Flutter CLI and both MCP workflows retain Dart and pubspec evidence', async (t) => {
  const dir = await fixture(t, flutter);
  const result = await cli(dir, ['--mode', 'both']);
  assert.equal(result.code, 0, result.stderr);
  const client = await mcp(t, dir);
  for (const name of ['shipli_code_review', 'shipli_store_audit']) {
    const response = await client.callTool({ name, arguments: { projectDir: dir } });
    assert.notEqual(response.isError, true, JSON.stringify(response));
  }
  assert.equal((await requests(dir)).length, 3);
  for (const request of await requests(dir)) {
    const { system, user } = prompt(request);
    assert.match(system, /Flutter/);
    assert.match(user, /PUBSPEC_METADATA/);
    assert.match(user, /DART_SKELETONS/);
    assert.match(user, /lib\/main\.dart/);
    assert.doesNotMatch(user, /REACT_NATIVE_GUIDELINES|PACKAGE_JSON_METADATA/);
  }
});

test('unsupported and malformed projects fail before any model request', async (t) => {
  for (const files of [{ 'package.json': { dependencies: { react: '^19.0.0' } } }, { 'package.json': '{bad' }]) {
    const dir = await fixture(t, files);
    const result = await cli(dir);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /React Native|package\.json/);
    assert.equal((await requests(dir)).length, 0);
    const client = await mcp(t, dir);
    const response = await client.callTool({ name: 'shipli_code_review', arguments: { projectDir: dir } });
    assert.equal(response.isError, true);
    assert.equal((await requests(dir)).length, 0);
  }
});

test('provider failure and FAIL scores propagate through CLI and MCP', async (t) => {
  const dir = await fixture(t, rn);
  const failure = await cli(dir, ['--mode', 'code'], { SHIPLI_TEST_API_ERROR: '1' });
  assert.equal(failure.code, 1);
  assert.match(failure.stderr, /503/);
  const score = await cli(dir, ['--mode', 'code'], { SHIPLI_TEST_SCORE: 'FAIL' });
  assert.equal(score.code, 1);
  const client = await mcp(t, dir, { SHIPLI_TEST_API_ERROR: '1' });
  const response = await client.callTool({ name: 'shipli_code_review', arguments: { projectDir: dir } });
  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /503/);
});

test('platform selection limits store policy evidence in CLI and MCP', async (t) => {
  const dir = await fixture(t, { ...rn, 'app.config.json': "{ /* JSON5 */ expo: { platforms: ['ios',], }, }", 'package.json': { ...rn['package.json'], dependencies: { ...rn['package.json'].dependencies, expo: '^54' } } });
  const cliResult = await cli(dir, ['--mode', 'store']);
  assert.equal(cliResult.code, 0, cliResult.stderr);
  let evidence = prompt((await requests(dir)).at(-1)).user;
  assert.match(evidence, /=== APPLE_APP_STORE_GUIDELINES ===/);
  assert.doesNotMatch(evidence, /=== GOOGLE_PLAY_GUIDELINES ===/);
  const client = await mcp(t, dir);
  const response = await client.callTool({ name: 'shipli_store_audit', arguments: { projectDir: dir, platform: 'android' } });
  assert.notEqual(response.isError, true, JSON.stringify(response));
  evidence = prompt((await requests(dir)).at(-1)).user;
  assert.match(evidence, /=== GOOGLE_PLAY_GUIDELINES ===/);
  assert.doesNotMatch(evidence, /=== APPLE_APP_STORE_GUIDELINES ===/);
});

test('RN packages get package guidance and Flutter plugins retain example scanning', async (t) => {
  const library = await fixture(t, { 'package.json': { name: 'native-library', peerDependencies: { 'react-native': '*' } }, 'src/index.ts': 'export { NativeModules } from "react-native";' });
  const result = await cli(library, ['--mode', 'both']);
  assert.equal(result.code, 0, result.stderr);
  const client = await mcp(t, library);
  for (const name of ['shipli_code_review', 'shipli_store_audit']) {
    const response = await client.callTool({ name, arguments: { projectDir: library } });
    assert.notEqual(response.isError, true, JSON.stringify(response));
  }
  for (const request of await requests(library)) {
    const { system, user } = prompt(request);
    assert.match(system, /reusable package\/native library/);
    assert.match(system, /peer dependency compatibility/);
    assert.doesNotMatch(user, /=== INFO_PLIST_PERMISSIONS ===|=== ANDROID_MANIFEST_PERMISSIONS ===/);
  }
  const plugin = await fixture(t, { ...flutter,
    'pubspec.yaml': `${flutter['pubspec.yaml']}flutter:\n  plugin:\n    platforms:\n      ios:\n        pluginClass: PluginExample\n`,
    'example/lib/main.dart': 'class ExampleApp extends StatelessWidget {}',
  });
  const pluginClient = await mcp(t, plugin);
  const response = await pluginClient.callTool({ name: 'shipli_code_review', arguments: { projectDir: plugin } });
  assert.notEqual(response.isError, true, JSON.stringify(response));
  const { system, user } = prompt((await requests(plugin)).at(-1));
  assert.match(system, /Flutter\/Dart package engineer/);
  assert.match(user, /PLUGIN_PLATFORMS/);
  assert.match(user, /example\/lib\/main\.dart/);
});

test('Claude CLI configuration and MCP environment choose the expected request model', async (t) => {
  const dir = await fixture(t, { ...rn, '.shipli': { provider: 'claude', model: 'project-model', key: 'shipli-test-dummy-key' } });
  const result = await cli(dir, ['--mode', 'code', '--model', 'flag-model']);
  assert.equal(result.code, 0, result.stderr);
  const request = (await requests(dir)).at(-1);
  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.body.model, 'flag-model');
  assert.match(request.body.system, /React Native/);
  const client = await mcp(t, dir, { SHIPLI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'shipli-test-dummy-key' });
  const response = await client.callTool({ name: 'shipli_code_review', arguments: { projectDir: dir } });
  assert.notEqual(response.isError, true, JSON.stringify(response));
  assert.equal((await requests(dir)).at(-1).body.model, 'claude-sonnet-4-6');
});

test('missing keys, nonexistent directories, invalid options and empty source do not call a model', async (t) => {
  const dir = await fixture(t, rn);
  const cases = [
    [[], { GEMINI_API_KEY: '' }, /No API key/],
    [['--platform', 'web'], {}, /--platform/],
    [['--mode', 'invalid'], {}, /--mode/],
    [['--type', 'invalid'], {}, /--type/],
    [['--provider', 'unknown'], {}, /Unknown provider/],
    [['--dir', join(dir, 'missing')], {}, /Directory not found/],
  ];
  for (const [args, extra, message] of cases) {
    const result = await cli(dir, args, extra);
    assert.equal(result.code, 1);
    assert.match(result.stderr, message);
  }
  const client = await mcp(t, dir, { GEMINI_API_KEY: '' });
  const response = await client.callTool({ name: 'shipli_store_audit', arguments: { projectDir: dir } });
  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /No API key/);
  assert.equal((await requests(dir)).length, 0);
  const empty = await fixture(t, { 'package.json': rn['package.json'] });
  const emptyResult = await cli(empty);
  assert.equal(emptyResult.code, 1);
  assert.match(emptyResult.stderr, /No JavaScript or TypeScript/);
  assert.equal((await requests(empty)).length, 0);
});
