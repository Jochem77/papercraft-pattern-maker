#!/usr/bin/env node
// Release helper for Papercraft Pattern Maker.
//
//   node tools/release.js patch|minor|major|beta|<x.y.z[-beta.n]> [--publish]
//       Moves the [Unreleased] notes in CHANGELOG.md to a new version section,
//       bumps package.json, builds index.html, commits and creates tag vX.Y.Z.
//       With --publish it also pushes and creates the GitHub release (needs `gh`).
//       beta:  1.0.0-beta.1 -> 1.0.0-beta.2 (after a final release: 1.0.0 -> 1.0.1-beta.1)
//       patch/minor/major after a beta finalise it: 1.0.0-beta.3 + patch -> 1.0.0
//
//   node tools/release.js notes [version]
//       Prints the release notes of a version (default: the current version).
//
//   node tools/release.js publish-existing
//       Pushes and creates the GitHub release for the current version and its existing tag.
const fs = require('fs'), path = require('path'), os = require('os');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8' });
const pkgPath = path.join(root, 'package.json'), clPath = path.join(root, 'CHANGELOG.md');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let changelog = fs.readFileSync(clPath, 'utf8').replace(/\r\n/g, '\n');
const repoUrl = 'https://github.com/Jochem77/papercraft-pattern-maker';
const die = msg => { console.error('✗ ' + msg); process.exit(1); };

// Text of the section "## [version] ..." up to the next section or the link list.
function notesFor(version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex(l => l.startsWith(`## [${version}]`));
  if (start < 0) die(`no section for ${version} in CHANGELOG.md`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## [') && !/^\[[^\]]+\]: /.test(lines[end])) end++;
  return lines.slice(start + 1, end).join('\n').trim();
}

function publish(version) {
  const tag = 'v' + version;
  const file = path.join(os.tmpdir(), `release-notes-${version}.md`);
  fs.writeFileSync(file, notesFor(version) + '\n');
  run('git push --follow-tags');
  const kind = version.includes('-') ? '--prerelease' : '--latest';
  run(`gh release create ${tag} --title "${tag}" --notes-file "${file}" --verify-tag ${kind}`);
  console.log(`✓ published ${tag}: ${repoUrl}/releases/tag/${tag}`);
}

function nextVersion(current, arg) {
  const [base, pre] = current.split('-');
  const [ma, mi, pa] = base.split('.').map(Number);
  if (arg === 'beta') return pre && /^beta\.\d+$/.test(pre) ? `${base}-beta.${Number(pre.split('.')[1]) + 1}` : `${ma}.${mi}.${pa + 1}-beta.1`;
  if (arg === 'patch') return pre ? base : `${ma}.${mi}.${pa + 1}`;
  if (arg === 'minor') return pre && pa === 0 ? base : `${ma}.${mi + 1}.0`;
  if (arg === 'major') return pre && mi === 0 && pa === 0 ? base : `${ma + 1}.0.0`;
  return arg;
}

const [arg, flag] = process.argv.slice(2);
if (!arg) die('usage: node tools/release.js patch|minor|major|beta|x.y.z [--publish] | notes [version] | publish-existing');
if (arg === 'notes') { console.log(notesFor(flag || pkg.version)); process.exit(0); }
if (arg === 'publish-existing') { publish(pkg.version); process.exit(0); }

if (run('git status --porcelain', { capture: true }).trim()) die('working tree not clean: commit or stash your changes first');
const next = nextVersion(pkg.version, arg);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(next)) die(`invalid version: ${next}`);

// [Unreleased] section -> new version section
const lines = changelog.split('\n');
const u = lines.findIndex(l => l.startsWith('## [Unreleased]'));
if (u < 0) die('CHANGELOG.md has no [Unreleased] section');
let e = u + 1;
while (e < lines.length && !lines[e].startsWith('## [') && !/^\[[^\]]+\]: /.test(lines[e])) e++;
const body = lines.slice(u + 1, e).join('\n').trim();
if (!body) die('the [Unreleased] section in CHANGELOG.md is empty: describe the changes first');
const today = new Date().toISOString().slice(0, 10);
lines.splice(u, e - u, '## [Unreleased]', '', `## [${next}] - ${today}`, '', body, '');
changelog = lines.join('\n')
  .replace(/^\[Unreleased\]: .*$/m, `[Unreleased]: ${repoUrl}/compare/v${next}...HEAD\n[${next}]: ${repoUrl}/compare/v${pkg.version}...v${next}`);
fs.writeFileSync(clPath, changelog);

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
run('node tools/build.js');
run('git add -A');
run(`git commit -m "Release v${next}"`);
run(`git tag -a v${next} -m "v${next}"`);
console.log(`✓ v${next} committed and tagged`);
if (flag === '--publish') publish(next);
else console.log('  publish with: node tools/release.js publish-existing');
