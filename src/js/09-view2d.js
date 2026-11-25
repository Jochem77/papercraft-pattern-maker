// 2D pattern view: SVG, zoom/pan/drag, cutting and joining edges
// ---------------------------------------------------------------- SVG-opbouw
const LS = {
  cut: 'stroke="#111" stroke-width="0.25" stroke-linecap="round" fill="none"',
  m: 'stroke="#b42318" stroke-width="0.25" stroke-dasharray="3 1 0.01 1" stroke-linecap="round" fill="none"',
  v: 'stroke="#1d4ed8" stroke-width="0.25" stroke-dasharray="3 1.5" fill="none"'
};
function upright(a) { a = ((a % 360) + 360) % 360; if (a > 90 && a <= 270) a -= 180; return a; }
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

// mode: 'screen' (lokale coörd. in <g transform>) of 'world' (alles omgerekend)
function pieceBody(p, mode, opt) {
  const st = S.set, d = p.d;
  const T = mode === 'screen' ? (q => q) : (q => toWorld(p, q));
  const pts = P => P.map(q => { const w = T(q); return fx(w[0]) + ',' + fx(w[1]); }).join(' ');
  const ln = (a, b, attr) => { const A = T(a), B = T(b); return `<line x1="${fx(A[0])}" y1="${fx(A[1])}" x2="${fx(B[0])}" y2="${fx(B[1])}" ${attr}/>`; };
  const screen = mode === 'screen';
  const colors = screen || st.printColors;
  let s = '';
  // vlakken
  for (const fc of d.faces) {
    let fill = fc.col && colors ? rgb(fc.col) : (opt.noWhite ? 'none' : '#fff');
    if (screen && fc.bad) fill = '#ff8a80';
    s += `<polygon class="facefill" data-f="${fc.f}" points="${pts(fc.pts)}" fill="${fill}" stroke="${fill}" stroke-width="0.12" stroke-linejoin="round"/>`;
  }
  // stroken
  for (const t of d.tabs) {
    const fill = screen && t.bad ? '#ffb4a8' : (screen ? '#f1f3f6' : (opt.noWhite ? 'none' : '#fff'));
    const sh = t.shape || t.poly;
    s += `<polygon class="tabf" points="${pts(sh)}" fill="${fill}" stroke="none"/>`;
    if (opt.cut) s += `<polyline class="cut" points="${pts(sh)}" ${LS.cut}/>`;
  }
  if (opt.folds) for (const f of d.folds) if (!skipFold(f)) s += ln(f.a, f.b, `class="fold" ${LS[f.type]}`);
  if (opt.cut) for (const c of d.cuts) s += ln(c.a, c.b, `class="cut" ${LS.cut}${c.open ? ' stroke-opacity="0.9"' : ''}`);
  // stuknummer in een rondje (altijd horizontaal)
  if (st.pieceNums && opt.labels && d.numPos && S.pieceNo) {
    const pn = pieceNumGeom(p);
    if (pn) {
      const C = T([d.numPos.x, d.numPos.y]);
      if (pn.pill) {
        const ang = screen ? upright(d.numPos.ang + p.rot) - p.rot : upright(d.numPos.ang + p.rot);
        s += `<g class="pnum" transform="rotate(${fx(ang)} ${fx(C[0])} ${fx(C[1])})"><rect x="${fx(C[0] - pn.pill.w / 2)}" y="${fx(C[1] - pn.pill.h / 2)}" width="${fx(pn.pill.w)}" height="${fx(pn.pill.h)}" rx="${fx(pn.pill.h / 2)}" fill="#fff" stroke="#222" stroke-width="${fx(pn.fs * 0.07)}"/><text x="${fx(C[0] - textW(pn.n, pn.fs) / 2)}" y="${fx(C[1] + pn.fs * 0.36)}" font-size="${fx(pn.fs)}" font-family='${font().css}' font-weight="bold" fill="#111">${pn.n}</text>${underlineSvg(pn.n, C[0], C[1], pn.fs, '#111')}</g>`;
      } else {
      const rotA = screen ? ` transform="rotate(${fx(-p.rot)} ${fx(C[0])} ${fx(C[1])})"` : '';
      s += `<g class="pnum"${rotA}><circle cx="${fx(C[0])}" cy="${fx(C[1])}" r="${fx(pn.r)}" fill="#fff" stroke="#222" stroke-width="${fx(pn.fs * 0.07)}"/><text x="${fx(C[0] - textW(pn.n, pn.fs) / 2)}" y="${fx(C[1] + pn.fs * 0.36)}" font-size="${fx(pn.fs)}" font-family='${font().css}' font-weight="bold" fill="#111">${pn.n}</text>${underlineSvg(pn.n, C[0], C[1], pn.fs, '#111')}</g>`;
      }
    }
  }
  // nummers
  if (st.numbers && opt.labels) {
    for (const l of d.labels) {
      if (l.fs < 0.9) continue;
      const n = S.num[l.e]; if (!n) continue;
      const W = T([l.x, l.y]);
      const ang = screen ? upright(l.ang + p.rot) - p.rot : upright(l.ang + p.rot);
      const dark = !colors || l.tab || lum(l.col) > 140;
      s += `<text x="${fx(W[0] - textW(n, l.fs) / 2)}" y="${fx(W[1] + l.fs * 0.36)}" font-size="${fx(l.fs)}" font-family='${font().css}' font-weight="${font().weight}" fill="${dark ? '#222' : '#fff'}" transform="rotate(${fx(ang)} ${fx(W[0])} ${fx(W[1])})">${n}</text>` + underlineSvg(n, W[0], W[1], l.fs, dark ? '#222' : '#fff', `rotate(${fx(ang)} ${fx(W[0])} ${fx(W[1])})`);
    }
  }
  return s;
}

