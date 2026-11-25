// Pieces, glue tabs, numbers and the drawings per piece
// ---------------------------------------------------------------- opbouw stukken + tekeningen
function refresh() {
  const m = S.mesh; if (!m) return;
  const prev = S.cp ? { pieceOf: S.cp.pieceOf, size: S.cp.pieces.map(p => p.faces.length) } : null;
  let cp;
  for (let k = 0; k < 20; k++) {
    cp = Core.computePieces(m, S.joined);
    if (!cp.bad.length) break;
    cp.bad.forEach(e => S.joined[e] = 0);
    toast(tr('Some edges could not stay joined (that would create a closed ring).'));
  }
  S.cp = cp;
  S.lmm = Core.toMM(cp.local, S.scale);
  const st = S.set;
  const fitWH = st.tabStyle === 'pair' ? autoOptions() : null; // flaps only where the piece still fits the paper
  S.tl = Core.layoutTabs(m, cp, S.lmm, S.joined, { tabH: st.tabH, tabAngle: st.tabAngle, minTab: st.minTab / 100, tabUser: S.tabUser, both: st.tabStyle === 'pair', pairMin: Math.max(0, +st.pairMin || 0), zip: zipSeg(), W: fitWH && fitWH.W, H: fitWH && fitWH.H, faceWH: fitWH && fitWH.faceWH });
  S.so = Core.selfOverlaps(cp, S.lmm);
  numberEdges();
  // plaats van elk stuk afleiden uit de vorige wereld-coördinaten (stukken blijven waar ze waren)
  let need = !S.world;
  if (S.world) {
    for (const p of cp.pieces) {
      let anchor = p.faces[0];
      if (prev) { let bs = -1; for (const f of p.faces) { const s = prev.size[prev.pieceOf[f]]; if (s > bs) { bs = s; anchor = f; } } }
      const L = S.lmm[anchor], o = anchor * 6, W = S.world;
      const aw = Math.atan2(W[o + 3] - W[o + 1], W[o + 2] - W[o]), al = Math.atan2(L[1][1] - L[0][1], L[1][0] - L[0][0]);
      const r = aw - al, c = Math.cos(r), s = Math.sin(r);
      p.rot = r * 180 / Math.PI;
      p.x = W[o] - (c * L[0][0] - s * L[0][1]);
      p.y = W[o + 1] - (s * L[0][0] + c * L[0][1]);
      if (!isFinite(p.x)) need = true;
    }
  }
  buildDrawings();
  if (need) autoLayout();
  updateWorld();
  numberPieces();
  render2D();
  update3D();
  buildPieceLabels3D();
}

// Stuknummers: per pagina, van linksboven naar rechtsonder (rijen van ~25 mm)
function numberPieces() {
  const ps = S.cp.pieces.slice().sort((a, b) => {
    const pa = a.page < 0 ? 1e9 : a.page, pb = b.page < 0 ? 1e9 : b.page;
    if (pa !== pb) return pa - pb;
    const ra = Math.floor(a.wbb[1] / 25), rb = Math.floor(b.wbb[1] / 25);
    return ra - rb || a.wbb[0] - b.wbb[0];
  });
  S.pieceNo = new Int32Array(S.cp.pieces.length);
  ps.forEach((p, i) => S.pieceNo[p.id] = i + 1);
}
function numberEdges() {
  const m = S.mesh; S.num = new Int32Array(m.E.length);
  let n = 0;
  for (const p of S.cp.pieces) for (const f of p.faces) for (const e of m.FE[f]) if (m.E[e].m && !S.joined[e] && !S.num[e]) S.num[e] = ++n;
}

