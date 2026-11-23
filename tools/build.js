// Builds index.html (single self-contained file) from the sources in src/:
//   app.html       the page (markup) with three placeholders
//   style.css      → /*STYLE*/
//   js/NN-*.js     → /*APP*/  (joined in file name order into one module script)
//   core.js        → /*CORE*/ (the unfolding engine, also used by the tests)
// The version number comes from package.json.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src');
const read = f => fs.readFileSync(path.join(src, f), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const parts = fs.readdirSync(path.join(src, 'js')).filter(f => /^\d+-.*\.js$/.test(f)).sort();
const app = parts.map(f => read('js/' + f)).join('');
const style = read('style.css'), core = read('core.js');
for (const [name, text] of [['app', app], ['core.js', core]]) if (text.includes('</script')) throw new Error(name + ' contains </script');
for (const ph of ['/*STYLE*/', '/*APP*/', '/*CORE*/']) if ((app + style + core).includes(ph)) throw new Error('a source contains the placeholder ' + ph);

const fill = (html, ph, text) => {
  if (!html.includes(ph + '\n')) throw new Error('app.html misses ' + ph);
  return html.replace(ph + '\n', () => text);
};
let out = read('app.html');
out = fill(out, '/*STYLE*/', style);
out = fill(out, '/*APP*/', app);
out = out.replace('/*CORE*/', () => core);
out = out.split('__VERSION__').join(pkg.version);
fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('index.html built (v' + pkg.version + ', ' + parts.length + ' app parts)');
