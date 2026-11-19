// Headless browsertest via Chrome DevTools Protocol. Gebruik: node tools/browsertest.js <model> [screenshot.png]
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const model = process.argv[2] || 'snake.glb', shot = process.argv[3] || path.join(require('os').tmpdir(), 'pc_shot.png');
const DBG = 9300 + Math.floor(Math.random() * 600);
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const port = srv.address().port;
  const prof = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pcprof'));
  const ch = spawn(process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p)), ['--headless=new', '--remote-debugging-port=' + DBG + '', '--user-data-dir=' + prof, '--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank']);
  let ws; for (let i = 0; i < 50; i++) { try { const l = await (await fetch('http://127.0.0.1:' + DBG + '/json')).json(); const pg = l.find(x => x.type === 'page'); if (pg) { ws = pg.webSocketDebuggerUrl; break; } } catch (e) {} await new Promise(r => setTimeout(r, 200)); }
  const sock = new WebSocket(ws); let id = 0; const pend = new Map(); const logs = [];
  sock.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 600)); if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'log'].includes(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 400)); };
  await new Promise(r => sock.onopen = r);
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.exceptionDetails ? 'ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 500) : r.result.result.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  if (process.env.PCFILE) {
    await send('DOM.enable');
    await send('Page.navigate', { url: 'file:///' + path.join(root, 'index.html').split(path.sep).join('/') });
    await new Promise(r => setTimeout(r, 4000));
    const doc = await send('DOM.getDocument');
    const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#fModel' });
    await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [path.join(root, model)] });
  } else await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?model=${encodeURIComponent(model)}` });
  let ok = false; for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 500)); if (i % 10 === 0) console.log(i / 2 + "s", await ev("document.getElementById(\"busyText\").textContent + \" worker:\" + !!(window.__S && __S.worker)")); const v = await ev('!!(window.__S && __S.cp && __S.cp.pieces.length < __S.mesh.F.length && !document.getElementById("busy").classList.contains("show"))'); if (v === true) { ok = true; break; } }
  console.log('loaded', ok);
  console.log(await ev('document.getElementById("stats").textContent + " | " + document.getElementById("warns").textContent'));
  const extra = process.env.PCTEST ? fs.readFileSync(process.env.PCTEST, 'utf8') : null;
  if (extra) console.log('test:', JSON.stringify(await ev(extra), null, 1));
  await new Promise(r => setTimeout(r, 600));
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(shot, Buffer.from(s.result.data, 'base64'));
  console.log('screenshot', shot);
  console.log(logs.join('\n') || 'geen console-meldingen');
  sock.close(); try { require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} srv.close(); process.exit(0);
});
