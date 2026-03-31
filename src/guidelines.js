import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STORES = {
  apple: {
    file: join(__dirname, 'rules', 'appstore-rules.md'),
    label: 'App Store',
  },
  google: {
    file: join(__dirname, 'rules', 'android-rules.md'),
    label: 'Play Store',
  },
  reactNative: {
    file: join(__dirname, 'rules', 'react-native-rules.md'),
    label: 'React Native',
  },
};

/**
 * Load guidelines from bundled .md files.
 * @param {'apple' | 'google'} store
 */
export async function fetchGuidelines(store = 'apple') {
  const config = STORES[store];
  if (!config) throw new Error(`Unknown store: ${store}`);

  try {
    const content = await readFile(config.file, 'utf-8');

    return {
      content,
      source: 'bundled',
      store,
    };
  } catch (err) {
    return {
      content: null,
      source: 'unavailable',
      store,
      warning: `Could not load ${config.label} guidelines (${err.message}). Audit will use the AI model's built-in knowledge.`,
    };
  }
}
