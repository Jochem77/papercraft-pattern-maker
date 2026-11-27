// Printing, PDF and cutting plotter export
// ---------------------------------------------------------------- printen
function pagesWithContent() {
  const set = new Set(); for (const p of S.cp.pieces) if (p.page >= 0) set.add(p.page);
  return [...set].sort((a, b) => a - b);
}
function worldContent(opt) {
  return S.cp.pieces.map(p => pieceBody(p, 'world', opt)).join('');
}
// ---------------------------------------------------------------- PDF (eigen generator, ware grootte)
const PT = 72 / 25.4; // punten per mm
const pdfTxt = t => String(t).replace(/([()\\])/g, '\\$1').replace(/[^\x20-\x7e]/g, c => { const n = c.charCodeAt(0); return n >= 0xa0 && n <= 0xff ? '\\' + n.toString(8) : '?'; });
const rgbOp = (c, op) => `${fx(c[0] / 255)} ${fx(c[1] / 255)} ${fx(c[2] / 255)} ${op}`;
function pdfPageOps(pageIdx, k, total) {
  const [PW, PH] = pageDims(pageIdx), [x0, y0] = pageOrigin(pageIdx), st = S.set, colors = st.printColors, mg = effMargin();
  const o = [`${fx(PT)} 0 0 ${fx(-PT)} 0 ${fx(PH * PT)} cm`, '1 j'];
  const path = (pts, close) => pts.map((q, i) => `${fx(q[0] - x0)} ${fx(q[1] - y0)} ${i ? 'l' : 'm'}`).join(' ') + (close ? ' h' : '');
  const STY = {
    cut: '0.067 0.067 0.067 RG 0.25 w [] 0 d 1 J',
    m: '0.706 0.137 0.094 RG 0.25 w [3 1 0.01 1] 0 d 1 J',
    v: '0.114 0.306 0.847 RG 0.25 w [3 1.5] 0 d 0 J'
  };
  const text = (str, cx, cy, fs, angDeg, col, fnt = '/F1') => {
    const a = angDeg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    const w = String(str).length * font().k * fs; // breedte van cijfers in dit lettertype
    const ox = cx - c * w / 2 - sn * 0.35 * fs, oy = cy - sn * w / 2 + c * 0.35 * fs;
    o.push(`${rgbOp(col, 'rg')} BT ${fnt} ${fx(fs)} Tf ${fx(c)} ${fx(sn)} ${fx(sn)} ${fx(-c)} ${fx(ox - x0)} ${fx(oy - y0)} Tm (${pdfTxt(str)}) Tj ET`);
    if (flipAmbiguous(str)) { // line under 6 / 9 and the like
      const mx = cx - sn * 0.52 * fs, my = cy + c * 0.52 * fs, hw = w * 0.45;
      o.push(`[] 0 d 1 J ${rgbOp(col, 'RG')} ${fx(Math.max(0.15, fs * 0.1))} w ${fx(mx - c * hw - x0)} ${fx(my - sn * hw - y0)} m ${fx(mx + c * hw - x0)} ${fx(my + sn * hw - y0)} l S`);
    }
  };
  for (const p of S.cp.pieces) {
    if (p.page !== pageIdx) continue;
    const W = q => toWorld(p, q), d = p.d;
    o.push('[] 0 d 0.12 w');
    for (const fc of d.faces) { const col = fc.col && colors ? fc.col : [255, 255, 255]; o.push(`${rgbOp(col, 'rg')} ${rgbOp(col, 'RG')} ${path(fc.pts.map(W), true)} B`); }
    for (const t of d.tabs) o.push(`1 1 1 rg ${path((t.shape || t.poly).map(W), true)} f`);
    if (st.foldPrint) for (const f of d.folds) if (!skipFold(f)) o.push(`${STY[f.type]} ${path([W(f.a), W(f.b)])} S`);
    o.push(STY.cut);
    for (const t of d.tabs) o.push(`${path((t.shape || t.poly).map(W))} S`);
    for (const c of d.cuts) o.push(`${path([W(c.a), W(c.b)])} S`);
    if (st.numbers) for (const l of d.labels) {
      if (l.fs < 0.9) continue;
      const n = S.num[l.e]; if (!n) continue;
      const c = W([l.x, l.y]);
      const dark = !colors || l.tab || lum(l.col) > 140;
      text(n, c[0], c[1], l.fs, upright(l.ang + p.rot), dark ? [34, 34, 34] : [255, 255, 255]);
    }
    if (st.pieceNums && d.numPos) {
      const pn = pieceNumGeom(p);
      if (pn) {
        const C = W([d.numPos.x, d.numPos.y]), cx = C[0] - x0, cy = C[1] - y0, r = pn.r, kk = 0.5523 * r;
        if (pn.pill) {
          const ang = upright(d.numPos.ang + p.rot);
          o.push(`[] 0 d 1 1 1 rg 0.133 0.133 0.133 RG ${fx(pn.fs * 0.07)} w ${path(pillPts(C[0], C[1], pn.pill.w, pn.pill.h, ang), true)} B`);
          text(pn.n, C[0], C[1], pn.fs, ang, [17, 17, 17], '/F2');
        } else {
        o.push(`[] 0 d 1 1 1 rg 0.133 0.133 0.133 RG ${fx(pn.fs * 0.07)} w ${fx(cx + r)} ${fx(cy)} m ${fx(cx + r)} ${fx(cy + kk)} ${fx(cx + kk)} ${fx(cy + r)} ${fx(cx)} ${fx(cy + r)} c ${fx(cx - kk)} ${fx(cy + r)} ${fx(cx - r)} ${fx(cy + kk)} ${fx(cx - r)} ${fx(cy)} c ${fx(cx - r)} ${fx(cy - kk)} ${fx(cx - kk)} ${fx(cy - r)} ${fx(cx)} ${fx(cy - r)} c ${fx(cx + kk)} ${fx(cy - r)} ${fx(cx + r)} ${fx(cy - kk)} ${fx(cx + r)} ${fx(cy)} c h B`);
        text(pn.n, C[0], C[1], pn.fs, 0, [17, 17, 17], '/F2');
        }
      }
    }
  }
  // Silhouette-registratiemarkeringen (zwart, exact op maat)
  const marks = silMarkRects(pageIdx);
  if (marks.length) o.push('0 0 0 rg ' + marks.map(r => `${fx(r[0])} ${fx(r[1])} ${fx(r[2])} ${fx(r[3])} re`).join(' ') + ' f');
  // voettekst in de marge: paginanummer + controlelijn van 50 mm (bij markeringen: onder de markeringen, rechts van de L-hoek)
  const fm = marks.length ? st.silInset : mg;
  if (fm >= 6) {
    const T = (str, size, x, base, grey) => o.push(`${grey} ${grey} ${grey} rg BT /F1 ${fx(size)} Tf 1 0 0 -1 ${fx(x)} ${fx(base)} Tm (${pdfTxt(str)}) Tj ET`);
    const fs = Math.min(3.5, fm * 0.35), f2 = Math.min(3, fs * 0.86);
    const lx = marks.length ? st.silInset + st.silLen + 6 : mg; // rechts van de vrije zone linksonder
    const base1 = PH - fm + 1.5 + fs;
    const lab = `${baseName()} - ${tr('page {k}/{n}', { k, n: total })}` + (S.pageLabels[pageIdx] ? ' - ' + colorName(S.pageLabels[pageIdx]) : '') + ` (${paperName(pagePaper(pageIdx))} ${tr(orientNow() === 'landscape' ? 'landscape' : 'portrait')})`;
    T(lab, fs, lx, base1, 0.2);
    if (marks.length) {
      // instellingen van de markeringen (zelfde notatie als Silhouette Studio)
      const nl = v => S.set.lang === 'nl' ? v.toFixed(2).replace('.', ',') : v.toFixed(2);
      T(tr('Registration marks: Length {len} mm - Line thickness {th} mm - Inset {ins} mm - print at 100%', { len: nl(st.silLen), th: nl(st.silThick), ins: nl(st.silInset) }), f2, lx, base1 + f2 + 1.4, 0.2);
    }
    // controlelijn van 50 mm rechts op de eerste regel
    const xe = PW - fm, xs = xe - 50, yc = base1 - fs * 0.35, t = 1;
    o.push(`0.2 0.2 0.2 RG 0.25 w [] 0 d 0 J ${fx(xs)} ${fx(yc)} m ${fx(xe)} ${fx(yc)} l S ${fx(xs)} ${fx(yc - t)} m ${fx(xs)} ${fx(yc + t)} l S ${fx(xe)} ${fx(yc - t)} m ${fx(xe)} ${fx(yc + t)} l S`);
    const cl = tr('check 50 mm'), cw = cl.length * 0.5 * f2;
    T(cl, f2, xs - cw - 2, yc + f2 * 0.35, 0.35);
  }
  return o.join('\n');
}
async function deflate(u) {
  if (typeof CompressionStream !== 'function') return null;
  try { return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); } catch (e) { return null; }
}
async function buildPDF(pageList) {
  const pages = pageList || pagesWithContent(), enc = new TextEncoder();
  const chunks = [], offs = []; let len = 0;
  const add = x => { const u = typeof x === 'string' ? enc.encode(x) : x; chunks.push(u); len += u.length; };
  const obj = (id, parts) => { offs[id] = len; add(`${id} 0 obj\n`); [].concat(parts).forEach(add); add('\nendobj\n'); };
  add('%PDF-1.4\n'); add(new Uint8Array([37, 226, 227, 207, 211, 10]));
  const n = pages.length;
  obj(1, '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>');
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + 2 * i} 0 R`).join(' ')}] /Count ${n} >>`);
  obj(3, `<< /Type /Font /Subtype /Type1 /BaseFont /${font().pdf} /Encoding /WinAnsiEncoding >>`);
  const f2id = 5 + 2 * n; // vet lettertype voor stuknummers (wordt na de pagina's geschreven)
  obj(4, `<< /Title (${pdfTxt(baseName())}) /Producer (Papercraft Pattern Maker ${APP_VERSION}) /Creator (${REPO_URL}) >>`);
  for (let i = 0; i < n; i++) {
    const [PW, PH] = pageDims(pages[i]);
    obj(5 + 2 * i, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fx(PW * PT)} ${fx(PH * PT)}] /Resources << /Font << /F1 3 0 R /F2 ${f2id} 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`);
    const raw = enc.encode(pdfPageOps(pages[i], i + 1, n));
    const z = await deflate(raw);
    const data = z || raw;
    obj(6 + 2 * i, [`<< /Length ${data.length}${z ? ' /Filter /FlateDecode' : ''} >>\nstream\n`, data, '\nendstream']);
  }
  obj(f2id, `<< /Type /Font /Subtype /Type1 /BaseFont /${font().pdfB} /Encoding /WinAnsiEncoding >>`);
  const N = f2id, xo = len;
  let x = `xref\n0 ${N + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= N; id++) x += String(offs[id]).padStart(10, '0') + ' 00000 n \n';
  add(x + `trailer\n<< /Size ${N + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xo}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
// One PDF per material when "Pages per color" is on (each is printed on its own card), else one PDF.
async function buildPDFs() {
  const pages = pagesWithContent(), groups = new Map();
  for (const i of pages) { const k = S.set.groupColors ? (S.pageLabels[i] || '') : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
  const safe = t => String(t).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'color';
  const out = [];
  for (const [k, list] of groups) {
    const paper = paperTag(pagePaper(list[0]));
    const name = k ? `${baseName()}-${safe(colorName(k))}-${paper}.pdf` : `${baseName()}-${paper}.pdf`;
    out.push({ name, blob: await buildPDF(list), pages: list.length });
  }
  return out;
}
async function exportPDF() {
  if (!S.cp) return;
  const warn = RP ? RP.plan.tooBig.length > 0 : S.cp.pieces.some(p => p.off || p.big || p.page < 0);
  busy(true, tr('Creating PDF…'));
  try {
    const pdfs = await buildPDFs();
    if (pdfs.length === 1) download(pdfs[0].name, pdfs[0].blob);
    else download(baseName() + '-PDF.zip', makeZip(await Promise.all(pdfs.map(async f => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })))));
    const np = pdfs.reduce((n, f) => n + f.pages, 0);
    toast((pdfs.length === 1 ? tr('PDF downloaded: {n} {pages} {p}, true size (1:1).', { n: np, pages: pl(np, 'page', 'pages'), p: paperName(pagePaper(pagesWithContent()[0])) })
      : tr('{k} PDFs (one per color) in a ZIP: {n} {pages}, true size (1:1).', { k: pdfs.length, n: np, pages: pl(np, 'page', 'pages') })) + (warn ? tr(' Note: some pieces are (partly) outside the printable area.') : ''), 5000);
  } catch (e) { console.error(e); toast(tr('Creating PDF failed: ') + e.message, 5000); }
  busy(false);
}
window.__buildPDF = buildPDF;

// (alleen nog voor Ctrl+P vanuit de browser)
function fillPrintArea() {
  if (!S.cp) return;
  const [PW, PH] = pageDims();
  const content = worldContent({ cut: true, folds: S.set.foldPrint, labels: true });
  let h = '';
  for (const i of pagesWithContent()) {
    const [PW, PH] = pageDims(i);
    h += `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="${pageOrigin(i).join(' ')} ${PW} ${PH}">${content}</svg>`;
  }
  $('printArea').innerHTML = h;
  $('pageStyle').textContent = `@page{size:${PW}mm ${PH}mm;margin:0}`;
}

// ---------------------------------------------------------------- snijplotter-export
// Gesloten contouren per stuk (knip-lijnen + strook-randen aan elkaar geschakeld)
function cutLoops(p) {
  const segs = [];
  for (const c of p.d.cuts) segs.push([toWorld(p, c.a), toWorld(p, c.b)]);
  for (const t of p.d.tabs) { const W = (t.shape || t.poly).map(q => toWorld(p, q)); for (let k = 0; k + 1 < W.length; k++) segs.push([W[k], W[k + 1]]); }
  const key = q => Math.round(q[0] * 1000) + ',' + Math.round(q[1] * 1000);
  const at = new Map();
  segs.forEach((s, i) => { for (const q of s) { const k = key(q); if (!at.has(k)) at.set(k, []); at.get(k).push(i); } });
  const used = new Uint8Array(segs.length), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const path = [segs[i][0], segs[i][1]];
    let cur = segs[i][1], closed = false;
    for (;;) {
      const k = key(cur);
      if (k === key(path[0]) && path.length > 2) { closed = true; break; }
      const nx = (at.get(k) || []).find(j => !used[j]);
      if (nx === undefined) break;
      used[nx] = 1;
      const s = segs[nx];
      cur = key(s[0]) === k ? s[1] : s[0];
      path.push(cur);
    }
    if (closed) path.pop();
    loops.push({ path, closed });
  }
  return loops;
}
// Nearly flat folds (below "Skip folds below") are left out of everything that goes on paper:
// scoring, perforation, printed fold lines and the fold lines on screen.
function skipFold(f) {
  const min = (+S.set.scoreMinDeg || 0) * Math.PI / 180;
  return !f.tab && min > 0 && S.mesh.E[f.e].bend < min;
}
function foldSegs(p) {
  const out = [];
  for (const f of p.d.folds) {
    if (skipFold(f)) continue;
    out.push({ a: toWorld(p, f.a), b: toWorld(p, f.b), type: f.type });
  }
  return out;
}
function plotterSVG(pageIdx) {
  const [PW, PH] = pageDims(pageIdx), [x0, y0] = pageOrigin(pageIdx);
  const pieces = S.cp.pieces.filter(p => p.page === pageIdx);
  const sh = q => fx(q[0] - x0) + ',' + fx(q[1] - y0);
  let printL = '', cutL = '', foldL = '', perfL = '';
  const mode = S.set.foldMode, pc = Math.max(0.3, +S.set.perfCut || 2), pg = Math.max(0.2, +S.set.perfGap || 1);
  // score lines blue, perforation green: Silhouette Studio chooses the cut settings per line color
  const seg = (a, b, col = '#0000FF') => `<line x1="${fx(a[0] - x0)}" y1="${fx(a[1] - y0)}" x2="${fx(b[0] - x0)}" y2="${fx(b[1] - y0)}" stroke="${col}" stroke-width="0.25"/>`;
  // dashes, centred on the line, with a bridge at both ends so the corners stay strong
  const perf = (a, b) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, avail = L - 2 * pg;
    if (avail < pc * 0.5) return '';
    const n = Math.max(1, Math.floor((avail + pg) / (pc + pg))), cl = Math.min(pc, avail), used = n * cl + (n - 1) * pg;
    let o = '', t = (L - used) / 2;
    for (let i = 0; i < n; i++, t += cl + pg) o += seg([a[0] + ux * t, a[1] + uy * t], [a[0] + ux * (t + cl), a[1] + uy * (t + cl)], '#00A000');
    return o;
  };
  for (const p of pieces) {
    printL += pieceBody(p, 'world', { cut: false, folds: S.set.foldPrint, labels: true, noWhite: true }); // white paper: no white fill, so the score lines below stay visible
    for (const l of cutLoops(p)) cutL += `<path d="M${l.path.map(sh).join(' L')}${l.closed ? ' Z' : ''}" fill="none" stroke="#FF0000" stroke-width="0.25"/>`;
    // A score line works when the fold bends away from it (mountain fold seen from the printed
    // side); a fold towards the score line is perforated in mode 'mixed'.
    if (mode !== 'none') for (const f of foldSegs(p)) {
      if (mode === 'score' || (mode === 'mixed' && f.type === 'm')) foldL += seg(f.a, f.b);
      else perfL += perf(f.a, f.b);
    }
  }
  // Layer order matters: Silhouette Studio lists the line colours in the order they appear and
  // cuts the list from top to bottom. So: score (blue) and perforate (green) first, then the
  // print layer, and the cut lines (red) last, so a piece is not cut loose before it is scored.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}">
${mode === 'score' || mode === 'mixed' ? `<g id="score" inkscape:groupmode="layer" inkscape:label="${tr('score')}">${foldL}</g>
` : ''}${mode === 'perf' || mode === 'mixed' ? `<g id="perforate" inkscape:groupmode="layer" inkscape:label="${tr('perforate')}">${perfL}</g>
` : ''}<g id="print" inkscape:groupmode="layer" inkscape:label="print" transform="translate(${-x0} ${-y0})">${printL}</g>
<g id="cut" inkscape:groupmode="layer" inkscape:label="${tr('cut layer')}">${cutL}</g>${silMarkRects(pageIdx).length ? `
<g id="registration" inkscape:groupmode="layer" inkscape:label="${tr('registration marks (do not cut)')}">${silMarkRects(pageIdx).map(r => `<rect x="${fx(r[0])}" y="${fx(r[1])}" width="${fx(r[2])}" height="${fx(r[3])}" fill="#000"/>`).join('')}</g>` : ''}
</svg>`;
}
// Minimale ZIP-schrijver (zonder compressie)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, u) => s + u.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
// One ZIP with everything that belongs together: an SVG per page for the cutter, the PDF with the
// same pages in the same order (to print), and the project file (to change it later).
async function exportPlotter() {
  if (!S.cp) return;
  busy(true, tr('Creating files…'));
  try {
    const pages = pagesWithContent();
    // named like the PDF they belong to (material, paper) and numbered like its pages
    const safe = t => String(t).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'color', seen = new Map();
    const files = pages.map(i => {
      const key = S.set.groupColors ? (S.pageLabels[i] || '') : '', n = (seen.get(key) || 0) + 1; seen.set(key, n);
      return { name: `${baseName()}${key ? '-' + safe(colorName(key)) : ''}-${paperTag(pagePaper(i))}-${tr('page')}-${String(n).padStart(2, '0')}.svg`, data: plotterSVG(i) };
    });
    for (const f of await buildPDFs()) files.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
    // a reprint has no project file: the pieces lie elsewhere only for these files
    if (!RP) files.push({ name: baseName() + '.papercraft.json', data: JSON.stringify(projectData()) });
    download(baseName() + '-' + tr('cutter') + '.zip', makeZip(files));
    toast(tr(RP ? 'ZIP with {n} SVG {pages} and the PDF' : 'ZIP with {n} SVG {pages}, the PDF and the project file', { n: pages.length, pages: pl(pages.length, 'page', 'pages') }), 4000);
  } catch (e) { console.error(e); toast(tr('Export failed: ') + e.message, 5000); }
  busy(false);
}

