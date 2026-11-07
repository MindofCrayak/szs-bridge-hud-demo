import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(appRoot, 'src');
const forbiddenImport = /(?:from\s*|import\s*(?:\(\s*)?)['"][^'"]*(?:quarantine[\\/]+oracle-mmd|engines[\\/]+(?:master-control|mail-command-center))[^'"]*['"]/i;

const inspectDirectory = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Command HUD source must not link outside its package: ${entryPath}`);
    }
    if (entry.isDirectory()) {
      await inspectDirectory(entryPath);
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?)$/i.test(entry.name)) continue;
    const contents = await readFile(entryPath, 'utf8');
    if (forbiddenImport.test(contents)) {
      throw new Error(`Command HUD cannot import Oracle quarantine or Apps Script engine code: ${entryPath}`);
    }
  }
};

await inspectDirectory(sourceRoot);
