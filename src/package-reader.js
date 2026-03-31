import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Read React Native project configuration from package.json
 * @param {string} projectDir - Path to the React Native project root
 * @returns {Promise<Object>} Project metadata
 */
export async function read(projectDir) {
  const packagePath = path.join(projectDir, 'package.json');

  try {
    const content = await readFile(packagePath, 'utf-8');
    const pkg = JSON.parse(content);

    // Detect React Native
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const isReactNative = !!(
      deps['react-native'] ||
      deps['expo'] ||
      pkg.reactNative ||
      pkg.expo
    );

    if (!isReactNative) {
      throw new Error('Not a React Native project. No react-native or expo dependency found.');
    }

    const isExpo = !!deps['expo'];
    const hasTypeScript = !!(deps['typescript'] || deps['@types/react']);

    // Extract relevant dependencies
    const navigationDeps = Object.keys(deps).filter(d => 
      d.includes('navigation') || d.includes('router') || d.includes('route')
    );
    
    const stateMgmtDeps = Object.keys(deps).filter(d => 
      ['redux', 'mobx', 'zustand', 'recoil', 'jotai', 'effector', 'xstate'].some(s => d.includes(s)) ||
      ['react-query', 'tanstack-query', 'swr'].includes(d)
    );

    const uiDeps = Object.keys(deps).filter(d => 
      ['react-native-paper', 'native-base', 'ui-kitten', 'tamagui', 'gluestack', 'shoutem'].some(s => d.includes(s)) ||
      d.includes('react-native-ui') || d.includes('nativewind')
    );

    const authDeps = Object.keys(deps).filter(d => 
      d.includes('auth') || d.includes('firebase') || d.includes('cognito') || d.includes('clerk')
    );

    const paymentDeps = Object.keys(deps).filter(d => 
      d.includes('purchase') || d.includes('payment') || d.includes('stripe') || d.includes('revenuecat')
    );

    return {
      name: pkg.name || 'unknown',
      version: pkg.version || null,
      description: pkg.description || null,
      projectType: isExpo ? 'expo-app' : 'react-native-app',
      isExpo,
      hasTypeScript,
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      features: {
        navigation: navigationDeps,
        stateManagement: stateMgmtDeps,
        ui: uiDeps,
        auth: authDeps,
        payments: paymentDeps,
      },
      reactNativeVersion: deps['react-native'] || null,
      expoVersion: deps['expo'] || null,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('package.json not found. Is this a React Native project?');
    }
    throw err;
  }
}