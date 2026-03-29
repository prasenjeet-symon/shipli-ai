import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

const MAX_LINES_PER_FILE = 300;
const MAX_TOTAL_LINES = 8000;

// ── Dart Scanner (Flutter) ──────────────────────────────────────────────────────

const DART_STRUCTURAL_KEYWORDS = [
  'class ', 'extends ', 'implements ', 'mixin ', 'enum ', 'abstract ',
  'typedef ', 'sealed ', 'factory ', 'const ', 'final ', 'static ',
  'required ', 'late ', 'part ', 'part of ',
  'extension ', 'get ', 'set ', 'operator ', 'covariant ', 'external ',
  'library ',
];

const DART_ANNOTATION_PATTERNS = [
  '@override', '@required', '@immutable', '@pragma', '@visibleForTesting',
  '@freezed', '@JsonSerializable', '@riverpod', '@injectable',
  '@protected', '@mustCallSuper', '@Deprecated', '@experimental',
  '@HiveType', '@HiveField',
  '@Route', '@RoutePage',
  '@GenerateMocks', '@singleton', '@lazySingleton', '@module',
];

const DART_SIGNAL_PATTERNS = [
  'Widget build', 'State<', 'StatefulWidget', 'StatelessWidget',
  'ChangeNotifier', 'notifyListeners', 'setState',
  'Navigator', 'GoRouter', 'AutoRouter',
  'MaterialPageRoute', 'CupertinoPageRoute', 'PageRouteBuilder',
  'GoRoute', 'RouteBase', 'onGenerateRoute', 'onUnknownRoute',
  'pushNamed', 'pushReplacementNamed',
  'Provider', 'Bloc', 'Cubit', 'GetX', 'Riverpod', 'ConsumerWidget',
  'http.', 'dio.', 'Dio(', 'ApiClient',
  'baseUrl', 'BASE_URL', 'apiUrl', 'API_URL',
  'Authorization', 'Bearer ',
  'SharedPreferences', 'Hive', 'sqflite', 'drift',
  'SecureStorage', 'FlutterSecureStorage',
  'FirebaseAuth', 'FirebaseMessaging', 'FirebaseAnalytics', 'Crashlytics',
  'permission', 'Permission', 'camera', 'Camera',
  'location', 'Location', 'Geolocator',
  'image_picker', 'ImagePicker', 'PhotoView',
  'Clipboard',
  'url_launcher', 'launchUrl', 'canLaunchUrl',
  'webview', 'WebView', 'InAppWebView',
  'in_app_purchase', 'StoreKit', 'InAppPurchase',
  'Platform.is', 'kIsWeb',
  'MethodChannel', 'EventChannel', 'BasicMessageChannel',
  'PlatformException',
  'NotificationService', 'LocalNotification', 'FlutterLocalNotifications',
  'BiometricAuth', 'LocalAuthentication',
  'Scaffold', 'AppBar', 'BottomNavigationBar', 'TabBar', 'Drawer',
  'MaterialApp', 'CupertinoApp',
  'showDialog', 'showModalBottomSheet', 'AlertDialog',
  'TextEditingController', 'FormField', 'Form(',
  'ListView', 'GridView', 'CustomScrollView',
  'initState', 'dispose', 'didChangeDependencies', 'didUpdateWidget',
  'WidgetsBindingObserver', 'didChangeAppLifecycleState',
  'try {', 'catch (', 'on Exception', 'on Error',
  'FlutterError', 'ErrorWidget', 'runZonedGuarded',
  'encrypt', 'decrypt',
  'Analytics', 'Tracker', 'Sentry',
  'AppTrackingTransparency',
  'Isolate', 'compute(',
  'BackgroundFetch', 'WorkManager',
  'CodePush', 'shorebird',
  'DynamicLibrary',
  'HealthKit', 'health',
  'google_mobile_ads', 'GoogleMobileAds',
  'play_billing', 'BillingClient',
  'targetSdkVersion', 'minSdkVersion',
  'AndroidManifest',
  'FlutterActivity', 'FlutterFragmentActivity',
  'google_sign_in', 'GoogleSignIn',
  'firebase_core', 'FirebaseCore',
  'openUrl', 'open(',
];