function pieceNumGeom(p) {
  const d = p.d; if (!d.numPos || d.numPos.hidden || !S.pieceNo) return null;
  const n = S.pieceNo[p.id], fs = d.numPos.fs || Math.max(Math.min(1.8, S.set.pieceNumSize), Math.min(S.set.pieceNumSize, d.numPos.inr * 1.25));
  const w = String(n).length * font().k * fs;
  if (d.numPos.pill) return { n, fs, r: (w + fs * PILL_PAD) / 2, pill: { w: w + fs * PILL_PAD, h: fs * PILL_H } };
  return { n, fs, r: Math.max(fs * 0.66, w / 2 + fs * 0.28) };
}
function pageRects() {
  const mg = effMargin();
  let s = '';
  for (let i = 0; i < S.pageCount; i++) {
    const [x, y] = pageOrigin(i), [PW, PH] = pageDims(i), marks = silMarkRects(i);
    s += `<rect class="page" x="${x}" y="${y}" width="${PW}" height="${PH}"/>`;
    s += `<rect class="print-area" x="${x + mg}" y="${y + mg}" width="${PW - 2 * mg}" height="${PH - 2 * mg}"/>`;
    const lab = (S.pageLabels[i] ? ' · ' + colorName(S.pageLabels[i]) : '') + (pagePaper(i) !== S.set.paper || (S.set.groupColors && S.colorPaper && Object.keys(S.colorPaper).length) ? ' · ' + pagePaper(i) : '');
    s += `<text class="pagelabel" x="${x}" y="${y - 3}">${tr('Page')} ${i + 1}${lab}</text>`;
    for (const ob of silObstacles(i)) s += `<rect x="${fx(x + mg + ob.x)}" y="${fx(y + mg + ob.y)}" width="${fx(ob.w)}" height="${fx(ob.h)}" fill="#94a3b8" fill-opacity="0.22" stroke="none"><title>${tr('Keep-clear zone (Silhouette)')}</title></rect>`;
    for (const r of marks) s += `<rect x="${fx(x + r[0])}" y="${fx(y + r[1])}" width="${fx(r[2])}" height="${fx(r[3])}" fill="#000"/>`;
  }
  return s;
}
function colorName(key) {
  if (!S.model || !S.model.materials) return '';
  const mt = S.model.materials.find(m => m.color.join(',') === key);
  return mt ? mt.name : 'rgb(' + key + ')';
}

