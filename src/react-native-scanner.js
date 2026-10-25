import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';
import { join } from 'node:path';

const MAX_LINES_PER_FILE = 300;
const MAX_TOTAL_LINES = 8000;
const MAX_LINE_LENGTH = 2000;

/** Numbered source excerpts preserve hook bodies, JSX and imports for review. */
export async function scan(projectDir) {
  const entries = (await fg.glob('**/*.{js,jsx,ts,tsx}', {
    cwd: projectDir,
    followSymbolicLinks: false,
    ignore: [
      '**/node_modules/**', '**/Pods/**', '**/build/**', '**/dist/**',
      '**/coverage/**', '**/vendor/**', '**/generated/**', '**/__generated__/**',
      '**/*.generated.*', '**/*.gen.*', '**/*.d.ts', '**/*.min.js', '**/*.bundle.js',
    ],
  })).sort();
  if (!entries.length) throw new Error('No JavaScript or TypeScript source files found in the React Native project');

  const files = [];
  let totalLines = 0;
  let skeletonLines = 0;
  let truncatedFiles = 0;
  for (const relativePath of entries) {
    const content = await readFile(join(projectDir, relativePath), 'utf8');
    const lines = content.split('\n');
    totalLines += lines.length;
    const remaining = MAX_TOTAL_LINES - skeletonLines;
    if (remaining < 2) { truncatedFiles++; continue; }
    const limit = Math.min(MAX_LINES_PER_FILE, remaining);
    const truncated = lines.length > limit || lines.some(line => line.length > MAX_LINE_LENGTH);
    const selected = lines.slice(0, truncated ? limit - 1 : limit).map((line, index) =>
      `${index + 1}: ${line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) + ' /* line omitted after character limit */' : line}`);
    if (truncated) {
      selected.push('// ... source omitted by audit budget; inspect full file before asserting missing behavior');
      truncatedFiles++;
    }
    skeletonLines += selected.length;
    files.push({ relativePath, skeleton: selected.join('\n') });
  }
  return { files, stats: { totalFiles: entries.length, totalLines, skeletonLines, truncatedFiles } };
}
