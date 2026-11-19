// Builds index.html (single self-contained file) from src/app.html + src/core.js.
// The version number comes from package.json.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/core.js'), 'utf8');
if (core.includes('</script')) throw new Error('core.js contains </script');
const out = html.replace('/*CORE*/', () => core).split('__VERSION__').join(pkg.version);
fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('index.html built (v' + pkg.version + ')');