const svg = $('sheet');
function render2D() {
  if (!S.cp) return;
  let s = `<g id="pages">${pageRects()}</g><g id="pcs">`;
  const selP = S.selFace >= 0 ? S.cp.pieceOf[S.selFace] : -1;
  for (const p of S.cp.pieces) {
    s += `<g class="piece${p.id === selP ? ' sel' : ''}${p.off || p.hitOther ? ' off' : ''}" data-p="${p.id}" transform="translate(${fx(p.x)} ${fx(p.y)}) rotate(${fx(p.rot)})">`;
    s += pieceBody(p, 'screen', { cut: true, folds: true, labels: true });
    for (const h of p.d.hits) s += `<line class="hit${h.flat ? ' flat' : ''}" data-e="${h.e}" x1="${fx(h.a[0])}" y1="${fx(h.a[1])}" x2="${fx(h.b[0])}" y2="${fx(h.b[1])}"/>`;
    s += '</g>';
  }
  s += '</g><g id="hl"></g>';
  svg.innerHTML = s;
  drawHover2D();
}

// ---------------------------------------------------------------- 2D: zoomen/schuiven/slepen
const VB = { x: -10, y: -20, w: 300, h: 300 };
function applyVB() { svg.setAttribute('viewBox', `${VB.x} ${VB.y} ${VB.w} ${VB.h}`); }
function fitView() {
  const [PW, PH] = cellDims();
  const n = Math.max(S.pageCount, 1);
  const cw = svg.clientWidth || 600, ch = svg.clientHeight || 400;
  const cols = Math.min(n, pageCols()), rows = Math.ceil(n / pageCols());
  let w = cols * (PW + GAP) - GAP + 20, h = rows * (PH + GAP) - GAP + 42;
  if (w / h > cw / ch) h = w * ch / cw; else w = h * cw / ch;
  VB.x = -10; VB.y = -30; VB.w = w; VB.h = h; applyVB();
}
function svgPt(ev) { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  const p = svgPt(ev), k = Math.exp(Math.max(-60, Math.min(60, ev.deltaY)) * 0.004);
  VB.x = p.x - (p.x - VB.x) * k; VB.y = p.y - (p.y - VB.y) * k; VB.w *= k; VB.h *= k; applyVB();
}, { passive: false });
let drag = null;
// Touch: two fingers pinch to zoom and move to pan (fingers on screen by pointer id)
const fingers = new Map();
const pinchInfo = () => { const [a, b] = [...fingers.values()]; return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };
const endFinger = ev => { fingers.delete(ev.pointerId); if (drag && drag.mode === 'pinch' && fingers.size < 2) drag = null; };
svg.addEventListener('pointerdown', ev => {
  if (!S.cp) return;
  if (ev.pointerType === 'touch') fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (fingers.size >= 2) {
    // a second finger: stop moving a piece (it stays where it is) and start pinching
    if (drag && drag.mode === 'piece' && drag.moved) { updateWorld(); render2D(); }
    if (fingers.size === 2) { const r = svg.getBoundingClientRect(); drag = { mode: 'pinch', start: pinchInfo(), vb: { ...VB }, r }; }
    svg.setPointerCapture(ev.pointerId);
    return;
  }
  const pg = ev.target.closest('.piece'), hit = ev.target.closest('.hit');
  if (ev.button === 1 || ev.button === 2 || !pg) drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, vb: { ...VB } };
  else drag = { mode: 'piece', pid: +pg.dataset.p, el: pg, start: svgPt(ev), sx: ev.clientX, sy: ev.clientY, moved: false, e: hit ? +hit.dataset.e : -1, face: ev.target.dataset.f !== undefined ? +ev.target.dataset.f : -1, shift: ev.shiftKey, alt: ev.altKey, flat: hit && hit.classList.contains('flat') };
  svg.setPointerCapture(ev.pointerId);
});
svg.addEventListener('pointermove', ev => {
  if (fingers.has(ev.pointerId)) fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (drag && drag.mode === 'pinch') {
    if (fingers.size < 2) return;
    const s0 = drag.start, s1 = pinchInfo(), v = drag.vb, r = drag.r, k = s0.d / s1.d;
    const cw = svg.clientWidth || r.width, ch = svg.clientHeight || r.height;
    // the pattern point under the fingers at the start stays under the fingers
    const px = v.x + (s0.mx - r.left) * v.w / cw, py = v.y + (s0.my - r.top) * v.h / ch;
    VB.w = v.w * k; VB.h = v.h * k; VB.x = px - (s1.mx - r.left) * VB.w / cw; VB.y = py - (s1.my - r.top) * VB.h / ch; applyVB();
    return;
  }
  if (!drag) {
    const hit = S.tool === 'cut' && ev.target.closest && ev.target.closest('.hit');
    setHover(hit && (!hit.classList.contains('flat') || ev.altKey) ? +hit.dataset.e : -1);
    return;
  }
  if (drag.mode === 'pan') {
    const k = VB.w / svg.clientWidth;
    VB.x = drag.vb.x - (ev.clientX - drag.sx) * k; VB.y = drag.vb.y - (ev.clientY - drag.sy) * k; applyVB();
    return;
  }
  if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 4) return;
  const p = S.cp.pieces[drag.pid];
  if (!drag.moved) { drag.moved = true; pushUndo(); drag.ox = p.x; drag.oy = p.y; selectPiece(p.faces[0], false); setHover(-1); }
  const q = svgPt(ev);
  p.x = drag.ox + q.x - drag.start.x; p.y = drag.oy + q.y - drag.start.y;
  const el = svg.querySelector(`.piece[data-p="${drag.pid}"]`);
  if (el) el.setAttribute('transform', `translate(${fx(p.x)} ${fx(p.y)}) rotate(${fx(p.rot)})`);
});
svg.addEventListener('pointercancel', ev => { endFinger(ev); if (drag && drag.mode !== 'pinch' && !fingers.size) drag = null; });
svg.addEventListener('pointerup', ev => {
  const pinching = drag && drag.mode === 'pinch';
  endFinger(ev);
  if (pinching) return;
  const d = drag; drag = null;
  if (!d || d.mode !== 'piece') return;
  if (d.moved) { updateWorld(); render2D(); return; }
  if (S.paint && d.face >= 0) { pushUndo(); finishPaint(paintFace(d.face)); return; }
  if (S.tool === 'cut' && d.e >= 0 && (!d.flat || d.alt)) { if (d.shift) flipTab(d.e); else toggleEdge(d.e); }
  else selectPiece(d.face >= 0 ? d.face : S.cp.pieces[d.pid].faces[0], true); // only highlight; the 3D view keeps its angle
});
// double click (or double tap) on a piece: turn the 3D view towards it
svg.addEventListener('dblclick', ev => { if (S.cp && S.tool !== 'cut' && !S.paint && ev.target.closest('.piece') && S.selFace >= 0) focusPiece3D(); });
svg.addEventListener('contextmenu', ev => ev.preventDefault());