// Lettertypes: in het scherm/SVG (css) en de 14 standaard-PDF-fonts (geen insluiten nodig). k = breedte van een cijfer (em)
const FONTS = {
  helvetica: { css: 'Arial,Helvetica,sans-serif', weight: 'normal', pdf: 'Helvetica', pdfB: 'Helvetica-Bold', k: 0.556 },
  'helvetica-bold': { css: 'Arial,Helvetica,sans-serif', weight: 'bold', pdf: 'Helvetica-Bold', pdfB: 'Helvetica-Bold', k: 0.556 },
  times: { css: '"Times New Roman",Times,serif', weight: 'normal', pdf: 'Times-Roman', pdfB: 'Times-Bold', k: 0.5 },
  courier: { css: '"Courier New",Courier,monospace', weight: 'normal', pdf: 'Courier', pdfB: 'Courier-Bold', k: 0.6 }
};
const font = () => FONTS[S.set.fontFamily] || FONTS.helvetica;
// Width of a number in mm. Positions text explicitly (left start + baseline), because
// Silhouette Studio ignores text-anchor and dominant-baseline in SVG files.
const textW = (n, fs) => String(n).length * font().k * fs;
// A number that reads as another number when turned upside down (6 / 9, 16 / 91, 86 / 98 …) gets a
// line under it, like on billiard balls. Numbers that stay the same (69, 88, 11) do not need one.
function flipAmbiguous(n) {
  const t = String(n); if (!/^[01689]+$/.test(t)) return false;
  const turned = [...t].reverse().map(c => (c === '6' ? '9' : c === '9' ? '6' : c)).join('');
  return turned !== t && turned[0] !== '0'; // '10' upside down is '01': not a number you would read
}
// SVG line under a number centred on (cx, cy) (before any rotation)
function underlineSvg(n, cx, cy, fs, col, transform) {
  if (!flipAmbiguous(n)) return '';
  const w = textW(n, fs) * 0.9, y = cy + fs * 0.52;
  return `<line class="ul" x1="${fx(cx - w / 2)}" y1="${fx(y)}" x2="${fx(cx + w / 2)}" y2="${fx(y)}" stroke="${col}" stroke-width="${fx(Math.max(0.15, fs * 0.1))}" stroke-linecap="round"${transform ? ` transform="${transform}"` : ''}/>`;
}
const lum = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
function faceFill(f) { return S.faceColor ? S.faceColor[f] : null; }

