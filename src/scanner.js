import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

const MAX_LINES_PER_FILE = 300;
const MAX_TOTAL_LINES = 8000;

const FLUTTER_STRUCTURAL_KEYWORDS = [
  'class ', 'extends ', 'implements ', 'mixin ', 'enum ', 'abstract ',
  'typedef ', 'sealed ', 'factory ', 'const ', 'final ', 'static ',
  'required ', 'late ', 'part ', 'part of ',
  'extension ', 'get ', 'set ', 'operator ', 'covariant ', 'external ',
  'library ',
];

const FLUTTER_ANNOTATION_PATTERNS = [
  '@override', '@required', '@immutable', '@pragma', '@visibleForTesting',
  '@freezed', '@JsonSerializable', '@riverpod', '@injectable',
  '@protected', '@mustCallSuper', '@Deprecated', '@experimental',
  '@HiveType', '@HiveField',
  '@Route', '@RoutePage',
  '@GenerateMocks', '@singleton', '@lazySingleton', '@module',
];

const FLUTTER_SIGNAL_PATTERNS = [
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

const REACT_NATIVE_STRUCTURAL_KEYWORDS = [
  'function ', 'class ', 'const ', 'let ', 'export ', 'import ',
  'async function ', 'interface ', 'type ', 'enum ',
  'useState(', 'useEffect(', 'useMemo(', 'useCallback(', 'useRef(',
  'return (', 'createContext(', 'memo(', 'forwardRef(',
];

const REACT_NATIVE_SIGNAL_PATTERNS = [
  "from 'react-native'", 'from "react-native"',
  "from 'expo'", 'from "expo"',
  'NavigationContainer', 'createNativeStackNavigator', 'createBottomTabNavigator',
  'useNavigation', 'useRoute', 'Stack.Screen', 'Tab.Screen',
  'StyleSheet.create', 'SafeAreaView', 'KeyboardAvoidingView',
  'ScrollView', 'FlatList', 'SectionList', 'VirtualizedList',
  'Animated.', 'Reanimated', 'GestureHandlerRootView',
  'AsyncStorage', 'MMKV', 'SecureStore', 'Keychain',
  'fetch(', 'axios.', 'axios(', 'queryClient', 'useQuery(', 'useMutation(',
  'Linking.', 'DeepLink', 'UniversalLink', 'AppState',
  'PermissionsAndroid', 'react-native-permissions',
  'NativeModules', 'NativeEventEmitter', 'TurboModuleRegistry',
  'expo-notifications', 'PushNotification', 'messaging()',
  'react-hook-form', 'Formik', 'Yup', 'zod',
  'redux', 'zustand', 'mobx', 'jotai',
  'useColorScheme', 'Appearance.', 'Platform.OS',
  'TouchableOpacity', 'Pressable', 'Modal', 'Alert.alert',
  'WebView', 'expo-web-browser',
  'react-native-iap', 'RevenueCat', 'AdMob',
  'CodePush', 'expo-updates',
  'Clipboard', 'CameraRoll', 'ImagePicker', 'launchImageLibrary',
];

const RAW_LINE_PATTERNS = ['http://', 'https://'];
const DART_SIG_PATTERN = /^\s*(?:[\w<>?,\[\]\s]+)\s+\w+\s*\(/;

function stripStringLiterals(line) {
  return line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

function ecosystemConfig(ecosystem) {
  if (ecosystem === 'react-native') {
    return {
      patterns: [
        'App.{js,jsx,ts,tsx}',
        'index.{js,jsx,ts,tsx}',
        'src/**/*.{js,jsx,ts,tsx}',
        'app/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{js,jsx,ts,tsx}',
        'screens/**/*.{js,jsx,ts,tsx}',
        'navigation/**/*.{js,jsx,ts,tsx}',
        'hooks/**/*.{js,jsx,ts,tsx}',
        'services/**/*.{js,jsx,ts,tsx}',
        'store/**/*.{js,jsx,ts,tsx}',
        'context/**/*.{js,jsx,ts,tsx}',
        'utils/**/*.{js,jsx,ts,tsx}',
      ],
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.expo/**',
        '**/coverage/**',
      ],
      structuralKeywords: REACT_NATIVE_STRUCTURAL_KEYWORDS,
      annotationPatterns: [],
      signalPatterns: REACT_NATIVE_SIGNAL_PATTERNS,
      emptyError: 'No JavaScript/TypeScript files found in typical React Native app locations',
    };
  }

  return {
    patterns: ['lib/**/*.dart'],
    ignore: ['**/generated/**', '**/*.g.dart', '**/*.freezed.dart'],
    structuralKeywords: FLUTTER_STRUCTURAL_KEYWORDS,
    annotationPatterns: FLUTTER_ANNOTATION_PATTERNS,
    signalPatterns: FLUTTER_SIGNAL_PATTERNS,
    emptyError: 'No .dart files found in lib/ directory',
  };
}

function isSignificantLine(line, config, ecosystem) {
  const stripped = stripStringLiterals(line);

  for (const kw of config.structuralKeywords) {
    if (stripped.includes(kw)) return true;
  }
  for (const ann of config.annotationPatterns) {
    if (stripped.includes(ann)) return true;
  }
  for (const sig of config.signalPatterns) {
    if (line.includes(sig) || stripped.includes(sig)) return true;
  }
  for (const pat of RAW_LINE_PATTERNS) {
    if (line.includes(pat)) return true;
  }

  if (ecosystem === 'flutter') {
    if (DART_SIG_PATTERN.test(stripped)) {
      if (/[\{=]/.test(stripped.slice(-5)) || stripped.endsWith(';')) return true;
      if (stripped.endsWith('(') || stripped.endsWith(',')) return true;
    }

    if (/^}\s*$/.test(line)) return true;
  }

  return false;
}

function extractSkeleton(lines, config, ecosystem) {
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

    if (inMultiLineSig) {
      result.push(raw.replace(/\s+$/, ''));
      if (line.includes(') {') || line.includes(') async {') || line.includes(') async* {')
          || line.includes(') sync* {') || line.endsWith(');') || line.includes(') =>')) {
        inMultiLineSig = false;
      }
      continue;
    }

    if (isSignificantLine(line, config, ecosystem)) {
      result.push(raw.replace(/\s+$/, ''));
      if (ecosystem === 'flutter' && DART_SIG_PATTERN.test(stripStringLiterals(line)) && line.trimEnd().endsWith('(')) {
        inMultiLineSig = true;
      }
    }
  }

  return result;
}

export async function scan(projectDir, options = {}) {
  const ecosystem = options.ecosystem || 'flutter';
  const config = ecosystemConfig(ecosystem);

  const entries = await fg.glob(config.patterns, {
    cwd: projectDir,
    absolute: true,
    ignore: config.ignore,
  });

  if (entries.length === 0) {
    throw new Error(config.emptyError);
  }

  const files = [];
  let totalLines = 0;
  let skeletonLines = 0;

  for (const filePath of entries.sort()) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    totalLines += lines.length;

    let skeleton = extractSkeleton(lines, config, ecosystem);

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