// ── JS/TS/TSX Scanner (React Native) ─────────────────────────────────────────

const JS_STRUCTURAL_KEYWORDS = [
  'class ', 'extends ', 'implements ', 'function ', 'const ', 'let ', 'var ',
  'async ', 'await ', 'return ', 'export ', 'import ', 'from ',
  'interface ', 'type ', 'enum ', 'namespace ', 'declare ',
  'get ', 'set ', 'static ', 'readonly ', 'private ', 'public ', 'protected ',
];

const JS_SIGNAL_PATTERNS = [
  // React core
  'React.', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
  'useContext', 'createContext', 'useReducer', 'useLayoutEffect',
  'Component', 'PureComponent', 'React.Component',
  'render(', 'return (', 'React.createElement',
  // React Native core
  'View', 'Text', 'TextInput', 'ScrollView', 'FlatList', 'SectionList',
  'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback',
  'Image', 'SafeAreaView', 'StyleSheet', 'Platform.OS',
  'NativeModules', 'NativeEventEmitter', 'NativeApp',
  'Alert.alert', 'Alert.prompt',
  'Linking.openURL', 'Linking.sendIntent',
  // Navigation
  'createStackNavigator', 'createBottomTabNavigator', 'createDrawerNavigator',
  '@react-navigation', 'react-navigation',
  'useNavigation', 'useRoute', 'navigation.navigate',
  // State management
  'useSelector', 'useDispatch', 'useStore',
  'createSlice', 'createAsyncThunk',
  'mobx', 'observer', 'makeAutoObservable',
  // Networking
  'fetch(', 'axios.', 'XMLHttpRequest',
  'baseURL', 'Authorization', 'Bearer ',
  // Storage
  'AsyncStorage', 'SecureStore', '@react-native-async-storage',
  'localStorage', 'sessionStorage',
  // Permissions & sensors
  'PermissionsAndroid', 'Platform.PermissionsAndroid',
  'CameraRoll', '@react-native-camera-roll',
  'ImagePicker', 'launchCamera', 'launchImageLibrary',
  'Geolocation', '@react-native-community/geolocation',
  'PushNotification', 'notifee',
  // Biometrics / security
  'LocalAuthentication', 'TouchID', 'FaceID', 'BiometryType',
  'Keychain', '@react-native-keychain',
  // Firebase / analytics
  'firebase.', '@firebase',
  'analytics.', 'trackEvent',
  'amplitude', 'mixpanel',
  // Payments
  'Stripe', '@stripe/stripe-react-native', 'PaymentsDK',
  'InAppPurchases', 'requestPurchase', 'getProducts',
  // Deep linking
  'DeepLink', 'Linking.', 'getInitialURL',
  'schema://', 'app://', '://',
  // WebView
  'WebView', 'injectJavaScript', 'onMessage',
  // Background / workers
  'BackgroundTask', 'WorkManager', 'setInterval', 'setTimeout',
  // Crypto / security
  'crypto.', 'getRandomValues', 'SubtleCrypto',
  // Hermes / performance
  'HermesInternal', 'enableHermes',
  'JSI', 'makeNativeCallable',
  // Error / crash
  'ErrorBoundary', 'componentDidCatch',
  'Sentry', 'captureException', 'Crashlytics',
  // Clipboard
  'Clipboard', '@react-native-clipboard/clipboard',
  // SMS / Contacts
  'Contacts', 'sendSMS', 'checkContactsPermission',
];

// Patterns that should match against the RAW line (including string contents)
const RAW_LINE_PATTERNS = ['http://', 'https://', 'ws://', 'wss://'];