function buildDrawings() {
  const m = S.mesh, st = S.set, cp = S.cp;
  for (const p of cp.pieces) {
    const d = { faces: [], tabs: [], cuts: [], folds: [], hits: [], labels: [], bad: false };
    p.d = d;
    const cands = [];
    for (const f of p.faces) {
      const P = S.lmm[f];
      const col = faceFill(f);
      const bad = S.so.bad.has(f);
      if (bad) d.bad = true;
      d.faces.push({ f, pts: P, col, bad });
      // inradius voor tekstgrootte
      const la = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), lb = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]), lc = Math.hypot(P[0][0] - P[2][0], P[0][1] - P[2][1]);
      const area = Math.abs((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1])) / 2;
      const inr = 2 * area / (la + lb + lc);
      { // kandidaat-plekken voor het stuknummer: middelpunt ingeschreven cirkel + punten richting de hoeken
        const sum = la + lb + lc, wI = [lb / sum, lc / sum, la / sum];
        const ws = [wI];
        for (let v = 0; v < 3; v++) for (const t of [0.3, 0.5]) ws.push(wI.map((x, i) => x * (1 - t) + (i === v ? t : 0)));
        const edgeDist = (x, y) => { let mnd = Infinity; for (let i = 0; i < 3; i++) { const A = P[i], B = P[(i + 1) % 3], ex = B[0] - A[0], ey = B[1] - A[1], l = Math.hypot(ex, ey) || 1; mnd = Math.min(mnd, Math.abs((x - A[0]) * ey - (y - A[1]) * ex) / l); } return mnd; };
        for (const w of ws) {
          const x = w[0] * P[0][0] + w[1] * P[1][0] + w[2] * P[2][0], y = w[0] * P[0][1] + w[1] * P[1][1] + w[2] * P[2][1];
          cands.push({ f, inr: edgeDist(x, y), x, y, w });
        }
      }
      for (let i = 0; i < 3; i++) {
        const e = m.FE[f][i], E = m.E[e], a = P[i], b = P[(i + 1) % 3];
        if (E.m && S.joined[e]) {
          const g = Core.otherFace(E, f);
          if (f < g) { if (!E.flat) d.folds.push({ e, a, b, type: foldType(E.convex) }); d.hits.push({ e, a, b, flat: E.flat }); }
        } else if (E.m) {
          d.hits.push({ e, a, b });
          const ux = (b[0] - a[0]) / E.len / S.scale, uy = (b[1] - a[1]) / E.len / S.scale, l = E.len * S.scale;
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
          const zp = S.tl.zip && S.tl.zip[e] && S.tl.zip[e][f];
          if (zp) { // zipper: this face's parts of the seam, alternately a tab (with the number) and a cut
            for (const z of zp) {
              if (!z.poly) { d.cuts.push({ e, a: z.a, b: z.b }); continue; }
              d.tabs.push({ e, f, poly: z.poly, shape: null, bad: false });
              d.folds.push({ e, a: z.a, b: z.b, type: foldType(true), tab: true });
              const zl = Math.hypot(z.b[0] - z.a[0], z.b[1] - z.a[1]), zx = (z.a[0] + z.b[0]) / 2, zy = (z.a[1] + z.b[1]) / 2;
              const fs = Math.min(st.fontSize, z.h * 0.7, zl * 0.35);
              d.labels.push({ e, x: zx - uy * z.h / 2, y: zy + ux * z.h / 2, ang, fs, col: [255, 255, 255], tab: true });
            }
          } else if (S.tl.tabFace[e] === f) {
            const t = S.tl.tabs[e];
            d.tabs.push({ e, f, poly: t.poly, shape: null, bad: t.bad });
            if (t.bad) d.bad = true;
            d.folds.push({ e, a, b, type: foldType(true), tab: true });
            const fs = Math.min(st.fontSize, t.h * 0.7, l * 0.35);
            d.labels.push({ e, x: mx - uy * t.h / 2, y: my + ux * t.h / 2, ang, fs, col: [255, 255, 255], tab: true });
          } else {
            // two flaps glued together: this side gets a flap too (where it fits)
            const t2 = st.tabStyle === 'pair' && S.tl.tabs2 ? S.tl.tabs2[e] : null;
            if (t2) {
              d.tabs.push({ e, f, poly: t2.poly, shape: null, bad: false, flap: true });
              d.folds.push({ e, a, b, type: foldType(true), tab: true });
            } else d.cuts.push({ e, a, b });
            if (t2) { // the number goes on the flap, so the face itself stays clean
              const fs = Math.min(st.fontSize, t2.h * 0.6, l * 0.35);
              d.labels.push({ e, x: mx - uy * t2.h * 0.55, y: my + ux * t2.h * 0.55, ang, fs, col: [255, 255, 255], tab: true });
            } else if (!st.cleanFaces) {
              const fs = Math.min(st.fontSize, inr * 1.05, l * 0.35);
              const off = fs * 0.75;
              d.labels.push({ e, x: mx + uy * off, y: my - ux * off, ang, fs, col: col || [255, 255, 255] });
            }
          }
        } else {
          d.cuts.push({ e, a, b, open: true });
        }
      }
    }
    d.numPos = choosePieceNumPos(cands, d.labels);
    d.cands = cands;
  }
  // piece numbers on a tab; the place on the face stays for the 3D view (f, w). With "numbers only
  // on tabs" a piece number never goes on the outside: when no tab has room it is left off the paper.
  if (st.cleanFaces) for (const p of cp.pieces) {
    if (!p.d.numPos) continue;
    const tp = tabNumPos(p);
    p.d.numPos = tp ? { ...p.d.numPos, x: tp.x, y: tp.y, fs: tp.fs, ang: tp.ang, pill: true, onTab: true } : { ...p.d.numPos, hidden: true };
  }
}

