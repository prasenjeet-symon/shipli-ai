import { readFile, realpath } from 'node:fs/promises';
import { join, relative, isAbsolute, sep } from 'node:path';

/** Read RN metadata only when its canonical location remains inside the audited root. */
export async function readProjectFile(projectDir, relativePath) {
  const [root, file] = await Promise.all([realpath(projectDir), realpath(join(projectDir, relativePath))]);
  const within = relative(root, file);
  if (within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) {
    throw new Error(`${relativePath} resolves outside the project directory`);
  }
  return readFile(file, 'utf8');
}