function selectPiece(face, rerender) {
  S.selFace = face;
  if (rerender) { render2D(); update3DColors(); }
  else {
    const pid = face >= 0 ? S.cp.pieceOf[face] : -1;
    svg.querySelectorAll('.piece').forEach(g => g.classList.toggle('sel', +g.dataset.p === pid));
    update3DColors();
  }
}
function rotateSel(deg) {
  if (S.selFace < 0 || !S.cp) return toast(tr('Select a piece first (click on it)'));
  const p = S.cp.pieces[S.cp.pieceOf[S.selFace]];
  pushUndo();
  const bb = p.wbb || [p.x, p.y, p.x, p.y];
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  const r = rotPt([p.x - cx, p.y - cy], deg);
  p.x = cx + r[0]; p.y = cy + r[1]; p.rot += deg;
  updateWorld(); render2D();
}

// ---------------------------------------------------------------- randen knippen / verbinden
function toggleEdge(e) {
  const m = S.mesh, E = m.E[e];
  if (!E.m) return toast(tr('This is an open edge; it cannot be joined.'));
  if (S.joined[e]) { pushUndo(); S.joined[e] = 0; S.manual = true; refresh(); toast(tr('Edge cut (no. {n})', { n: S.num[e] }), 1500); return; }
  const [f, g] = E.f;
  if (S.cp.pieceOf[f] === S.cp.pieceOf[g]) {
    const W = S.world;
    const ok = E.v.every(v => { const i = m.F[f].indexOf(v), j = m.F[g].indexOf(v); return Math.hypot(W[f * 6 + i * 2] - W[g * 6 + j * 2], W[f * 6 + i * 2 + 1] - W[g * 6 + j * 2 + 1]) < 0.01; });
    if (!ok) return toast(tr('Cannot join: the piece would become closed all around and could no longer lie flat.'), 4000);
  }
  pushUndo(); S.joined[e] = 1; S.manual = true; refresh();
  const p = S.cp.pieces[S.cp.pieceOf[f]];
  if (p.d.bad) toast(tr('Note: this piece now overlaps itself or a glue tab has no room (red).'), 4000);
  else if (p.big) toast(tr('Note: this piece is now larger than the paper.'), 4000);
  else toast(tr('Edges joined'), 1200);
}
function flipTab(e) {
  const E = S.mesh.E[e];
  if (!E.m || S.joined[e]) return toast(tr('Shift+click works on a cut edge: the glue tab moves to the other side.'));
  pushUndo();
  S.tabUser[e] = S.tl.tabFace[e] === E.f[0] ? 1 : 0;
  S.manual = true; refresh();
  toast(tr('Glue tab moved to the other side'), 1200);
}