// Kies de plek voor het stuknummer: zo groot mogelijk, zonder rand-/flapnummers te raken
// The piece number on a tab is drawn in a "pill" (rounded rectangle) along the tab, like the edge
// numbers, so it can be much larger than a circle in the same narrow strip.
const PILL_H = 1.3, PILL_PAD = 0.7; // pill height = fs * PILL_H, width = text width + fs * PILL_PAD
const NUM_GAP = 1; // mm free space between the piece number pill and the edge number on the same tab
// Steps tried when nothing fits: a smaller gap, the edge number on that tab smaller (factor, at
// least as large as the piece number) and a smaller piece number. A later step is only used when no tab fits an earlier one.
const NUM_STEPS = [{ gap: NUM_GAP, lab: 1, min: 1.3 }, { gap: 0.6, lab: 0.8, min: 1.2 }, { gap: 0.4, lab: 0.65, min: 1.1 }, { gap: 0.3, lab: 0.5, min: 1 }];
function tabNumPos(p) {
  const d = p.d, st = S.set, k = font().k, digits = String(S.pieceNo ? S.pieceNo[p.id] : 88).length;
  const pillW = fs => digits * k * fs + fs * PILL_PAD;
  let best = null;
  const offer = (fs, c, ang, score, move) => { if (!best || score > best.score) best = { x: c[0], y: c[1], fs, ang, pill: true, score, move }; };
  for (let si = 0; si < NUM_STEPS.length && !best; si++) for (const t of d.tabs) tryTab(t, NUM_STEPS[si]);
  if (best && best.move) { const l = best.move.lab; l.x = best.move.pos[0]; l.y = best.move.pos[1]; l.fs = best.move.fs; }
  return best;
  function tryTab(t, step) {
    const P0 = t.poly, a = P0[0], b = P0[3], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!(L > 0)) return;
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], dTop = (P0[1][0] - a[0]) * u[0] + (P0[1][1] - a[1]) * u[1];
    const ov = [P0[1][0] - a[0] - u[0] * dTop, P0[1][1] - a[1] - u[1] * dTop], h = Math.hypot(ov[0], ov[1]); if (!(h > 0)) return;
    const o = [ov[0] / h, ov[1] / h], ang = Math.atan2(u[1], u[0]) * 180 / Math.PI;
    // the edge number on this tab (a zipper has several tabs of the same edge: take the one on this tab)
    const lab = d.labels.find(l => {
      if (!l.tab || l.e !== t.e || l.fs < 0.9) return false;
      const x = (l.x - a[0]) * u[0] + (l.y - a[1]) * u[1], y = (l.x - a[0]) * o[0] + (l.y - a[1]) * o[1];
      return x > -0.01 && x < L + 0.01 && y > 0 && y < h + 0.01;
    });
    const lfs = lab ? (step.lab < 1 ? Math.max(Math.min(lab.fs, step.min), lab.fs * step.lab) : lab.fs) : 0, G = step.gap;
    const lw = lab ? String(S.num[lab.e] || 88).length * k * lfs / 2 + 0.3 : 0; // half width of the edge number
    const xmax = yy => L - yy * dTop / h, xmin = yy => yy * dTop / h;
    const at = (x, yy) => [a[0] + u[0] * x + o[0] * yy, a[1] + u[1] * x + o[1] * yy];
    const lx = lab ? (lab.x - a[0]) * u[0] + (lab.y - a[1]) * u[1] : 0, ly = lab ? (lab.x - a[0]) * o[0] + (lab.y - a[1]) * o[1] : 0;
    for (let fs = Math.min(st.pieceNumSize, (h - 0.6) / PILL_H); fs >= step.min; fs *= 0.9) {
      const ph = fs * PILL_H, pw = pillW(fs);
      // 1. next to the edge number where it is now; halfway up the tab, or lower where the tab is wider
      let found = null;
      for (const y of [h / 2, ph / 2 + 0.3]) {
        const lo = xmin(y + ph / 2) + pw / 2 + 0.2, hi = xmax(y + ph / 2) - pw / 2 - 0.2;
        for (let x = lo; x <= hi + 1e-9; x += 0.25) {
          if (lab && Math.abs(x - lx) < pw / 2 + lw + G) continue;
          const sc = (lab ? Math.min(Math.abs(x - lx), 50) : -Math.abs(x - L / 2)) - (y < h / 2 ? 100 : 0);
          if (!found || sc > found.sc) found = { x, y, sc };
        }
      }
      if (found) { offer(fs, at(found.x, found.y), ang, fs * 100 + 10, lab && lfs !== lab.fs ? { lab, pos: [lab.x, lab.y], fs: lfs } : null); return; }
      // 2. both numbers side by side low on the tab, near the fold line where it is widest:
      //    the piece number at one end, the edge number at the other
      if (lab) {
        const bh = Math.max(ph, lfs * 1.1), y = bh / 2 + 0.3, top = y + bh / 2;
        if (top > h - 0.1) continue;
        const lo = xmin(top) + 0.2, hi = xmax(top) - 0.2;
        if (hi - lo < pw + G + 2 * lw) continue;
        const pillLeft = lx >= L / 2; // the edge number stays on its own side
        const px = pillLeft ? lo + pw / 2 : hi - pw / 2;
        const free = pillLeft ? [lo + pw + G + lw, hi - lw] : [lo + lw, hi - pw - G - lw];
        const nx = Math.min(Math.max(lx, free[0]), free[1]);
        offer(fs, at(px, y), ang, fs * 100, { lab, pos: at(nx, y), fs: lfs });
        return;
      }
    }
  }
}
// rounded rectangle around (cx, cy), length w along angle ang (degrees), height h
function pillPts(cx, cy, w, h, ang) {
  const r = h / 2, s = Math.max(0, w / 2 - r), c = Math.cos(ang * Math.PI / 180), sn = Math.sin(ang * Math.PI / 180), out = [];
  const add = (x, y) => out.push([cx + c * x - sn * y, cy + sn * x + c * y]);
  for (let i = 0; i <= 8; i++) { const t = -Math.PI / 2 + Math.PI * i / 8; add(s + r * Math.cos(t), r * Math.sin(t)); }
  for (let i = 0; i <= 8; i++) { const t = Math.PI / 2 + Math.PI * i / 8; add(-s + r * Math.cos(t), r * Math.sin(t)); }
  return out;
}
function choosePieceNumPos(cands, labels, extra) {
  const st = S.set, k = font().k;
  const L = st.numbers ? labels.filter(l => l.fs >= 0.9).map(l => { const n = String(S.num[l.e] || 888).length, hw = n * k * l.fs / 2, hh = l.fs * 0.5; return { x: l.x, y: l.y, r: Math.hypot(hw, hh) + 0.2 }; }) : [];
  if (extra) L.push(...extra);
  let best = null;
  const minFs = Math.min(1.8, st.pieceNumSize);
  for (const c of cands) {
    const fsMax = Math.max(minFs, Math.min(st.pieceNumSize, c.inr * 1.25));
    // eerst op volle grootte, anders kleiner (tot de helft, minimaal 1,8 mm)
    for (const sc of [1, 0.8, 0.65, 0.5]) {
      const fs = Math.max(minFs, fsMax * sc);
      const r = Math.max(fs * 0.66, fs * k + fs * 0.28) + 0.3; // rondje voor 2 cijfers + speling
      let overlap = 0;
      for (const l of L) { const dd = Math.hypot(c.x - l.x, c.y - l.y); if (dd < r + l.r) overlap += r + l.r - dd; }
      const score = (overlap > 0 ? 1000 + overlap * 10 : 0) - fs;
      if (!best || score < best.score) best = { ...c, fs, score };
      if (fs <= minFs) break;
    }
  }
  return best;
}
function pieceOutline(p) { return Core.pieceOutlinePts(p, S.lmm, S.mesh, S.tl); }

