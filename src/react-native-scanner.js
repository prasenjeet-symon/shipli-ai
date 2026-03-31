import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

const MAX_LINES_PER_FILE = 300;
const MAX_TOTAL_LINES = 8000;

// TypeScript/JavaScript structural keywords
const STRUCTURAL_KEYWORDS = [
  'class ', 'extends ', 'implements ', 'interface ', 'type ', 'enum ',
  'abstract ', 'const ', 'let ', 'var ', 'function ', 'async ',
  'export ', 'import ', 'default ', 'public ', 'private ', 'protected ',
  'readonly ', 'static ', 'get ', 'set ', 'new ',
];

// React/React Native specific patterns
const REACT_PATTERNS = [
  // Component patterns
  'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo',
  'useRef', 'useLayoutEffect', 'useImperativeHandle',
  'React.FC', 'React.FunctionComponent', 'React.Component',
  'Component<', 'PureComponent', 'memo(',
  
  // React Native core
  'View', 'Text', 'Image', 'ScrollView', 'FlatList', 'SectionList',
  'TouchableOpacity', 'Pressable', 'TouchableHighlight',
  'SafeAreaView', 'KeyboardAvoidingView', 'Modal',
  'StyleSheet', 'Dimensions', 'PixelRatio',
  'Alert', 'Animated', 'LayoutAnimation',
  'Platform.OS', 'Platform.select',
  
  // Navigation
  'NavigationContainer', 'Stack.Navigator', 'Tab.Navigator',
  'useNavigation', 'useRoute', 'useFocusEffect',
  'createNativeStackNavigator', 'createBottomTabNavigator',
  
  // State management
  'Provider', 'useSelector', 'useDispatch', 'createSlice',
  'useStore', 'createStore', 'configureStore',
  'observer', 'makeAutoObservable', 'observable',
  'create', 'useStoreApi',
  
  // Networking
  'fetch(', 'axios.', 'useQuery', 'useMutation',
  'baseUrl', 'BASE_URL', 'apiUrl', 'API_URL',
  'Authorization', 'Bearer ', 'Content-Type',
  
  // Storage
  'AsyncStorage', 'SecureStore', 'mmkv', 'react-native-mmkv',
  'SQLite', 'WatermelonDB',
  
  // Permissions
  'requestPermission', 'checkPermission', 'PermissionsAndroid',
  'expo-permissions', 'requestCameraPermission', 'requestLocationPermission',
  
  // Camera & Media
  'Camera', 'useCameraDevice', 'takePhoto',
  'ImagePicker', 'launchCamera', 'launchImageLibrary',
  'Video', 'Audio', 'recorder',
  
  // Location
  'Geolocation', 'getCurrentPosition', 'watchPosition',
  'Location', 'requestForegroundPermissionsAsync',
  
  // Auth
  'signIn', 'signUp', 'signInWithGoogle', 'signInWithApple',
  'FirebaseAuth', 'signInWithEmailAndPassword', 'createUserWithEmailAndPassword',
  'GoogleSignin', 'AppleAuthentication',
  
  // Payments
  'useIAP', 'getProducts', 'requestPurchase', 'getSubscriptions',
  'StripeProvider', 'useStripe', 'initPaymentSheet',
  
  // Notifications
  'Notifications', 'PushNotification', 'expo-notifications',
  'registerForPushNotificationsAsync', 'scheduleNotificationAsync',
  
  // Firebase
  'firebase', 'FirebaseApp', 'FirebaseAuth', 'Firestore',
  'analytics', 'crashlytics', 'messaging',
  
  // Code push (FORBIDDEN!)
  'CodePush', 'codePush', 'checkForUpdate', 'sync',
  'expo-updates', 'Updates.checkForUpdateAsync',
  
  // WebView
  'WebView', 'source={{', 'injectedJavaScript',
  
  // Gestures
  'PanGestureHandler', 'TapGestureHandler', 'Swipeable',
  'GestureDetector', 'gestureHandlerRootHOC',
  
  // Styling
  'StyleSheet.create', 'styled(', 'css`', 'tw`',
  
  // Hooks patterns
  'useAuth', 'useTheme', 'useTranslation', 'useLocale',
  
  // Lifecycle
  'useEffect(() =>', 'useLayoutEffect', 'componentDidMount', 'componentWillUnmount',
  
  // Error handling
  'try {', 'catch (', 'ErrorBoundary', 'onError',
  
  // Security concerns
  'http://', 'https://', 'eval(', 'Function(',
  'innerHTML', 'dangerouslySetInnerHTML',
];

// Annotations/decorators
const ANNOTATION_PATTERNS = [
  '@Component', '@Injectable', '@Pipe', '@Directive', '@NgModule',
  '@observable', '@action', '@computed', '@observer',
  '@deprecated', '@experimental', '@internal',
];

function stripStringLiterals(line) {
  return line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const SIG_PATTERN = /^\s*(?:async\s+)?(?:function\s+)?(?:[\w<>?,\[\]\s]+)\s*\w+\s*[<(]/;

function isSignificantLine(line) {
  const stripped = stripStringLiterals(line);

  for (const kw of STRUCTURAL_KEYWORDS) {
    if (stripped.includes(kw)) return true;
  }
  for (const pat of REACT_PATTERNS) {
    if (line.includes(pat)) return true;
  }
  for (const ann of ANNOTATION_PATTERNS) {
    if (stripped.includes(ann)) return true;
  }

  // Function/component signatures
  if (SIG_PATTERN.test(stripped)) {
    return true;
  }

  // JSX component patterns
  if (/^function\s+\w+\s*\(/.test(stripped)) return true;
  if (/const\s+\w+\s*=\s*\(/.test(stripped)) return true;
  if (/const\s+\w+\s*:\s*React\.FC/.test(stripped)) return true;

  // Closing braces
  if (/^}\s*$/.test(line)) return true;

  // JSX return statements
  if (/return\s*\(/.test(stripped)) return true;
  if (/return\s*</.test(line)) return true;

  return false;
}

function extractSkeleton(lines) {
  const result = [];
  let inBlockComment = false;

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
    if (line.startsWith('import ') && !line.includes('react-native')) continue;
    if (line.startsWith('export type ') && !line.includes('Props')) continue;

    if (isSignificantLine(line)) {
      result.push(raw.replace(/\s+$/, ''));
    }
  }

  return result;
}

export async function scan(projectDir) {
  // Scan for React Native source files
  const patterns = [
    'src/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'screens/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'utils/**/*.{js,jsx,ts,tsx}',
    'services/**/*.{js,jsx,ts,tsx}',
    'context/**/*.{js,jsx,ts,tsx}',
    'store/**/*.{js,jsx,ts,tsx}',
    '*.{js,jsx,ts,tsx}', // Root level files like App.tsx
  ];

  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.expo/**',
    '**/coverage/**',
    '**/*.test.{js,jsx,ts,tsx}',
    '**/*.spec.{js,jsx,ts,tsx}',
    '**/__tests__/**',
    '**/__mocks__/**',
  ];

  const entries = await fg.glob(patterns, {
    cwd: projectDir,
    absolute: true,
    ignore,
  });

  if (entries.length === 0) {
    throw new Error('No React Native source files found (.{js,jsx,ts,tsx})');
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