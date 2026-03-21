import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

const MAX_LINES_PER_FILE = 300;
const MAX_TOTAL_LINES = 8000;

const STRUCTURAL_KEYWORDS = [
  'class ', 'extends ', 'implements ', 'mixin ', 'enum ', 'abstract ',
  'typedef ', 'sealed ', 'factory ', 'const ', 'final ', 'static ',
  'required ', 'late ', 'part ', 'part of ',
  'extension ', 'get ', 'set ', 'operator ', 'covariant ', 'external ',
  'library ',
];

const ANNOTATION_PATTERNS = [
  '@override', '@required', '@immutable', '@pragma', '@visibleForTesting',
  '@freezed', '@JsonSerializable', '@riverpod', '@injectable',
  '@protected', '@mustCallSuper', '@Deprecated', '@experimental',
  '@HiveType', '@HiveField',
  '@Route', '@RoutePage',
  '@GenerateMocks', '@singleton', '@lazySingleton', '@module',
];

const SIGNAL_PATTERNS = [
  // Widget build & state
  'Widget build', 'State<', 'StatefulWidget', 'StatelessWidget',
  'ChangeNotifier', 'notifyListeners', 'setState',
  // Navigation & routing
  'Navigator', 'GoRouter', 'AutoRouter',
  'MaterialPageRoute', 'CupertinoPageRoute', 'PageRouteBuilder',
  'GoRoute', 'RouteBase', 'onGenerateRoute', 'onUnknownRoute',
  'pushNamed', 'pushReplacementNamed',
  // State management
  'Provider', 'Bloc', 'Cubit', 'GetX', 'Riverpod', 'ConsumerWidget',
  // Networking
  'http.', 'dio.', 'Dio(', 'ApiClient',
  'baseUrl', 'BASE_URL', 'apiUrl', 'API_URL',
  'Authorization', 'Bearer ',
  // Storage
  'SharedPreferences', 'Hive', 'sqflite', 'drift',
  'SecureStorage', 'FlutterSecureStorage',
  // Firebase
  'FirebaseAuth', 'FirebaseMessaging', 'FirebaseAnalytics', 'Crashlytics',
  // Permissions & hardware
  'permission', 'Permission', 'camera', 'Camera',
  'location', 'Location', 'Geolocator',
  'image_picker', 'ImagePicker', 'PhotoView',
  'Clipboard',
  // URLs & deep links
  'url_launcher', 'launchUrl', 'canLaunchUrl',
  // WebView
  'webview', 'WebView', 'InAppWebView',
  // Purchases
  'in_app_purchase', 'StoreKit', 'InAppPurchase',
  // Platform
  'Platform.is', 'kIsWeb',
  'MethodChannel', 'EventChannel', 'BasicMessageChannel',
  'PlatformException',
  // Notifications
  'NotificationService', 'LocalNotification', 'FlutterLocalNotifications',
  // Auth & biometrics
  'BiometricAuth', 'LocalAuthentication',
  // UI structure
  'Scaffold', 'AppBar', 'BottomNavigationBar', 'TabBar', 'Drawer',
  'MaterialApp', 'CupertinoApp',
  'showDialog', 'showModalBottomSheet', 'AlertDialog',
  'TextEditingController', 'FormField', 'Form(',
  'ListView', 'GridView', 'CustomScrollView',
  // Lifecycle
  'initState', 'dispose', 'didChangeDependencies', 'didUpdateWidget',
  'WidgetsBindingObserver', 'didChangeAppLifecycleState',
  // Error handling
  'try {', 'catch (', 'on Exception', 'on Error',
  'FlutterError', 'ErrorWidget', 'runZonedGuarded',
  // Crypto & security
  'encrypt', 'decrypt',
  // Tracking & analytics
  'Analytics', 'Tracker', 'Sentry',
  'AppTrackingTransparency',
  // Background & isolates
  'Isolate', 'compute(',
  'BackgroundFetch', 'WorkManager',
  // Code push (forbidden by Apple)
  'CodePush', 'shorebird',
  // FFI
  'DynamicLibrary',
  // Health
  'HealthKit', 'health',
  // Misc
  'openUrl', 'open(',
];

// Patterns that should match against the RAW line (including string contents)
// because URLs inside strings are the actual security signal
const RAW_LINE_PATTERNS = ['http://', 'https://'];

function stripStringLiterals(line) {
  return line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

const SIG_PATTERN = /^\s*(?:[\w<>?,\[\]\s]+)\s+\w+\s*\(/;

function isSignificantLine(line) {
  const stripped = stripStringLiterals(line);

  for (const kw of STRUCTURAL_KEYWORDS) {
    if (stripped.includes(kw)) return true;
  }
  for (const ann of ANNOTATION_PATTERNS) {
    if (stripped.includes(ann)) return true;
  }
  for (const sig of SIGNAL_PATTERNS) {
    if (stripped.includes(sig)) return true;
  }
  // URL patterns checked against raw line — URLs in strings ARE the signal
  for (const pat of RAW_LINE_PATTERNS) {
    if (line.includes(pat)) return true;
  }

  // Method/function signatures
  if (SIG_PATTERN.test(stripped)) {
    // Single-line complete signature (handles async, async*, sync* variants)
    if (/[\{=]/.test(stripped.slice(-5)) || stripped.endsWith(';')) return true;
    // Multi-line signature start (line ends with open paren or has trailing comma)
    if (stripped.endsWith('(') || stripped.endsWith(',')) return true;
  }

  // Closing braces at class level
  if (/^}\s*$/.test(line)) return true;

  return false;
}

function extractSkeleton(lines) {
  const result = [];
  let inBlockComment = false;
  let inMultiLineSig = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true;
      continue;
    }
    if (!line) continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('import ')) continue;
    if (line.startsWith('export ')) continue;

    // If accumulating a multi-line signature, keep lines until it closes
    if (inMultiLineSig) {
      result.push(raw.replace(/\s+$/, ''));
      if (line.includes(') {') || line.includes(') async {') || line.includes(') async* {')
          || line.includes(') sync* {') || line.endsWith(');') || line.includes(') =>')) {
        inMultiLineSig = false;
      }
      continue;
    }

    if (isSignificantLine(line)) {
      result.push(raw.replace(/\s+$/, ''));
      // Detect start of multi-line signature (ends with open paren)
      if (SIG_PATTERN.test(stripStringLiterals(line)) && line.trimEnd().endsWith('(')) {
        inMultiLineSig = true;
      }
    }
  }

  return result;
}

export async function scan(projectDir) {
  const entries = await fg.glob('lib/**/*.dart', {
    cwd: projectDir,
    absolute: true,
    ignore: ['**/generated/**', '**/*.g.dart', '**/*.freezed.dart'],
  });

  if (entries.length === 0) {
    throw new Error('No .dart files found in lib/ directory');
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

  // Proportional truncation if total exceeds limit
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

  return {
    files,
    stats: { totalFiles: entries.length, totalLines, skeletonLines },
  };
}