function dominantColor(p) {
  if (!S.faceColor) return '';
  const cnt = new Map();
  for (const f of p.faces) { const k = S.faceColor[f].join(','); cnt.set(k, (cnt.get(k) || 0) + 1); }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Stukken zo dicht mogelijk op de pagina's leggen (echte vorm, met draaien)
function piecePolys(p) { return p.d.faces.map(f => f.pts).concat(p.d.tabs.map(t => t.poly)); }
// Pieces that share a cut edge in the model, with the length of that edge (for "Neighbours together").
function pieceNeighbours() {
  const m = S.mesh, cp = S.cp, w = cp.pieces.map(() => new Map());
  m.E.forEach((E, e) => {
    if (!E.m || S.joined[e]) return;
    const a = cp.pieceOf[E.f[0]], b = cp.pieceOf[E.f[1]]; if (a === b) return;
    w[a].set(b, (w[a].get(b) || 0) + E.len); w[b].set(a, (w[b].get(a) || 0) + E.len);
  });
  return w;
}
// Order for "Neighbours together": walk through the model from piece to neighbour (longest shared
// edge first), starting with the largest piece, so consecutive pieces belong together.
function neighbourOrder(list, w) {
  const inList = new Set(list.map(p => p.id)), seen = new Set(), order = [];
  const bySize = list.slice().sort((a, b) => b.faces.length - a.faces.length);
  for (const start of bySize) {
    if (seen.has(start.id)) continue;
    const stack = [start.id]; seen.add(start.id);
    while (stack.length) {
      const id = stack.pop(); order.push(id);
      const nb = [...w[id].entries()].filter(([q]) => inList.has(q) && !seen.has(q)).sort((x, y) => x[1] - y[1]);
      for (const [q] of nb) { seen.add(q); stack.push(q); } // longest shared edge is popped first
    }
  }
  return order;
}
// Arrange one group of pieces on pages, according to the chosen arrangement.
function nestGroup(items, list, W, H, budget, paper) {
  const mode = S.set.layoutMode || 'normal';
  const opt = { gap: S.set.pieceGap, obstacles: silObstacles(paper), cell: W * H > 80000 ? 1.5 : 1, angleStep: items.length > 80 ? 30 : 15 };
  if (mode === 'together') {
    const w = pieceNeighbours();
    return Core.nestLayout(items, W, H, { ...opt, order: neighbourOrder(list, w), near: new Map(list.map(p => [p.id, [...w[p.id].keys()]])) });
  }
  if (mode !== 'compact') return Core.nestLayout(items, W, H, opt);
  // fewest pages: try several orders and finer rotations within a time budget; keep the best
  const t0 = Date.now();
  const area = new Map(items.map(it => { let a = 0; for (const P of it.polys) { let s2 = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s2 += p[0] * q[1] - q[0] * p[1]; } a += Math.abs(s2) / 2; } return [it.id, a]; }));
  const span = new Map(items.map(it => { const b = Core.bbox(it.polys.flat()); return [it.id, Math.max(b[2] - b[0], b[3] - b[1])]; }));
  const ids = items.map(it => it.id);
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const orders = [
    ids.slice().sort((a, b) => area.get(b) - area.get(a)),
    ids.slice().sort((a, b) => span.get(b) - span.get(a)),
  ];
  // the normal arrangement first, so the result is never worse; then a finer raster (1 mm, which
  // packs noticeably tighter), finer angles and other orders, as long as there is time
  const first = Core.nestLayout(items, W, H, opt);
  let best = { ...first, score: first.pages + first.lastFill * 0.999, order: orders[0] };
  const fine = { ...opt, cell: 1, angleStep: 15 };
  let per = (Date.now() - t0) * (opt.cell === 1 ? 1 : 2.3); // a 1 mm raster takes about 2.3x longer
  const tries = [{ ...fine, order: orders[0] }, { ...fine, angleStep: 10, order: orders[0] }, { ...fine, order: orders[1] }];
  for (let k = 0; ; k++) {
    if (Date.now() - t0 + per > budget) break; // the next try would not fit in the time
    let o2 = tries[k];
    if (!o2) { // shake the best order found so far a little
      const order = best.order.slice();
      for (let i = 0; i < order.length - 1; i++) if (rnd() < 0.25) { const t = order[i]; order[i] = order[i + 1]; order[i + 1] = t; }
      o2 = { ...fine, order };
    }
    const t1 = Date.now();
    const r = Core.nestLayout(items, W, H, o2);
    per = Math.max(per * 0.5, Date.now() - t1);
    const order = o2.order;
    const score = r.pages + r.lastFill * 0.999;
    if (!best || score < best.score) best = { ...r, score, order };
    if (k > 40) break;
  }
  return best;
}
function autoLayout() {
  const mg = effMargin();
  const groups = new Map();
  for (const p of S.cp.pieces) { const k = S.set.groupColors ? dominantColor(p) : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  let base = 0, left = groups.size; S.pageLabels = [];
  const deadline = Date.now() + 10000; // "fewest pages": 10 seconds in total, shared by the colour groups
  for (const [key, list] of groups) {
    const items = list.map(p => ({ id: p.id, polys: piecePolys(p) }));
    const paper = key ? keyPaper(key) : S.set.paper, [W, H] = printable(paper);
    const r = nestGroup(items, list, W, H, Math.max(0, (deadline - Date.now()) / left--), paper);
    for (const pl of r.placements) {
      const p = S.cp.pieces[pl.id], o = pageOrigin(base + pl.page);
      p.rot = pl.deg; p.x = o[0] + mg + pl.x; p.y = o[1] + mg + pl.y;
    }
    for (let i = 0; i < r.pages; i++) S.pageLabels[base + i] = key;
    base += r.pages;
  }
  S.layoutPages = Math.max(1, base);
}

const rotPt = (p, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c * p[0] - s * p[1], s * p[0] + c * p[1]]; };
const toWorld = (p, q) => { const r = rotPt(q, p.rot); return [r[0] + p.x, r[1] + p.y]; };

