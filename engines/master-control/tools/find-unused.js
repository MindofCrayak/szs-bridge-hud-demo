// Lists Master Control functions nothing calls (private _ helpers) and public entry points (editor/trigger/scripts.run). Run from engines/master-control: node tools/find-unused.js
const fs = require('fs');
const files = [...fs.readdirSync('.').filter((f) => /\.(gs|js)$/.test(f)), ...fs.readdirSync('src').filter((f) => /\.(gs|js)$/.test(f)).map((f) => 'src/' + f)];
const tests = fs.readdirSync('test').map((f) => fs.readFileSync('test/' + f, 'utf8')).join('\n');
const html = fs.readdirSync('.').filter((f) => f.endsWith('.html')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const all = Object.values(src).join('\n') + '\n' + html;
const defs = [];
for (const [f, t] of Object.entries(src)) for (const m of t.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)) defs.push([m[1], f]);
const count = (name, text) => (text.match(new RegExp('(^|[^A-Za-z0-9_$])' + name.replace(/\$/g, '\$') + '(?![A-Za-z0-9_$])', 'g')) || []).length;
const privateDead = [], publicList = [];
for (const [name, f] of defs) {
  const uses = count(name, all) - 1;
  if (name.endsWith('_')) { if (uses <= 0) privateDead.push(`${name} (${f})${count(name, tests) ? ' [tests only]' : ''}`); }
  else if (uses <= 0) publicList.push(`${name} (${f})`);
}
console.log('PRIVATE never called:', privateDead.length); privateDead.forEach((l) => console.log('  ' + l));
console.log('PUBLIC entry points not called from code (editor / trigger / scripts.run):', publicList.length); publicList.forEach((l) => console.log('  ' + l));