function setHover(e) {
  if (S.hover === e) return;
  S.hover = e;
  drawHover2D(); drawHover3D();
  const hi = $('hoverInfo');
  if (e < 0 || !S.mesh) { hi.textContent = ''; return; }
  const E = S.mesh.E[e];
  const state = !E.m ? tr('open edge') : S.joined[e] ? (E.flat ? tr('flat (Alt+click to cut)') : tr('fold ({k})', { k: tr(foldType(E.convex) === 'm' ? 'mountain' : 'valley') }) + ' · ' + (E.bend * 180 / Math.PI).toFixed(1) + '°') : tr('cut · no. {n}', { n: S.num[e] });
  hi.textContent = tr('Edge: {s} · length {l} mm · angle {a}°', { s: state, l: fx(E.len * S.scale), a: Math.round(E.bend * 180 / Math.PI) });
}
function drawHover2D() {
  const g = svg.querySelector('#hl'); if (!g) return;
  const e = S.hover;
  if (e < 0 || !S.world) { g.innerHTML = ''; return; }
  const m = S.mesh, W = S.world;
  let s = '';
  for (const f of m.E[e].f) {
    const i = m.FE[f].indexOf(e), j = (i + 1) % 3, o = f * 6;
    s += `<line x1="${fx(W[o + i * 2])}" y1="${fx(W[o + i * 2 + 1])}" x2="${fx(W[o + j * 2])}" y2="${fx(W[o + j * 2 + 1])}"/>`;
  }
  g.innerHTML = s;
}