function updateWorld() {
  const F = S.mesh.F.length;
  S.world = new Float64Array(F * 6);
  for (const p of S.cp.pieces) for (const f of p.faces) {
    const P = S.lmm[f];
    for (let i = 0; i < 3; i++) { const w = toWorld(p, P[i]); S.world[f * 6 + i * 2] = w[0]; S.world[f * 6 + i * 2 + 1] = w[1]; }
  }
  pageInfo();
}

// Pagina per stuk, binnen printbaar gebied?, overlap tussen stukken
function pageInfo() {
  const mg = effMargin();
  let maxPage = S.layoutPages - 1;
  const polys = [];
  for (const p of S.cp.pieces) {
    const pts = pieceOutline(p).map(q => toWorld(p, q));
    const bb = Core.bbox(pts);
    p.wbb = bb;
    const pg = pageAt((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2);
    p.page = pg;
    const [PW, PH] = pageDims(pg >= 0 ? pg : undefined), obst = silObstacles(pg >= 0 ? pg : undefined);
    const [x0, y0] = pg >= 0 ? pageOrigin(pg) : [0, 0];
    p.off = pg < 0 || bb[0] < x0 + mg - 0.01 || bb[2] > x0 + PW - mg + 0.01 || bb[1] < y0 + mg - 0.01 || bb[3] > y0 + PH - mg + 0.01;
    for (const ob of obst) {
      if (pg < 0) break;
      const R = [[x0 + mg + ob.x, y0 + mg + ob.y], [x0 + mg + ob.x + ob.w, y0 + mg + ob.y], [x0 + mg + ob.x + ob.w, y0 + mg + ob.y + ob.h], [x0 + mg + ob.x, y0 + mg + ob.y + ob.h]];
      const rb = Core.bbox(R);
      if (!Core.bbOver(bb, rb)) continue;
      const shapes = p.d.faces.map(f => f.pts).concat(p.d.tabs.map(t => t.poly)).map(P => P.map(q => toWorld(p, q)));
      if (shapes.some(P => Core.bbOver(Core.bbox(P), rb) && Core.polyOverlap(P, R))) p.off = true;
    }
    if (pg > maxPage) maxPage = pg;
    p.big = !Core.fitsRect(Core.hull(pts), PW - 2 * mg, PH - 2 * mg);
    p.hitOther = false;
    const pl = [];
    for (const fc of p.d.faces) pl.push(fc.pts.map(q => toWorld(p, q)));
    for (const t of p.d.tabs) pl.push(t.poly.map(q => toWorld(p, q)));
    polys.push(pl.map(P => ({ P, bb: Core.bbox(P) })));
  }
  const ps = S.cp.pieces;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    if (!Core.bbOver(ps[i].wbb, ps[j].wbb)) continue;
    let hit = false;
    for (const A of polys[i]) { if (!Core.bbOver(A.bb, ps[j].wbb)) continue; for (const B of polys[j]) if (Core.bbOver(A.bb, B.bb) && Core.polyOverlap(A.P, B.P)) { hit = true; break; } if (hit) break; }
    if (hit) { ps[i].hitOther = ps[j].hitOther = true; }
  }
  S.pageCount = Math.max(1, maxPage + 1);
  updateStatus();
}

