// Lists HUD source files that nothing imports (tests and main.tsx excepted). Run: npm run audit:unused
// Unused imports/variables are caught by `npm run lint` (noUnusedLocals / noUnusedParameters).
// 2026-11-06: imports are resolved to real paths (relative specifiers, extension and /index lookup), so two files
// with the same name no longer hide each other.
import fs from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|css)$/.test(name)) files.push(path.resolve(full));
  }
})('src');
const fileSet = new Set(files);
const resolve = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec);
  for (const candidate of [base, ...['.ts', '.tsx', '.css'].map((ext) => base + ext), ...['index.ts', 'index.tsx'].map((idx) => path.join(base, idx))]) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
};
const used = new Set();
const specifier = /(?:from\s+|import\s*\(\s*|import\s+|@import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(specifier)) {
    const target = resolve(file, match[1]);
    if (target && target !== file) used.add(target);
  }
}
// index.html / vite config entry points
for (const entry of ['src/main.tsx', 'src/index.css']) used.add(path.resolve(entry));
const unused = files.filter((file) => !/\.test\.ts$/.test(file) && !used.has(file));
unused.forEach((file) => console.log('UNIMPORTED', path.relative(process.cwd(), file)));
console.log(`${unused.length} unimported file(s)`);
process.exit(unused.length ? 1 : 0);
