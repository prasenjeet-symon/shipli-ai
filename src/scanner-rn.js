import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

const MAX_LINES_PER_FILE = 300;
const MAX_TOTAL_LINES = 8000;

const SIGNAL_PATTERNS = [
  'React.', 'Component', 'PureComponent', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback',
  'NavigationContainer', 'createStackNavigator', 'createBottomTabNavigator', 'createNativeStackNavigator',
  'Navigator', 'Route', 'props.navigation', 'useNavigation', 'SafeAreaView', 'AppRegistry', 'registerComponent',
  'NativeModules', 'NativeEventEmitter', 'Platform.OS', 'PermissionsAndroid', 'Geolocation', 'fetch(', 'axios', 'axios.',
  'AsyncStorage', '@react-native-async-storage/async-storage', 'react-native-async-storage', 'realm', 'sentry', 'Sentry',
  'react-native-firebase', 'firebase', 'GoogleSignIn', 'authorize', 'in_app_purchase', 'IAP', 'RNIap',
  'WebView', 'react-native-webview', 'eval(', 'new Function', 'require(', 'import(', 'Image(', 'ImageBackground',
  'StyleSheet.create', 'Dimensions.', 'requestAnimationFrame', 'InteractionManager', 'setImmediate',
  'bridge', 'bridge.enqueue', 'postMessage', 'addEventListener', 'removeEventListener', 'dangerouslySetInnerHTML',
];

const RAW_LINE_PATTERNS = ['http://', 'https://'];

function stripStrings(line) {
  return line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

function isSignificant(line) {
  const stripped = stripStrings(line);
  for (const s of SIGNAL_PATTERNS) if (stripped.includes(s)) return true;
  for (const pat of RAW_LINE_PATTERNS) if (line.includes(pat)) return true;
  // function or arrow patterns
  if (/\bfunction\s+\w+\s*\(/.test(stripped)) return true;
  if (/\bconst\s+\w+\s*=\s*\(/.test(stripped)) return true;
  if (/=>\s*\{?/.test(stripped)) return true;
  if (/class\s+\w+\s+extends\s+/.test(stripped)) return true;
  return false;
}

function extractSkeleton(lines) {
  const result = [];
  let inBlock = false;
  for (const raw of lines) {
    let line = raw.trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (!line) continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('import ') || line.startsWith('export ')) continue;
    if (isSignificant(line)) result.push(raw.replace(/\s+$/, ''));
    if (result.length >= MAX_LINES_PER_FILE) break;
  }
  return result;
}

export async function scan(projectDir) {
  const patterns = ['**/*.{js,jsx,ts,tsx}'];
  const entries = await fg.glob(patterns, {
    cwd: projectDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/android/**', '**/ios/**', '**/build/**', '**/dist/**'],
  });

  if (entries.length === 0) {
    throw new Error('No JavaScript/TypeScript files found in project');
  }

  const files = [];
  let totalLines = 0;
  let skeletonLines = 0;

  for (const filePath of entries.sort()) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    totalLines += lines.length;

    let skeleton = extractSkeleton(lines);
    if (skeleton.length > MAX_LINES_PER_FILE) {
      const truncated = skeleton.length - MAX_LINES_PER_FILE;
      skeleton = skeleton.slice(0, MAX_LINES_PER_FILE);
      skeleton.push(`// ... truncated (${truncated} more lines)`);
    }

    skeletonLines += skeleton.length;
    const relativePath = path.relative(projectDir, filePath);
    files.push({ relativePath, skeleton: skeleton.join('\n') });
  }

  if (skeletonLines > MAX_TOTAL_LINES) {
    const ratio = MAX_TOTAL_LINES / skeletonLines;
    for (const file of files) {
      const lines = file.skeleton.split('\n');
      const allowed = Math.max(10, Math.floor(lines.length * ratio));
      if (lines.length > allowed) {
        const truncated = lines.length - allowed;
        file.skeleton = lines.slice(0, allowed).join('\n') + `\n// ... truncated (${truncated} more lines)`;
      }
    }
  }

  return { files, stats: { totalFiles: entries.length, totalLines, skeletonLines } };
}