function updateStatus() {
  const m = S.mesh, ps = S.cp.pieces;
  const cuts = m.E.filter((e, i) => e.m && !S.joined[i]).length;
  $('stats').textContent = tr('{f} triangles · {n} {pieces} · {p} {pages} · {c} glue edges · scale 1:{s} (model unit → mm)', { f: m.F.length, n: ps.length, pieces: pl(ps.length, 'piece', 'pieces'), p: S.pageCount, pages: pl(S.pageCount, 'page', 'pages'), c: cuts, s: fx(1 / S.scale) }) + (S.simplify ? tr(' · simplified from {n} triangles', { n: fmtN(S.fullCount) }) : '') + (S.cleanInfo && S.cleanInfo.removed + S.cleanInfo.flipped ? tr(' · {n} thin faces cleaned up', { n: S.cleanInfo.removed + S.cleanInfo.flipped }) : '');
  const w = [];
  const self = ps.filter(p => p.d.faces.some(f => f.bad)).length;
  const tabs = S.tl.conflicts.length;
  const off = ps.filter(p => p.off).length, big = ps.filter(p => p.big).length, hit = ps.filter(p => p.hitOther).length;
  if (self) w.push(tr('{n} piece(s) overlap themselves', { n: self }));
  if (tabs) w.push(tr('{n} glue tab(s) without room', { n: tabs }));
  if (big) w.push(tr('{n} piece(s) larger than the paper', { n: big }));
  else if (off) w.push(tr('{n} piece(s) outside the printable area', { n: off }));
  if (hit) w.push(tr('{n} pieces overlap each other', { n: hit }));
  $('warns').innerHTML = w.length ? `<span class="warn">⚠ ${w.join(' · ')}</span>` : `<span style="color:#16a34a">${tr('✓ everything fits')}</span>`;
}