function stripStringLiterals(line) {
  return line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

function isSignificantDartLine(line) {
  const stripped = stripStringLiterals(line);
  for (const kw of DART_STRUCTURAL_KEYWORDS) {
    if (stripped.includes(kw)) return true;
  }
  for (const ann of DART_ANNOTATION_PATTERNS) {
    if (stripped.includes(ann)) return true;
  }
  for (const sig of DART_SIGNAL_PATTERNS) {
    if (stripped.includes(sig)) return true;
  }
  return false;
}

function isSignificantJSLine(line) {
  const stripped = stripStringLiterals(line);
  for (const kw of JS_STRUCTURAL_KEYWORDS) {
    if (stripped.includes(kw)) return true;
  }
  for (const sig of JS_SIGNAL_PATTERNS) {
    if (stripped.includes(sig)) return true;
  }
  // URL patterns checked against raw line
  for (const pat of RAW_LINE_PATTERNS) {
    if (line.includes(pat)) return true;
  }
  return false;
}

const SIG_PATTERN_DART = /^\s*(?:[\w<>?,\[\]\s]+)\s+\w+\s*\(/;
const SIG_PATTERN_JS = /^\s*(?:export\s+)?(?:async\s+)?(?:default\s+)?(?:const|function|class)\s+\w+/;

function extractSkeleton(lines, isReactNative) {
  const result = [];
  let inBlockComment = false;
  let inMultiLineSig = false;
  let parenDepth = 0;
  let braceDepth = 0;

  const isSignificantLine = isReactNative ? isSignificantJSLine : isSignificantDartLine;

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
    if (line.startsWith('import ') && !line.includes("'")) continue;
    if (line.startsWith('export ') && !line.includes("'")) continue;

    // If accumulating a multi-line signature, keep lines until it closes
    if (inMultiLineSig) {
      result.push(raw.replace(/\s+$/, ''));
      for (const ch of line) {
        if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth--;
        else if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
      if (parenDepth === 0 && braceDepth === 0) {
        inMultiLineSig = false;
      }
      continue;
    }

    if (isSignificantLine(line)) {
      result.push(raw.replace(/\s+$/, ''));
      const stripped = stripStringLiterals(line);
      // Detect multi-line function/component definition
      const sigPattern = isReactNative ? SIG_PATTERN_JS : SIG_PATTERN_DART;
      if (sigPattern.test(stripped) || stripped.endsWith('=>')) {
        // Count parens and braces
        parenDepth = (stripped.match(/\(/g) || []).length - (stripped.match(/\)/g) || []).length;
        braceDepth = (stripped.match(/\{/g) || []).length - (stripped.match(/\}/g) || []).length;
        if (parenDepth > 0 || braceDepth > 0 || stripped.endsWith('=>') || stripped.endsWith('= (')) {
          inMultiLineSig = true;
        }
      }
    }
  }

  return result;
}

function processFiles(entries, projectDir) {
  const files = [];
  let totalLines = 0;
  let skeletonLines = 0;

  for (const filePath of entries.sort()) {
    const content = readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    totalLines += lines.length;

    let skeleton = extractSkeleton(lines, false);

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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Scan Dart/Flutter files.
 */
export async function scan(projectDir) {
  const entries = await fg.glob('lib/**/*.dart', {
    cwd: projectDir,
    absolute: true,
    ignore: ['**/generated/**', '**/*.g.dart', '**/*.freezed.dart'],
  });

  if (entries.length === 0) {
    throw new Error('No .dart files found in lib/ directory');
  }

  return processFiles(entries, projectDir);
}

/**
 * Scan JS/TS/TSX/JSX files for React Native projects.
 */
export async function scanReactNative(projectDir) {
  const patterns = [
    '**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/android/**',
    '!**/ios/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/.expo/**',
    '!**/vendor/**',
  ];

  const entries = await fg.glob(patterns, {
    cwd: projectDir,
    absolute: true,
  });

  if (entries.length === 0) {
    throw new Error('No .js/.ts files found — is this a React Native project?');
  }

  const files = [];
  let totalLines = 0;
  let skeletonLines = 0;

  for (const filePath of entries.sort()) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    totalLines += lines.length;

    let skeleton = extractSkeleton(lines, true);

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

  return {
    files,
    stats: { totalFiles: entries.length, totalLines, skeletonLines },
  };
}
