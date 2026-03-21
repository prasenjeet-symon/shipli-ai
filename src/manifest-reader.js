import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function read(projectDir) {
  const manifestPath = path.join(projectDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

  try {
    const xml = await readFile(manifestPath, 'utf-8');

    // Extract package name from <manifest package="...">
    const pkgMatch = xml.match(/<manifest[^>]+package\s*=\s*"([^"]+)"/);
    const packageName = pkgMatch ? pkgMatch[1] : null;

    // Extract all <uses-permission android:name="..."> entries
    const permissions = [];
    const permRegex = /<uses-permission\s+android:name\s*=\s*"([^"]+)"/g;
    let match;
    while ((match = permRegex.exec(xml)) !== null) {
      permissions.push(match[1]);
    }

    return {
      found: true,
      permissions,
      packageName,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { found: false, permissions: [], packageName: null };
    }
    throw err;
  }
}
