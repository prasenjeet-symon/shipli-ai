import { readFile } from 'node:fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Read package.json for React Native projects.
 * Detects React Native and extracts key metadata.
 */
export async function read(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');

  try {
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    const dependencies = pkg.dependencies || {};
    const devDependencies = pkg.devDependencies || {};
    const allDeps = { ...dependencies, ...devDependencies };

    // Detect if this is a React Native project
    const isReactNative = !!(
      dependencies['react-native'] ||
      dependencies['@react-native'] ||
      allDeps['expo']
    );

    // Detect if this is an Expo project
    const isExpo = !!(
      dependencies['expo'] ||
      dependencies['expo-splash-screen'] ||
      devDependencies['expo']
    );

    // Detect platform flags
    const isIOS = !!(dependencies['@react-native/ios'] || dependencies['react-native-ios']);
    const isAndroid = !!(
      dependencies['react-native/android'] ||
      // Most RN projects target Android by default
      (isReactNative && !isExpo)
    );

    // Extract native modules (dependencies that look like native modules)
    const nativeModules = Object.keys(allDeps).filter(dep =>
      dep.startsWith('react-native-') ||
      dep.startsWith('@react-native-') ||
      dep.startsWith('@react-native/')
    );

    // Common sensitive/permission-related packages
    const privacyRelated = {
      'react-native-camera': 'camera',
      'react-native-image-picker': 'camera/gallery',
      '@react-native-camera-roll/camera-roll': 'camera/gallery',
      'react-native-location': 'location',
      '@react-native-community/geolocation': 'location',
      'react-native-push-notification': 'notifications',
      '@react-native-community/push-notification-ios': 'notifications',
      'react-native-share': 'sharing',
      'react-native-fs': 'file-system',
      'react-native-bluetooth-state': 'bluetooth',
      'react-native-contacts': 'contacts',
      'react-native-sms': 'sms',
      'react-native-call-log': 'call-log',
      'react-native-mic': 'microphone',
      '@react-native-community/audio-api': 'microphone',
      'react-native-biometrics': 'biometrics',
      'react-native-touch-id': 'biometrics',
      'expo-local-authentication': 'biometrics',
      'expo-camera': 'camera',
      'expo-location': 'location',
      'expo-notifications': 'notifications',
    };

    const detectedPermissions = [];
    for (const [pkgName, permission] of Object.entries(privacyRelated)) {
      if (allDeps[pkgName]) {
        detectedPermissions.push(permission);
      }
    }

    return {
      name: pkg.name || 'unknown',
      version: pkg.version || null,
      description: pkg.description || null,
      isReactNative,
      isExpo,
      platforms: {
        ios: isIOS || isReactNative,
        android: isAndroid,
      },
      dependencies: Object.keys(dependencies),
      devDependencies: Object.keys(devDependencies),
      nativeModules,
      detectedPermissions,
      main: pkg.main || null,
      appEntry: pkg.main || pkg['react-native']?.appEntry || null,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('package.json not found. Is this a React Native project?');
    }
    throw err;
  }
}
