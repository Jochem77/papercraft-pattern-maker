// Papercraft Pattern Maker
// Copyright (C) 2026 Jochem Steenbakkers
// SPDX-License-Identifier: GPL-3.0-or-later
// Papercraft rekenkern: inlezen (STL/OBJ/GLB), mesh-opbouw, uitvouwen, plakstrookjes.
// Werkt zowel in de browser (window.Core) als in Node (module.exports) voor tests.
(function (root) {
'use strict';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------------------------------------------------------------- inlezen
function parseSTL(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === buf.byteLength) {
      const out = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(o + k * 4, true);
      }
      return { pos: out };
    }
  }
  const text = new TextDecoder().decode(buf);
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  const arr = []; let m;
  while ((m = re.exec(text))) arr.push(+m[1], +m[2], +m[3]);
  if (!arr.length || arr.length % 9) throw new Error('Not a valid STL file');
  return { pos: new Float32Array(arr) };
}

function parseOBJ(text) {
  const v = [], out = [], mat = [], matNames = [];
  let cur = -1;
  for (const raw of text.split(/\r?\n/)) {
    const p = raw.trim().split(/\s+/);
    if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'usemtl') { cur = matNames.indexOf(p[1]); if (cur < 0) { cur = matNames.length; matNames.push(p[1]); } }
    else if (p[0] === 'f') {
      const idx = p.slice(1).map(s => { const i = parseInt(s.split('/')[0], 10); return i < 0 ? v.length + i : i - 1; });
      for (let k = 1; k + 1 < idx.length; k++) {
        for (const j of [idx[0], idx[k], idx[k + 1]]) out.push(v[j][0], v[j][1], v[j][2]);
        mat.push(Math.max(cur, 0));
      }
    }
  }
  if (!out.length) throw new Error('No faces found in OBJ');
  // OBJ is meestal Y-omhoog
  const pos = yUpToZUp(new Float32Array(out));
  const res = { pos };
  if (matNames.length > 1) {
    res.faceMat = Int32Array.from(mat);
    res.materials = matNames.map((n, i) => ({ name: n, color: defaultPalette(i) }));
  }
  return res;
}

function yUpToZUp(pos) {
  for (let i = 0; i < pos.length; i += 3) { const y = pos[i + 1], z = pos[i + 2]; pos[i + 1] = -z; pos[i + 2] = y; }
  return pos;
}

function defaultPalette(i) {
  const h = (i * 0.618034) % 1;
  return hslToRgb(h, 0.5, 0.65);
}
function hslToRgb(h, s, l) {
  const f = n => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
const linToSrgb = c => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));

// GLB (binaire glTF 2.0). Geeft posities, materiaal per driehoek, kleuren en evt. textuur-info.
function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Not a valid GLB file');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const clen = dv.getUint32(off, true), ctype = dv.getUint32(off + 4, true);
    const data = buf.slice(off + 8, off + 8 + clen);
    if (ctype === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data));
    else if (ctype === 0x004E4942) bin = data;
    off += 8 + clen;
  }
  if (!json) throw new Error('GLB without JSON chunk');
  const views = json.bufferViews || [], accs = json.accessors || [];
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const CS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  function readAcc(i) {
    const a = accs[i], nc = NC[a.type], cs = CS[a.componentType];
    const out = new Float64Array(a.count * nc);
    if (a.bufferView === undefined) return out;
    const bv = views[a.bufferView];
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || nc * cs;
    const d = new DataView(bin);
    const rd = {
      5120: o => d.getInt8(o), 5121: o => d.getUint8(o), 5122: o => d.getInt16(o, true),
      5123: o => d.getUint16(o, true), 5125: o => d.getUint32(o, true), 5126: o => d.getFloat32(o, true)
    }[a.componentType];
    const norm = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] : 0;
    for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) {
      let v = rd(base + k * stride + c * cs);
      if (norm) v = Math.max(v / norm, -1);
      out[k * nc + c] = v;
    }
    return out;
  }
  const mats = (json.materials || []).map((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    const f = pbr.baseColorFactor || [1, 1, 1, 1];
    const tex = pbr.baseColorTexture ? pbr.baseColorTexture.index : undefined;
    return { name: m.name || ('Material ' + (i + 1)), color: [linToSrgb(f[0]), linToSrgb(f[1]), linToSrgb(f[2])], factor: f, texture: tex };
  });
  // node-matrices
  const mul = (A, B) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += A[k * 4 + i] * B[j * 4 + k]; return r; };
  const nodeMat = n => {
    if (n.matrix) return n.matrix.slice();
    const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
    const [x, y, z, w] = q;
    const R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
      2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
      2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) R[c * 4 + r] *= s[c];
    R[12] = t[0]; R[13] = t[1]; R[14] = t[2];
    return R;
  };
  const pos = [], fmat = [], uvs = [];
  let hasMissingMat = false;
  function visit(ni, parent) {
    const n = json.nodes[ni];
    const M = mul(parent, nodeMat(n));
    if (n.mesh !== undefined) {
      for (const pr of json.meshes[n.mesh].primitives) {
        const mode = pr.mode === undefined ? 4 : pr.mode;
        if (mode < 4) continue;
        const P = readAcc(pr.attributes.POSITION);
        const UV = pr.attributes.TEXCOORD_0 !== undefined ? readAcc(pr.attributes.TEXCOORD_0) : null;
        const nv = P.length / 3;
        let I = pr.indices !== undefined ? Array.from(readAcc(pr.indices)) : Array.from({ length: nv }, (_, i) => i);
        let tris = [];
        if (mode === 4) for (let i = 0; i + 2 < I.length; i += 3) tris.push([I[i], I[i + 1], I[i + 2]]);
        else if (mode === 5) for (let i = 0; i + 2 < I.length; i++) tris.push(i % 2 ? [I[i + 1], I[i], I[i + 2]] : [I[i], I[i + 1], I[i + 2]]);
        else if (mode === 6) for (let i = 1; i + 1 < I.length; i++) tris.push([I[0], I[i], I[i + 1]]);
        let mi = pr.material;
        if (mi === undefined) { hasMissingMat = true; mi = -1; }
        for (const t of tris) {
          for (const v of t) {
            const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
            pos.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
          }
          fmat.push(mi);
          if (UV) { let u = 0, w = 0; for (const v of t) { u += UV[v * 2]; w += UV[v * 2 + 1]; } uvs.push(u / 3, w / 3); } else uvs.push(NaN, NaN);
        }
      }
    }
    for (const c of n.children || []) visit(c, M);
  }
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const scene = json.scenes ? json.scenes[json.scene || 0] : { nodes: json.nodes.map((_, i) => i) };
  for (const ni of scene.nodes) visit(ni, I4);
  if (!pos.length) throw new Error('No triangles in GLB');
  if (hasMissingMat) { mats.push({ name: 'Default', color: [230, 230, 230], factor: [1, 1, 1, 1] }); }
  const faceMat = Int32Array.from(fmat.map(m => m < 0 ? mats.length - 1 : m));
  // textuur-afbeeldingen (worden in de browser gedecodeerd)
  const images = (json.images || []).map(im => {
    if (im.bufferView === undefined) return null;
    const bv = views[im.bufferView];
    return { mime: im.mimeType || 'image/png', data: bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength) };
  });
  const textures = (json.textures || []).map(t => t.source);
  return { pos: yUpToZUp(new Float32Array(pos)), faceMat, materials: mats, faceUV: Float32Array.from(uvs), images, textures };
}

function parseModel(buf, name) {
  if (/\.glb$/i.test(name)) return parseGLB(buf);
  if (/\.obj$/i.test(name)) return parseOBJ(new TextDecoder().decode(buf));
  return parseSTL(buf);
}

// ---------------------------------------------------------------- mesh
function buildMesh(pos, flatDeg) {
  const n = Math.floor(pos.length / 9);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 9; i += 3) for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  const size = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const diag = len(size) || 1, q = diag * 1e-6;
  const V = [], vmap = new Map(), F = [], src = [], fset = new Set();
  const vid = (x, y, z) => {
    const k = Math.round(x / q) + ',' + Math.round(y / q) + ',' + Math.round(z / q);
    let i = vmap.get(k);
    if (i === undefined) { i = V.length; V.push([x, y, z]); vmap.set(k, i); }
    return i;
  };
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const a = vid(pos[o], pos[o + 1], pos[o + 2]), b = vid(pos[o + 3], pos[o + 4], pos[o + 5]), c = vid(pos[o + 6], pos[o + 7], pos[o + 8]);
    if (a === b || b === c || a === c) continue;
    if (len(cross(sub(V[b], V[a]), sub(V[c], V[a]))) < diag * diag * 1e-10) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (fset.has(key)) continue;
    fset.add(key);
    F.push([a, b, c]); src.push(t);
  }
  const E = [], emap = new Map(), FE = F.map(() => [0, 0, 0]);
  F.forEach((f, fi) => {
    for (let i = 0; i < 3; i++) {
      const a = f[i], b = f[(i + 1) % 3];
      const k = a < b ? a + '_' + b : b + '_' + a;
      let e = emap.get(k);
      if (e === undefined) { e = E.length; E.push({ v: a < b ? [a, b] : [b, a], f: [] }); emap.set(k, e); }
      E[e].f.push(fi); FE[fi][i] = e;
    }
  });
  const mesh = { V, F, E, FE, mn, mx, size, diag, src };
  orient(mesh);
  edgeProps(mesh);
  setFlat(mesh, flatDeg == null ? 1 : flatDeg);
  return mesh;
}

function flipFace(m, g) {
  const f = m.F[g]; const t = f[1]; f[1] = f[2]; f[2] = t;
  const fe = m.FE[g]; m.FE[g] = [fe[2], fe[1], fe[0]];
}

// Maak de oriëntatie van alle driehoeken consistent en naar buiten gericht.
function orient(m) {
  const { F, E, FE, V } = m;
  const vis = new Uint8Array(F.length);
  for (let s = 0; s < F.length; s++) {
    if (vis[s]) continue;
    vis[s] = 1;
    const comp = [s];
    for (let qi = 0; qi < comp.length; qi++) {
      const f = comp[qi];
      for (let i = 0; i < 3; i++) {
        const e = E[FE[f][i]];
        if (e.f.length !== 2) continue;
        const g = e.f[0] === f ? e.f[1] : e.f[0];
        if (vis[g]) continue;
        const a = F[f][i], b = F[f][(i + 1) % 3], G = F[g];
        for (let j = 0; j < 3; j++) if (G[j] === a && G[(j + 1) % 3] === b) { flipFace(m, g); break; }
        vis[g] = 1; comp.push(g);
      }
    }
    const c = [0, 0, 0]; let cnt = 0;
    for (const f of comp) for (const v of F[f]) { c[0] += V[v][0]; c[1] += V[v][1]; c[2] += V[v][2]; cnt++; }
    c[0] /= cnt; c[1] /= cnt; c[2] /= cnt;
    let vol = 0;
    for (const f of comp) vol += dot(sub(V[F[f][0]], c), cross(sub(V[F[f][1]], c), sub(V[F[f][2]], c)));
    if (vol < 0) for (const f of comp) flipFace(m, f);
  }
}

function edgeProps(m) {
  const { V, F, E } = m;
  m.N = F.map(f => { const n = cross(sub(V[f[1]], V[f[0]]), sub(V[f[2]], V[f[0]])); const l = len(n) || 1; return [n[0] / l, n[1] / l, n[2] / l]; });
  for (const e of E) {
    e.len = len(sub(V[e.v[1]], V[e.v[0]]));
    e.m = false; e.bend = 0; e.convex = true;
    if (e.f.length !== 2) continue;
    const [f, g] = e.f, [a, b] = e.v;
    const dir = fi => { const T = F[fi]; for (let j = 0; j < 3; j++) { if (T[j] === a && T[(j + 1) % 3] === b) return 1; if (T[j] === b && T[(j + 1) % 3] === a) return -1; } return 0; };
    if (dir(f) === dir(g)) continue; // niet-oriënteerbaar: behandel als open rand
    e.m = true;
    e.bend = Math.acos(Math.max(-1, Math.min(1, dot(m.N[f], m.N[g]))));
    const c = F[g].find(v => v !== a && v !== b);
    e.convex = dot(m.N[f], sub(V[c], V[a])) <= 0;
  }
}

function setFlat(m, deg) {
  const t = deg * Math.PI / 180;
  for (const e of m.E) e.flat = e.m && e.bend < t;
}

const otherFace = (e, f) => e.f[0] === f ? e.f[1] : e.f[0];

// Leg driehoek f plat: hoekpunt i op p0, hoekpunt i+1 op p1. Buitenkant naar de kijker (y-as omlaag, zoals SVG).
function placeTriangle(m, f, i, p0, p1) {
  const T = m.F[f], V = m.V;
  const A = V[T[i]], B = V[T[(i + 1) % 3]], C = V[T[(i + 2) % 3]];
  const ab = sub(B, A), ac = sub(C, A), L = len(ab);
  const t = dot(ac, ab) / L, h = len(cross(ab, ac)) / L;
  let ux = p1[0] - p0[0], uy = p1[1] - p0[1];
  const l2 = Math.hypot(ux, uy); ux /= l2; uy /= l2;
  const out = [];
  out[i] = [p0[0], p0[1]];
  out[(i + 1) % 3] = [p1[0], p1[1]];
  out[(i + 2) % 3] = [p0[0] + t * ux + h * uy, p0[1] + t * uy - h * ux];
  return out;
}

// Stukken bepalen uit de verbonden randen. Ook boom (parent) bijhouden voor reparaties.
function computePieces(m, joined) {
  const nF = m.F.length;
  const pieceOf = new Int32Array(nF).fill(-1), local = new Array(nF), parentEdge = new Int32Array(nF).fill(-1);
  const isTree = new Uint8Array(m.E.length);
  const pieces = [];
  for (let r = 0; r < nF; r++) {
    if (pieceOf[r] >= 0) continue;
    const pid = pieces.length, faces = [r];
    pieceOf[r] = pid;
    const T = m.F[r];
    local[r] = placeTriangle(m, r, 0, [0, 0], [len(sub(m.V[T[1]], m.V[T[0]])), 0]);
    for (let qi = 0; qi < faces.length; qi++) {
      const f = faces[qi];
      for (let i = 0; i < 3; i++) {
        const e = m.FE[f][i], E = m.E[e];
        if (!joined[e] || !E.m) continue;
        const g = otherFace(E, f);
        if (pieceOf[g] >= 0) continue;
        const a = m.F[f][i], b = m.F[f][(i + 1) % 3], G = m.F[g];
        let j = 0; while (!(G[j] === b && G[(j + 1) % 3] === a)) j++;
        local[g] = placeTriangle(m, g, j, local[f][(i + 1) % 3], local[f][i]);
        pieceOf[g] = pid; parentEdge[g] = e; isTree[e] = 1;
        faces.push(g);
      }
    }
    pieces.push({ id: pid, root: r, faces });
  }
  const tol = m.diag * 1e-5, bad = [];
  m.E.forEach((E, e) => {
    if (!joined[e] || !E.m || isTree[e]) return;
    const [f, g] = E.f;
    const ok = E.v.every(v => dist2(local[f][m.F[f].indexOf(v)], local[g][m.F[g].indexOf(v)]) < tol);
    if (!ok) bad.push(e);
  });
  return { pieces, pieceOf, local, parentEdge, bad };
}

// ---------------------------------------------------------------- 2D-geometrie
function bbox(P) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of P) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; }
  return [a, b, c, d];
}
const bbOver = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

function shrinkPoly(P, k) {
  let cx = 0, cy = 0;
  for (const p of P) { cx += p[0]; cy += p[1]; }
  cx /= P.length; cy /= P.length;
  return P.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
}
function sepAxes(P, Q) {
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const nx = a[1] - b[1], ny = b[0] - a[0];
    let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const p of P) { const d = p[0] * nx + p[1] * ny; if (d < p0) p0 = d; if (d > p1) p1 = d; }
    for (const p of Q) { const d = p[0] * nx + p[1] * ny; if (d < q0) q0 = d; if (d > q1) q1 = d; }
    if (p1 <= q0 || q1 <= p0) return true;
  }
  return false;
}
// Overlappen twee convexe polygonen (raken telt niet)?
function polyOverlap(P, Q) {
  const A = shrinkPoly(P, 0.998), B = shrinkPoly(Q, 0.998);
  return !sepAxes(A, B) && !sepAxes(B, A);
}

function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

function rotBox(H, deg) {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  let a = Infinity, b = Infinity, cc = -Infinity, d = -Infinity;
  for (const p of H) { const x = c * p[0] - s * p[1], y = s * p[0] + c * p[1]; if (x < a) a = x; if (y < b) b = y; if (x > cc) cc = x; if (y > d) d = y; }
  return { minx: a, miny: b, w: cc - a, h: d - b };
}

function fitsRect(H, W, Hh) {
  if (!isFinite(W)) return true;
  for (let deg = 0; deg < 180; deg += 2) { const b = rotBox(H, deg); if (b.w <= W && b.h <= Hh) return true; }
  return false;
}

// Beste draaiing om in W×H te passen (kleinste omhullende rechthoek, liefst liggend).
function bestRotation(pts, W, Hh) {
  const H = hull(pts);
  let best = null;
  for (let deg = 0; deg < 180; deg += 1) {
    const b = rotBox(H, deg);
    const fits = b.w <= W + 1e-9 && b.h <= Hh + 1e-9;
    const score = (fits ? 0 : 1e12) + b.w * b.h * (1 + 0.02 * (b.h > b.w ? 1 : 0));
    if (!best || score < best.score) best = { deg, score, fits, ...b };
  }
  return best;
}

// Trapeziumvormige plakstrook op rand a→b (vlak ligt rechts van a→b, strook links).
function tabPoly(a, b, h, angDeg) {
  let ux = b[0] - a[0], uy = b[1] - a[1];
  const l = Math.hypot(ux, uy); ux /= l; uy /= l;
  const ox = -uy, oy = ux;
  const ta = Math.tan(Math.max(5, Math.min(89.9, angDeg)) * Math.PI / 180);
  let d = h / ta;
  if (2 * d > 0.9 * l) { d = 0.45 * l; h = Math.min(h, d * ta); }
  return {
    h,
    poly: [[a[0], a[1]], [a[0] + ox * h + ux * d, a[1] + oy * h + uy * d], [b[0] + ox * h - ux * d, b[1] + oy * h - uy * d], [b[0], b[1]]]
  };
}

// ---------------------------------------------------------------- automatisch uitvouwen
// Gulzig: verbind randen (vlak eerst, dan kleinste knik, dan langste) zolang er geen overlap ontstaat
// en het stuk op het papier past. opts: {maxW, maxH (in mesh-eenheden), avoid: Uint8Array randen niet verbinden}
function autoUnfold(m, opts) {
  const { F, E, V } = m, nF = F.length;
  const maxW = opts.maxW, maxH = opts.maxH, avoid = opts.avoid;
  const local = new Array(nF), pieceOf = new Int32Array(nF), members = [], hulls = [], fb = new Array(nF);
  for (let f = 0; f < nF; f++) {
    local[f] = placeTriangle(m, f, 0, [0, 0], [len(sub(V[F[f][1]], V[F[f][0]])), 0]);
    pieceOf[f] = f; members[f] = [f]; hulls[f] = local[f].map(p => p.slice()); fb[f] = bbox(local[f]);
  }
  const joined = new Uint8Array(E.length);
  const deg = Math.PI / 180;
  const order = [];
  E.forEach((e, i) => { if (e.m && !(avoid && avoid[i])) order.push(i); });
  if (opts.order) { order.length = 0; for (const i of opts.order) if (E[i].m && !(avoid && avoid[i])) order.push(i); } else order.sort((a, b) => {
    const A = E[a], B = E[b];
    if (A.flat !== B.flat) return A.flat ? -1 : 1;
    const da = Math.round(A.bend / deg / 3), db = Math.round(B.bend / deg / 3);
    if (da !== db) return da - db;
    return B.len - A.len;
  });
  const tol = m.diag * 1e-5;
  for (const ei of order) {
    const e = E[ei], [f, g] = e.f, [a, b] = e.v;
    const fa = local[f][F[f].indexOf(a)], fbb = local[f][F[f].indexOf(b)];
    const ga = local[g][F[g].indexOf(a)], gb = local[g][F[g].indexOf(b)];
    const P = pieceOf[f], Q = pieceOf[g];
    if (P === Q) { if (dist2(fa, ga) < tol && dist2(fbb, gb) < tol) joined[ei] = 1; continue; }
    let big = P, small = Q, ba = fa, bb = fbb, sa = ga, sb = gb;
    if (members[Q].length > members[P].length) { big = Q; small = P; ba = ga; bb = gb; sa = fa; sb = fbb; }
    const ang = Math.atan2(bb[1] - ba[1], bb[0] - ba[0]) - Math.atan2(sb[1] - sa[1], sb[0] - sa[0]);
    const c = Math.cos(ang), s = Math.sin(ang);
    const tx = ba[0] - (c * sa[0] - s * sa[1]), ty = ba[1] - (s * sa[0] + c * sa[1]);
    const T = p => [c * p[0] - s * p[1] + tx, s * p[0] + c * p[1] + ty];
    const hs = hulls[small].map(T);
    const H = hull(hulls[big].concat(hs));
    if (!fitsRect(H, maxW, maxH)) continue;
    const newLocal = members[small].map(fi => local[fi].map(T));
    const newBB = newLocal.map(bbox);
    const sbb = bbox(hs);
    let bad = false;
    outer: for (const fi of members[big]) {
      const B1 = fb[fi];
      if (!bbOver(B1, sbb)) continue;
      for (let k = 0; k < newLocal.length; k++) {
        if (!bbOver(B1, newBB[k])) continue;
        if (polyOverlap(local[fi], newLocal[k])) { bad = true; break outer; }
      }
    }
    if (bad) continue;
    if (opts.validate) { joined[ei] = 1; const ok = opts.validate(joined, f); joined[ei] = 0; if (!ok) continue; }
    members[small].forEach((fi, k) => { local[fi] = newLocal[k]; fb[fi] = newBB[k]; pieceOf[fi] = big; });
    members[big] = members[big].concat(members[small]); members[small] = null;
    hulls[big] = H; hulls[small] = null;
    joined[ei] = 1;
  }
  return joined;
}

// Groeistrategie: laat één stuk tegelijk zo groot mogelijk groeien vanaf een startvlak.
function growUnfold(m, opts) {
  const { F, E, V } = m, nF = F.length;
  const maxW = opts.maxW, maxH = opts.maxH, avoid = opts.avoid;
  const w = opts.weights || E.map(e => (e.flat ? -10 : 0) + e.bend - 0.05 * e.len / m.diag);
  const joined = new Uint8Array(E.length);
  const assigned = new Int32Array(nF).fill(-1);
  const area = F.map(f => len(cross(sub(V[f[1]], V[f[0]]), sub(V[f[2]], V[f[0]]))));
  const seeds = F.map((_, i) => i).sort(opts.seedOrder || ((a, b) => area[b] - area[a]));
  const tol = m.diag * 1e-5;
  let pid = 0;
  for (const seed of seeds) {
    if (assigned[seed] >= 0) continue;
    const local = new Map(), fbb = new Map(), faces = [seed];
    const T0 = F[seed];
    local.set(seed, placeTriangle(m, seed, 0, [0, 0], [len(sub(V[T0[1]], V[T0[0]])), 0]));
    fbb.set(seed, bbox(local.get(seed)));
    assigned[seed] = pid;
    let H = local.get(seed).map(p => p.slice());
    const front = [];
    const pushEdges = f => { for (let i = 0; i < 3; i++) { const e = m.FE[f][i]; if (E[e].m && !(avoid && avoid[e]) && assigned[otherFace(E[e], f)] < 0) front.push({ e, f, i }); } };
    pushEdges(seed);
    while (front.length) {
      let bi = 0;
      for (let k = 1; k < front.length; k++) if (w[front[k].e] < w[front[bi].e]) bi = k;
      const { e, f, i } = front[bi];
      front[bi] = front[front.length - 1]; front.pop();
      const g = otherFace(E[e], f);
      if (assigned[g] >= 0) continue;
      const a = F[f][i], b = F[f][(i + 1) % 3], G = F[g];
      let j = 0; while (!(G[j] === b && G[(j + 1) % 3] === a)) j++;
      const lf = local.get(f);
      const tri = placeTriangle(m, g, j, lf[(i + 1) % 3], lf[i]);
      const Hn = hull(H.concat([tri[(j + 2) % 3]]));
      if (!fitsRect(Hn, maxW, maxH)) continue;
      const bb = bbox(tri);
      let hit = false;
      for (const q of faces) if (bbOver(bb, fbb.get(q)) && polyOverlap(tri, local.get(q))) { hit = true; break; }
      if (hit) continue;
      local.set(g, tri); fbb.set(g, bb); faces.push(g); assigned[g] = pid; H = Hn;
      joined[e] = 1;
      pushEdges(g);
    }
    // samenvallende randen binnen het stuk ook verbinden
    for (const f of faces) for (const e of m.FE[f]) {
      const Ee = E[e]; if (!Ee.m || joined[e]) continue;
      const g = otherFace(Ee, f); if (assigned[g] !== pid) continue;
      if (Ee.v.every(v => dist2(local.get(f)[F[f].indexOf(v)], local.get(g)[F[g].indexOf(v)]) < tol)) joined[e] = 1;
    }
    pid++;
  }
  return joined;
}

// ---------------------------------------------------------------- plakstrookjes & controle
// Probeervolgorde voor een strook: [hoogtefactor, hoek]. Als laatste redmiddel een spitsere strook.
function tabSteps(o) {
  const a = o.tabAngle, s = [[1, a], [0.8, a], [o.minTab, a]];
  if (o.autoAngle !== false && a > 30) s.push([o.minTab, 30]);
  return s;
}

// Bepaalt per knip-rand aan welke kant de strook komt, zo nodig kleiner, en meldt problemen.
// lmm: lokale coördinaten in mm per vlak. opts: {tabH, tabAngle, minTab (fractie), tabUser}
function layoutTabs(m, cp, lmm, joined, opts) {
  const { pieces, pieceOf } = cp;
  const nE = m.E.length;
  const tabFace = new Int32Array(nE).fill(-1), tabs = new Array(nE), tabIdx = new Int32Array(nE).fill(-1);
  const fbb = lmm.map(bbox);
  const placed = pieces.map(() => []); // per stuk: {poly, bb, e}
  const conflicts = []; // {e, f, withFace | withTab}
  const facesOf = pieces.map(p => p.faces);
  const tryTab = (e, f, st) => {
    const i = m.FE[f].indexOf(e), P = lmm[f];
    const t = tabPoly(P[i], P[(i + 1) % 3], opts.tabH * st[0], st[1]);
    const bb = bbox(t.poly), pid = pieceOf[f];
    // vlakken van het eigen stuk
    for (const g of facesOf[pid]) {
      if (g === f || !bbOver(bb, fbb[g])) continue;
      if (polyOverlap(t.poly, lmm[g])) return { ok: false, t, hitFace: g };
    }
    for (const o of placed[pid]) {
      if (!bbOver(bb, o.bb)) continue;
      if (polyOverlap(t.poly, o.poly)) return { ok: false, t, hitTab: o.e, hitFace: o.f };
    }
    return { ok: true, t, bb };
  };
  // langste randen eerst
  const cut = [];
  m.E.forEach((E, e) => { if (E.m && !joined[e]) cut.push(e); });
  cut.sort((a, b) => m.E[b].len - m.E[a].len);
  const steps = tabSteps(opts);
  for (const e of cut) {
    const E = m.E[e];
    const user = opts.tabUser ? opts.tabUser[e] : -1;
    const sides = user >= 0 ? [user, 1 - user] : [0, 1];
    let res = null, side = -1, fail = null;
    for (const sc of steps) {
      for (const s of (user >= 0 ? [user] : sides)) {
        const r = tryTab(e, E.f[s], sc);
        if (r.ok) { res = r; side = s; break; }
        if (!fail) fail = { ...r, f: E.f[s] };
      }
      if (res) break;
    }
    if (!res) {
      // geen plek: toch plaatsen (volle maat) op de gekozen kant, en melden
      side = sides[0];
      const f = E.f[side];
      const r = tryTab(e, f, steps[0]);
      res = { t: r.t, bb: bbox(r.t.poly) };
      conflicts.push({ e, f, hitFace: r.hitFace !== undefined ? r.hitFace : (fail && fail.hitFace), hitTab: r.hitTab });
    }
    const f = E.f[side];
    tabFace[e] = f;
    tabs[e] = { poly: res.t.poly, h: res.t.h, bad: false };
    placed[pieceOf[f]].push({ poly: res.t.poly, bb: res.bb, e, f });
  }
  for (const c of conflicts) tabs[c.e].bad = true;
  // opts.both: also a flap on the other side of every cut edge (for "tab and flap" without glue:
  // the tab hooks into a slit in that flap). Only where it fits; otherwise tabs2[e] stays empty
  // and the edge gets a normal glue tab. The unfolding itself does not change.
  let tabs2 = null;
  if (opts.both) {
    tabs2 = new Array(nE).fill(null);
    for (const e of cut) {
      if (!tabs[e] || tabs[e].bad) continue;
      const E = m.E[e], f2 = E.f[0] === tabFace[e] ? E.f[1] : E.f[0];
      for (const sc of steps) {
        const r = tryTab(e, f2, sc);
        if (r.ok) { tabs2[e] = { poly: r.t.poly, h: r.t.h, f: f2 }; placed[pieceOf[f2]].push({ poly: r.t.poly, bb: r.bb, e, f: f2 }); break; }
      }
    }
  }
  return { tabFace, tabs, conflicts, tabs2 };
}

// Number of faces of a piece as you see them: triangles joined by a flat edge count once.
function pieceFaceCount(m, joined, faces) {
  const inP = new Set(faces), par = new Map(faces.map(f => [f, f]));
  const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  let n = faces.length;
  for (const f of faces) for (const e of m.FE[f]) {
    const E = m.E[e]; if (!E.m || !E.flat || !joined[e]) continue;
    const g = E.f[0] === f ? E.f[1] : E.f[0]; if (!inP.has(g)) continue;
    const a = find(f), b = find(g); if (a !== b) { par.set(a, b); n--; }
  }
  return n;
}

// Overlap van vlakken binnen een stuk.
function selfOverlaps(cp, lmm) {
  const bad = new Set(), pairs = [];
  const fbb = lmm.map(bbox);
  for (const p of cp.pieces) {
    const F = p.faces;
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
      const a = F[i], b = F[j];
      if (!bbOver(fbb[a], fbb[b])) continue;
      if (polyOverlap(lmm[a], lmm[b])) { bad.add(a); bad.add(b); pairs.push([a, b]); }
    }
  }
  return { bad, pairs };
}

// Pad in de boom tussen twee vlakken van hetzelfde stuk → lijst van randen.
function treePath(cp, m, a, b) {
  const up = f => { const e = cp.parentEdge[f]; return e < 0 ? -1 : otherFace(m.E[e], f); };
  const anc = new Map(); let x = a, d = 0;
  while (x >= 0) { anc.set(x, d++); x = up(x); }
  const pathB = []; x = b;
  while (!anc.has(x)) { pathB.push(cp.parentEdge[x]); x = up(x); }
  const lca = x, pathA = []; x = a;
  while (x !== lca) { pathA.push(cp.parentEdge[x]); x = up(x); }
  return pathA.concat(pathB.reverse());
}

// Grootte van elke deelboom (vlakken staan in BFS-volgorde).
function subtreeSizes(cp, m, piece) {
  const size = new Map();
  for (let i = piece.faces.length - 1; i >= 0; i--) {
    const f = piece.faces[i];
    size.set(f, (size.get(f) || 0) + 1);
    const e = cp.parentEdge[f];
    if (e >= 0) { const p = otherFace(m.E[e], f); size.set(p, (size.get(p) || 0) + size.get(f)); }
  }
  return size;
}
const childOf = (cp, m, e) => cp.parentEdge[m.E[e].f[0]] === e ? m.E[e].f[0] : m.E[e].f[1];

// Kies een boomrand om een te groot stuk ongeveer doormidden te knippen.
function splitEdge(cp, m, piece) {
  const size = subtreeSizes(cp, m, piece), N = piece.faces.length;
  let best = -1, bd = Infinity;
  for (const f of piece.faces) {
    const e = cp.parentEdge[f]; if (e < 0) continue;
    const d = Math.abs(size.get(f) - N / 2);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Kies op een pad de rand die het kleinste deel afknipt.
function smallestCutOnPath(cp, m, piece, path) {
  const size = subtreeSizes(cp, m, piece), N = piece.faces.length;
  let best = -1, bc = Infinity;
  for (const e of path) {
    const s = size.get(childOf(cp, m, e));
    const c = Math.min(s, N - s) + (m.E[e].flat ? 0.5 : 0);
    if (c < bc) { bc = c; best = e; }
  }
  return best;
}

// Controleer één stuk (de component van 'seed'): geen overlap, past op papier, strookjes passen.
// Met 'info' worden alle conflicten verzameld (info.conflicts: vlakken, info.parent: boom, info.faces).
function validateComponent(m, joined, seed, o, info) {
  const local = new Map(), faces = [seed], tree = new Set(), parent = new Map();
  const T0 = m.F[seed];
  local.set(seed, placeTriangle(m, seed, 0, [0, 0], [len(sub(m.V[T0[1]], m.V[T0[0]])), 0]));
  for (let qi = 0; qi < faces.length; qi++) {
    const f = faces[qi];
    for (let i = 0; i < 3; i++) {
      const e = m.FE[f][i], E = m.E[e];
      if (!joined[e] || !E.m) continue;
      const g = otherFace(E, f);
      if (local.has(g)) continue;
      const a = m.F[f][i], b = m.F[f][(i + 1) % 3], G = m.F[g];
      let j = 0; while (!(G[j] === b && G[(j + 1) % 3] === a)) j++;
      const lf = local.get(f);
      local.set(g, placeTriangle(m, g, j, lf[(i + 1) % 3], lf[i]));
      tree.add(e); faces.push(g); parent.set(g, [f, e]);
    }
  }
  let ok = true;
  const conf = info ? new Set() : null;
  if (info) { info.faces = faces; info.parent = parent; info.conflicts = conf; info.tooBig = false; info.ring = false; }
  // o.maxFaces: at most this many faces per piece. Triangles joined by a flat edge form one face
  // (a square of two triangles counts once), so: triangles minus flat edges in the tree.
  if (o.maxFaces > 0 && faces.length > o.maxFaces) {
    let flatTree = 0;
    for (const e of tree) if (m.E[e].flat) flatTree++;
    if (faces.length - flatTree > o.maxFaces) { if (info) info.tooBig = true; return false; }
  }
  // o.isoMax: reject long, ragged pieces. Compactness = outline² / (4π · area): 1 for a disc,
  // about 4 for a 1:10 strip. Small pieces are always fine.
  // (not while cleaning up tiny pieces, which is checked with info: a tiny loose piece is worse)
  if (o.isoMax && !info && faces.length > 4) {
    let per = 0, A = 0;
    for (const f of faces) {
      const T = m.F[f]; A += len(cross(sub(m.V[T[1]], m.V[T[0]]), sub(m.V[T[2]], m.V[T[0]]))) / 2;
      for (const e of m.FE[f]) if (!m.E[e].m || !joined[e]) per += m.E[e].len;
    }
    if (per * per / (4 * Math.PI * A) > o.isoMax) return false;
  }
  const tol = m.diag * 1e-5;
  for (const f of faces) for (const e of m.FE[f]) {
    const E = m.E[e];
    if (!joined[e] || !E.m || tree.has(e)) continue;
    const g = otherFace(E, f);
    if (!E.v.every(v => dist2(local.get(f)[m.F[f].indexOf(v)], local.get(g)[m.F[g].indexOf(v)]) < tol)) { if (!info) return false; info.ring = true; ok = false; }
  }
  const L = new Map();
  for (const f of faces) L.set(f, local.get(f).map(p => [p[0] * o.scale, p[1] * o.scale]));
  const items = faces.map(f => ({ f, bb: bbox(L.get(f)) })).sort((a, b) => a.bb[0] - b.bb[0]);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length && items[j].bb[0] < items[i].bb[2]; j++) {
      if (bbOver(items[i].bb, items[j].bb) && polyOverlap(L.get(items[i].f), L.get(items[j].f))) {
        if (!info) return false;
        ok = false; conf.add(items[i].f); conf.add(items[j].f);
      }
    }
  }
  const cut = new Set();
  for (const f of faces) for (const e of m.FE[f]) if (m.E[e].m && !joined[e]) cut.add(e);
  const placed = [], pts = [];
  for (const f of faces) for (const p of L.get(f)) pts.push(p);
  for (const e of [...cut].sort((a, b) => m.E[b].len - m.E[a].len)) {
    const E = m.E[e], sides = E.f.filter(f => local.has(f));
    let done = false;
    const hits = [];
    for (const sc of tabSteps(o)) {
      for (const f of sides) {
        const i = m.FE[f].indexOf(e), P = L.get(f);
        const t = tabPoly(P[i], P[(i + 1) % 3], o.tabH * sc[0], sc[1]), bb = bbox(t.poly);
        let hit = -1;
        for (const it of items) { if (it.f !== f && bbOver(bb, it.bb) && polyOverlap(t.poly, L.get(it.f))) { hit = it.f; break; } }
        if (hit < 0) for (const q of placed) { if (bbOver(bb, q.bb) && polyOverlap(t.poly, q.poly)) { hit = q.f; break; } }
        if (hit < 0) { placed.push({ poly: t.poly, bb, f }); for (const p of t.poly) pts.push(p); done = true; break; }
        hits.push(f, hit);
      }
      if (done) break;
    }
    if (!done && sides.length === 2) { if (!info) return false; ok = false; for (const h of hits) conf.add(h); }
  }
  if (!fitsRect(hull(pts), o.W, o.H)) { if (info) info.tooBig = true; return false; }
  return ok;
}

// Kleine stukjes opruimen: hecht een klein stuk aan een buur en knip het deel van die buur
// dat in de weg zit los; dat deel wordt elders aangehecht, of is in elk geval een groter stuk.
function absorbSmall(m, joined, o, maxSize) {
  maxSize = maxSize || 3;
  const t0 = Date.now(), budget = o.absorbBudget || 4000;
  let gained = 0;
  const failed = new Set();
  const avoid = e => o.avoid && o.avoid[e];
  for (let guard = 0; guard < 300 && Date.now() - t0 < budget; guard++) {
    const cp = computePieces(m, joined);
    const small = cp.pieces.filter(p => p.faces.length <= maxSize && !failed.has(p.faces.slice().sort((x, y) => x - y).join(','))).sort((a, b) => a.faces.length - b.faces.length);
    if (!small.length) break;
    const S = small[0];
    const sKey = S.faces.slice().sort((x, y) => x - y).join(',');
    let success = false;
    const inS = new Set(S.faces);
    const edges = [];
    for (const f of S.faces) for (const e of m.FE[f]) { const E = m.E[e]; if (E.m && !joined[e] && !inS.has(otherFace(E, f)) && !avoid(e)) edges.push(e); }
    edges.sort((a, b) => m.E[b].len - m.E[a].len);
    for (const e of edges) {
      const fs = inS.has(m.E[e].f[0]) ? m.E[e].f[0] : m.E[e].f[1], fp = otherFace(m.E[e], fs);
      const Pid = cp.pieceOf[fp];
      joined[e] = 1;
      const info = {};
      if (validateComponent(m, joined, fs, o, info)) { success = true; break; }
      const CF = info.tooBig || info.ring ? [] : [...info.conflicts].filter(f => cp.pieceOf[f] === Pid && f !== fp);
      if (!CF.length) { joined[e] = 0; continue; }
      // kandidaat-knipranden: gemeenschappelijk deel van de paden conflictvlak → fp
      const anc = f => { const out = []; while (f !== fp && info.parent.has(f)) { const [pf, pe] = info.parent.get(f); out.push(pe); f = pf; } return out; };
      let common = anc(CF[0]);
      for (const f of CF.slice(1)) { const st = new Set(anc(f)); common = common.filter(x => st.has(x)); }
      for (const c of common.slice(0, 8)) {
        joined[c] = 0;
        const iA = {};
        if (!validateComponent(m, joined, fs, o, iA)) { joined[c] = 1; continue; }
        const inA = new Set(iA.faces);
        const bSeed = inA.has(m.E[c].f[0]) ? m.E[c].f[1] : m.E[c].f[0];
        const iB = {};
        if (!validateComponent(m, joined, bSeed, o, iB)) { joined[c] = 1; continue; }
        const inB = new Set(iB.faces);
        let attached = false;
        for (const f of iB.faces) {
          for (const x of m.FE[f]) {
            const X = m.E[x];
            if (!X.m || joined[x] || x === c || avoid(x)) continue;
            const g = otherFace(X, f);
            if (inB.has(g) || inA.has(g)) continue;
            joined[x] = 1;
            if (validateComponent(m, joined, f, o)) { attached = true; break; }
            joined[x] = 0;
          }
          if (attached) break;
        }
        if (attached || iB.faces.length > Math.max(maxSize, S.faces.length)) { success = true; break; }
        joined[c] = 1;
      }
      if (success) break;
      joined[e] = 0;
    }
    if (success) gained++; else failed.add(sKey);
  }
  return gained;
}

// Probeer naburige stukken alsnog samen te voegen (kleinste stukken eerst).
function remergePass(m, joined, o) {
  let merged = 0;
  for (let pass = 0; pass < 6; pass++) {
    const cp = computePieces(m, joined);
    const sz = cp.pieces.map(p => p.faces.length);
    const cand = [];
    m.E.forEach((E, e) => {
      if (!E.m || joined[e] || (o.avoid && o.avoid[e])) return;
      const a = cp.pieceOf[E.f[0]], b = cp.pieceOf[E.f[1]];
      if (a === b) return;
      cand.push({ e, k: Math.min(sz[a], sz[b]), k2: sz[a] + sz[b], bend: E.bend });
    });
    cand.sort((x, y) => x.k - y.k || x.bend - y.bend || x.k2 - y.k2);
    const par = cp.pieces.map((_, i) => i);
    const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
    let n = 0;
    for (const c of cand) {
      const E = m.E[c.e];
      const a = find(cp.pieceOf[E.f[0]]), b = find(cp.pieceOf[E.f[1]]);
      if (a === b) continue;
      joined[c.e] = 1;
      if (validateComponent(m, joined, E.f[0], o)) { par[a] = b; n++; }
      else joined[c.e] = 0;
    }
    merged += n;
    if (!n) break;
  }
  return merged;
}

// Pieces of only 1 or 2 faces are fiddly. When a tiny piece borders a piece that cannot take it
// (for example because of the maximum number of faces), the tiny piece takes over a branch of
// that neighbour instead: both end up with at least 3 faces where possible. Only moves that keep
// both pieces valid (no overlap, room for tabs, on the paper, limits) are made.
// relax: when given, only these edges may not be joined (used to let tiny pieces that are
// enclosed by sharp folds join a neighbour across their least sharp fold; colour borders stay).
function growTiny(m, joined, o, relax) {
  const t0 = Date.now(), budget = o.growBudget || 1500, avoid = e => (relax ? relax[e] : o.avoid && o.avoid[e]);
  const count = faces => pieceFaceCount(m, joined, faces);
  let moves = 0;
  for (let pass = 0; pass < 30 && Date.now() - t0 < budget; pass++) {
    const cp = computePieces(m, joined), size = cp.pieces.map(p => count(p.faces)), touched = new Set();
    let moved = 0;
    for (const S of cp.pieces) {
      if (size[S.id] > 2 || touched.has(S.id) || Date.now() - t0 > budget) continue;
      const inS = new Set(S.faces);
      let done = false;
      // candidate edges, least sharp fold first
      const cand = [];
      for (const f of S.faces) for (const e of m.FE[f]) { const E = m.E[e]; if (E.m && !joined[e] && !avoid(e) && !inS.has(otherFace(E, f))) cand.push([f, e]); }
      cand.sort((p, q) => m.E[p[1]].bend - m.E[q[1]].bend);
      for (const [f, e] of cand) {
        {
          const E = m.E[e];
          const g = otherFace(E, f), N = cp.pieces[cp.pieceOf[g]];
          if (touched.has(N.id)) continue;
          // the whole tiny piece joins the neighbour, when that fits
          joined[e] = 1;
          if (validateComponent(m, joined, f, o)) { touched.add(S.id); touched.add(N.id); moved++; done = true; break; }
          joined[e] = 0;
          if (size[N.id] < 4) continue;
          // branches of N that contain g: the subtree of g, then of its ancestors
          const up = x => { const pe = cp.parentEdge[x]; return pe < 0 ? -1 : otherFace(m.E[pe], x); };
          const kids = new Map();
          for (const x of N.faces) { const pp = up(x); if (pp >= 0) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(x); } }
          for (let x = g; x >= 0 && !done; x = up(x)) {
            if (cp.parentEdge[x] < 0) break; // the root: the whole piece
            const B = [x]; for (let i = 0; i < B.length; i++) for (const k of kids.get(B[i]) || []) B.push(k);
            const inB = new Set(B), nb = count(B), rest = N.faces.filter(y => !inB.has(y));
            if (size[N.id] - nb < 3) break;               // the neighbour must keep at least 3 faces
            if (o.maxFaces > 0 && size[S.id] + nb > o.maxFaces) break;
            // detach B from N (all joined edges between them), attach it to S via e
            const cutE = [];
            for (const y of B) for (const ee of m.FE[y]) { const EE = m.E[ee]; if (EE.m && joined[ee] && !inB.has(otherFace(EE, y)) && !inS.has(otherFace(EE, y))) cutE.push(ee); }
            for (const ee of cutE) joined[ee] = 0;
            joined[e] = 1;
            if (validateComponent(m, joined, f, o) && validateComponent(m, joined, rest[0], o)) {
              touched.add(S.id); touched.add(N.id); moved++; done = true;
            } else { joined[e] = 0; for (const ee of cutE) joined[ee] = 1; }
          }
          if (done) break;
        }
        if (done) break;
      }
    }
    moves += moved;
    if (!moved) break;
  }
  return moves;
}

// Herstel: knip waar strookjes niet passen of stukken te groot zijn.
function repair(m, joined, o) {
  let cuts = 0;
  for (let iter = 0; iter < 400; iter++) {
    const cp = computePieces(m, joined);
    if (cp.bad.length) { cp.bad.forEach(e => joined[e] = 0); continue; }
    const lmm = toMM(cp.local, o.scale);
    const tl = layoutTabs(m, cp, lmm, joined, o);
    const fix = new Map();
    for (const c of tl.conflicts) {
      if (c.hitFace === undefined) continue;
      const pid = cp.pieceOf[c.f];
      if (fix.has(pid) || cp.pieceOf[c.hitFace] !== pid) continue;
      const path = treePath(cp, m, c.f, c.hitFace);
      if (path.length) fix.set(pid, smallestCutOnPath(cp, m, cp.pieces[pid], path));
    }
    for (const p of cp.pieces) {
      if (fix.has(p.id) || p.faces.length < 2) continue;
      if (!fitsRect(hull(pieceOutlinePts(p, lmm, m, tl)), o.W, o.H)) fix.set(p.id, splitEdge(cp, m, p));
    }
    if (!fix.size) break;
    for (const e of fix.values()) if (e >= 0) { joined[e] = 0; cuts++; }
  }
  return cuts;
}

// Lokale mm-coördinaten per vlak
function toMM(local, scale) { return local.map(t => t.map(p => [p[0] * scale, p[1] * scale])); }

// Contour-punten (vlakken + stroken) per stuk, in lokale mm.
function pieceOutlinePts(piece, lmm, m, tl) {
  const pts = [];
  for (const f of piece.faces) {
    for (const p of lmm[f]) pts.push(p);
    for (const e of m.FE[f]) if (tl.tabFace[e] === f) for (const p of tl.tabs[e].poly) pts.push(p);
  }
  return pts;
}

// Volledig automatisch: zo groot mogelijke stukken, passend op papier, zonder overlap,
// met bruikbare plakstrookjes. o: {scale (mm/eenheid), W, H (printbaar mm), tabH, tabAngle, minTab, avoid}
function edgeOrders(m, tries) {
  const E = m.E, idx = E.map((_, i) => i), deg = Math.PI / 180;
  const flatFirst = (a, b) => (E[b].flat - E[a].flat);
  const orders = [
    idx.slice().sort((a, b) => flatFirst(a, b) || Math.round(E[a].bend / deg / 3) - Math.round(E[b].bend / deg / 3) || E[b].len - E[a].len),
    idx.slice().sort((a, b) => flatFirst(a, b) || E[b].len - E[a].len),
    idx.slice().sort((a, b) => flatFirst(a, b) || E[b].bend - E[a].bend),
  ];
  let seed = 12345;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  while (orders.length < tries) { const w = idx.map(() => rnd()); orders.push(idx.slice().sort((a, b) => flatFirst(a, b) || w[a] - w[b])); }
  return orders.slice(0, tries);
}

function scoreJoined(m, joined) {
  const cp = computePieces(m, joined);
  const n = cp.pieces.length;
  const small = cp.pieces.filter(p => p.faces.length <= 3).length;
  const tiny = cp.pieces.filter(p => p.faces.length <= 1).length;
  let cutLen = 0; m.E.forEach((E, e) => { if (E.m && !joined[e]) cutLen += E.len; });
  return { n, small, cutLen, small, score: n * 1000 + small * 700 + tiny * 500 + cutLen / m.diag };
}

// Edges that fold more sharply than deg degrees (convex or concave).
function sharpEdges(m, deg) {
  const t = deg * Math.PI / 180 - 1e-9, a = new Uint8Array(m.E.length);
  m.E.forEach((E, i) => { if (E.m && E.bend >= t) a[i] = 1; });
  return a;
}

function autoPipeline(m, o, onProgress) {
  // o.avoid: edges that may not be joined (color borders); o.sharpDeg: also cut sharp folds
  const colorAvoid = o.avoid || null, sharp = o.sharpDeg > 0 ? sharpEdges(m, o.sharpDeg) : null;
  if (sharp) {
    const av = colorAvoid ? colorAvoid.slice() : new Uint8Array(m.E.length);
    sharp.forEach((x, i) => { if (x) av[i] = 1; });
    o = { ...o, avoid: av };
  }
  const margin = o.tabH * 1.05;
  const tries = o.tries || 8, budget = o.timeBudget || 6000, t0 = Date.now();
  const orders = edgeOrders(m, tries);
  // lengte-volgorde eerst (meestal de beste)
  orders.unshift(orders.splice(1, 1)[0]);
  let best = null;
  for (let k = 0; k < orders.length; k++) {
    if (k > 0 && Date.now() - t0 > budget) break;
    const joined = autoUnfold(m, {
      maxW: (o.W - 2 * margin) / o.scale, maxH: (o.H - 2 * margin) / o.scale, avoid: o.avoid, order: orders[k],
      validate: (jj, f) => validateComponent(m, jj, f, o)
    });
    for (let round = 0; round < 4; round++) {
      const cuts = repair(m, joined, o);
      const merges = remergePass(m, joined, o);
      if (!merges && !cuts) break;
    }
    repair(m, joined, o);
    if (o.absorb !== false) {
      absorbSmall(m, joined, o, o.absorbMax || 5);
      repair(m, joined, o);
      if (colorAvoid && o.mergeTinyColors) {
        // alleen complete kleurvlakken van hoogstens 2 driehoeken mogen bij een buurstuk van een andere kleur
        const cp = computePieces(m, joined), av = o.avoid.slice();
        for (const p of cp.pieces) {
          if (p.faces.length > 2) continue;
          const inP = new Set(p.faces);
          const sameOutside = p.faces.some(f => m.FE[f].some(e => { const E = m.E[e]; return E.m && !colorAvoid[e] && !inP.has(otherFace(E, f)); }));
          if (!sameOutside) for (const f of p.faces) for (const e of m.FE[f]) if (!(sharp && sharp[e])) av[e] = 0;
        }
        absorbSmall(m, joined, { ...o, avoid: av }, 2);
        repair(m, joined, o);
      }
      if (sharp) {
        // tiny pieces (1–2 small triangles, e.g. a pointed tip) that are only loose because of sharp
        // folds may still join a neighbour: such a tiny piece is harder to build than a sharp fold
        const cp = computePieces(m, joined), av = o.avoid.slice(), lim = 4 * o.tabH / o.scale;
        let any = false;
        for (const p of cp.pieces) {
          if (p.faces.length > 2 || p.faces.some(f => m.FE[f].some(e => m.E[e].len > lim))) continue;
          for (const f of p.faces) for (const e of m.FE[f]) if (sharp[e] && !(colorAvoid && colorAvoid[e])) { av[e] = 0; any = true; }
        }
        if (any) { absorbSmall(m, joined, { ...o, avoid: av }, 2); repair(m, joined, o); }
      }
      remergePass(m, joined, o);
      repair(m, joined, o);
    }
    if (o.growTiny !== false) {
      let g = growTiny(m, joined, o);
      // tiny pieces enclosed by sharp folds may still join a neighbour across a fold of less than
      // 85° (colour borders stay cut)
      // (folds of a right angle or sharper, like the edges of a box, always stay cut)
      if (sharp) {
        const relax = new Uint8Array(m.E.length), lim = 85 * Math.PI / 180;
        m.E.forEach((E, i) => { if ((colorAvoid && colorAvoid[i]) || (sharp[i] && E.bend >= lim)) relax[i] = 1; });
        g += growTiny(m, joined, o, relax);
      }
      if (g) repair(m, joined, o);
    }
    const s = scoreJoined(m, joined);
    if (!best || s.score < best.s.score) best = { joined, s };
    if (onProgress) onProgress(k + 1, orders.length, best.s.n);
  }
  return best.joined;
}

// ---------------------------------------------------------------- nesting (stukken zo dicht mogelijk op pagina's)
// items: [{ id, polys: [[ [x,y], ... ], ...] }] (convexe polygonen in lokale mm)
// W, H: printbaar gebied (mm). o: { gap (mm), cell (mm), angleStep (graden) }
// Resultaat: [{ id, page, deg, x, y }] met wereld = R(deg)·lokaal + (x, y), relatief t.o.v. de linkerbovenhoek van het printbare gebied.
function nestLayout(items, W, H, o) {
  o = o || {};
  const cell = o.cell || 1, gap = o.gap == null ? 2 : o.gap, step = o.angleStep || 15;
  const d = Math.max(0, Math.ceil(gap / cell / 2)); // elk stuk krijgt gap/2 rand → samen gap
  const Wc = Math.floor(W / cell), Hc = Math.floor(H / cell);
  const GW = Wc + 2 * d, GH = Hc + 2 * d; // raster met vrije rand van d cellen
  const rot = (q, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); return [c * q[0] - sn * q[1], sn * q[0] + c * q[1]]; };

  // vorm rasteren (conservatief) en uitbreiden met d cellen; geeft per rij de bezette stukken (runs)
  function makeMask(polys, deg) {
    const R = polys.map(P => P.map(q => rot(q, deg)));
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const P of R) for (const q of P) { if (q[0] < mnx) mnx = q[0]; if (q[1] < mny) mny = q[1]; if (q[0] > mxx) mxx = q[0]; if (q[1] > mxy) mxy = q[1]; }
    const ox = mnx - d * cell, oy = mny - d * cell;
    const w = Math.ceil((mxx - ox) / cell) + d + 1, h = Math.ceil((mxy - oy) / cell) + d + 1;
    const g = new Uint8Array(w * h);
    for (const P of R) {
      let pmn = Infinity, pmx = -Infinity;
      for (const q of P) { if (q[1] < pmn) pmn = q[1]; if (q[1] > pmx) pmx = q[1]; }
      const r0 = Math.max(0, Math.floor((pmn - oy) / cell)), r1 = Math.min(h - 1, Math.floor((pmx - oy) / cell));
      for (let r = r0; r <= r1; r++) {
        const y0 = oy + r * cell, y1 = y0 + cell;
        let a = Infinity, b = -Infinity;
        const n = P.length;
        for (let i = 0; i < n; i++) {
          const p0 = P[i], p1 = P[(i + 1) % n];
          if (p0[1] >= y0 && p0[1] <= y1) { if (p0[0] < a) a = p0[0]; if (p0[0] > b) b = p0[0]; }
          for (const yl of [y0, y1]) {
            if ((p0[1] - yl) * (p1[1] - yl) < 0) { const x = p0[0] + (p1[0] - p0[0]) * (yl - p0[1]) / (p1[1] - p0[1]); if (x < a) a = x; if (x > b) b = x; }
          }
        }
        if (a > b) continue;
        const c0 = Math.max(0, Math.floor((a - ox) / cell)), c1 = Math.min(w - 1, Math.floor((b - ox) / cell));
        for (let c = c0; c <= c1; c++) g[r * w + c] = 1;
      }
    }
    // uitbreiden (dilatatie) met d cellen: horizontaal dan verticaal
    let cur = g;
    if (d > 0) {
      const t = new Uint8Array(w * h);
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (cur[r * w + c]) for (let k = Math.max(0, c - d); k <= Math.min(w - 1, c + d); k++) t[r * w + k] = 1;
      const u = new Uint8Array(w * h);
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (t[r * w + c]) for (let k = Math.max(0, r - d); k <= Math.min(h - 1, r + d); k++) u[k * w + c] = 1;
      cur = u;
    }
    const runs = [];
    let filled = 0;
    for (let r = 0; r < h; r++) {
      const row = [];
      let c = 0;
      while (c < w) {
        if (!cur[r * w + c]) { c++; continue; }
        const a = c; while (c < w && cur[r * w + c]) c++;
        row.push(a, c - 1); filled += c - a;
      }
      runs.push(row);
    }
    // controle-volgorde: middelste rij eerst (faalt meestal snel)
    const order = runs.map((_, i) => i).sort((x, y) => Math.abs(x - h / 2) - Math.abs(y - h / 2));
    return { deg, w, h, ox, oy, runs, order, filled };
  }

  function newPage() {
    const pg = { occ: new Uint8Array(GW * GH), pre: Array.from({ length: GH }, () => new Int32Array(GW + 1)), used: 0 };
    // vaste obstakels (bijv. registratiemarkeringen), in mm t.o.v. het printbare gebied
    for (const ob of o.obstacles || []) {
      const c0 = Math.max(0, Math.floor(ob.x / cell) + d), c1 = Math.min(GW - 1, Math.ceil((ob.x + ob.w) / cell) + d);
      const r0 = Math.max(0, Math.floor(ob.y / cell) + d), r1 = Math.min(GH - 1, Math.ceil((ob.y + ob.h) / cell) + d);
      for (let r = r0; r <= r1; r++) {
        for (let k = c0; k <= c1; k++) pg.occ[r * GW + k] = 1;
        const P = pg.pre[r]; for (let k = 0; k < GW; k++) P[k + 1] = P[k] + pg.occ[r * GW + k];
      }
    }
    return pg;
  }
  function fits(pg, M, px, py) {
    for (const r of M.order) {
      const row = M.runs[r]; if (!row.length) continue;
      const y = py + r, P = pg.pre[y], base = y * GW;
      for (let k = 0; k < row.length; k += 2) {
        const a = px + row[k], b = px + row[k + 1];
        if (P[b + 1] - P[a] > 0) {
          // spring voorbij de laatste bezette cel in dit stuk
          let c = b; while (!pg.occ[base + c]) c--;
          return c - a + 1;
        }
      }
    }
    return 0;
  }
  function stamp(pg, M, px, py) {
    for (let r = 0; r < M.h; r++) {
      const row = M.runs[r]; if (!row.length) continue;
      const y = py + r, base = y * GW;
      for (let k = 0; k < row.length; k += 2) for (let c = row[k]; c <= row[k + 1]; c++) pg.occ[base + px + c] = 1;
      const P = pg.pre[y];
      for (let c = 0; c < GW; c++) P[c + 1] = P[c] + pg.occ[base + c];
    }
    pg.used += M.filled;
  }
  // beste plek op een pagina: zo laag mogelijke onderkant, dan zo ver mogelijk links
  function bestOn(pg, masks) {
    let best = null;
    for (const M of masks) {
      if (M.w > GW || M.h > GH) continue;
      for (let py = 0; py + M.h <= GH; py++) {
        if (best && py + M.h > best.bottom) break;
        let found = -1;
        for (let px = 0; px + M.w <= GW;) { const j = fits(pg, M, px, py); if (!j) { found = px; break; } px += j; }
        if (found >= 0) {
          const bottom = py + M.h;
          if (!best || bottom < best.bottom || (bottom === best.bottom && found < best.px)) best = { M, px: found, py, bottom };
          break;
        }
      }
    }
    return best;
  }

  const prepared = items.map(it => {
    const angles = new Set();
    for (let a = 0; a < 360; a += step) angles.add(a);
    if (o.extraAngles && o.extraAngles[it.id] != null) { const b = o.extraAngles[it.id]; for (const k of [0, 90, 180, 270]) angles.add(((b + k) % 360 + 360) % 360); }
    const masks = [...angles].map(a => makeMask(it.polys, a));
    const area = Math.min(...masks.map(M => M.filled));
    return { it, masks, area };
  });
  prepared.sort((a, b) => b.area - a.area);
  const pages = [], out = [];
  for (const pr of prepared) {
    let placed = null;
    for (let pi = 0; pi < pages.length && !placed; pi++) {
      if (GW * GH - pages[pi].used < pr.area) continue;
      const b = bestOn(pages[pi], pr.masks);
      if (b) placed = { pi, ...b };
    }
    if (!placed) {
      const pg = newPage(); pages.push(pg);
      const b = bestOn(pg, pr.masks);
      if (b) placed = { pi: pages.length - 1, ...b };
      else {
        // past niet op een lege pagina: kleinste rechthoek, linksboven
        const M = pr.masks.slice().sort((x, y) => Math.max(x.w / GW, x.h / GH) - Math.max(y.w / GW, y.h / GH))[0];
        out.push({ id: pr.it.id, page: pages.length - 1, deg: M.deg, x: -M.ox - d * cell + d * cell, y: -M.oy, tooBig: true });
        pg.used = GW * GH;
        continue;
      }
    }
    stamp(pages[placed.pi], placed.M, placed.px, placed.py);
    const M = placed.M;
    // raster-cel (0,0) ligt op (-d, -d) cellen t.o.v. het printbare gebied
    out.push({ id: pr.it.id, page: placed.pi, deg: M.deg, x: (placed.px - d) * cell - M.ox, y: (placed.py - d) * cell - M.oy });
  }
  return { placements: out, pages: pages.length };
}

// ---------------------------------------------------------------- simplify (quadric edge collapse)
// Reduces a triangle soup to about `target` triangles while keeping the shape (Garland & Heckbert).
// key (optional, one value per triangle, e.g. the material): borders between different keys and
// open edges are kept in place. Returns { pos, src }: src[t] is the original triangle that output
// triangle t comes from (to carry over materials and texture coordinates). Deterministic.
function simplifyMesh(pos, target, key) {
  const n = Math.floor(pos.length / 9);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 9; i += 3) for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  const diag = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1, qq = diag * 1e-6;
  // weld vertices (same tolerance as buildMesh)
  const X = [], Y = [], Z = [], vmap = new Map();
  const vid = o => {
    const k = Math.round(pos[o] / qq) + ',' + Math.round(pos[o + 1] / qq) + ',' + Math.round(pos[o + 2] / qq);
    let i = vmap.get(k);
    if (i === undefined) { i = X.length; X.push(pos[o]); Y.push(pos[o + 1]); Z.push(pos[o + 2]); vmap.set(k, i); }
    return i;
  };
  const F = [], fsrc = [];
  for (let t = 0; t < n; t++) {
    const a = vid(t * 9), b = vid(t * 9 + 3), c = vid(t * 9 + 6);
    if (a === b || b === c || a === c) continue;
    F.push(a, b, c); fsrc.push(t);
  }
  const nf0 = fsrc.length, nv = X.length;
  const alive = new Uint8Array(nf0).fill(1);
  const vf = Array.from({ length: nv }, () => []);
  for (let f = 0; f < nf0; f++) for (let k = 0; k < 3; k++) vf[F[3 * f + k]].push(f);
  const Q = new Float64Array(nv * 10);
  const addPlane = (v, a, b, c, d, w) => {
    const o = v * 10;
    Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d;
    Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d;
    Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d;
  };
  const fnorm = (a, b, c, ax, ay, az) => { // unnormalized normal of triangle (a,b,c) with a moved to (ax,ay,az)
    const ux = X[b] - ax, uy = Y[b] - ay, uz = Z[b] - az, wx = X[c] - ax, wy = Y[c] - ay, wz = Z[c] - az;
    return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
  };
  // face planes, weighted by area
  for (let f = 0; f < nf0; f++) {
    const a = F[3 * f], b = F[3 * f + 1], c = F[3 * f + 2];
    const N = fnorm(a, b, c, X[a], Y[a], Z[a]), l = Math.hypot(...N);
    if (l < 1e-30) continue;
    const nx = N[0] / l, ny = N[1] / l, nz = N[2] / l, d = -(nx * X[a] + ny * Y[a] + nz * Z[a]);
    for (const v of [a, b, c]) addPlane(v, nx, ny, nz, d, l / 2);
  }
  // borders (open edges, non-manifold edges, key changes): a steep plane through the edge,
  // perpendicular to the face, so the border stays where it is
  const emap = new Map();
  for (let f = 0; f < nf0; f++) for (let k = 0; k < 3; k++) {
    const a = F[3 * f + k], b = F[3 * f + (k + 1) % 3], id = a < b ? a * nv + b : b * nv + a;
    let L = emap.get(id); if (!L) emap.set(id, L = []); L.push(f);
  }
  const BW = 1000;
  for (const [id, L] of emap) {
    const border = L.length !== 2 || (key && key[fsrc[L[0]]] !== key[fsrc[L[1]]]);
    if (!border) continue;
    const a = Math.floor(id / nv), b = id % nv;
    const ex = X[b] - X[a], ey = Y[b] - Y[a], ez = Z[b] - Z[a], el2 = ex * ex + ey * ey + ez * ez;
    for (const f of L) {
      const N = fnorm(F[3 * f], F[3 * f + 1], F[3 * f + 2], X[F[3 * f]], Y[F[3 * f]], Z[F[3 * f]]);
      let px = ey * N[2] - ez * N[1], py = ez * N[0] - ex * N[2], pz = ex * N[1] - ey * N[0];
      const l = Math.hypot(px, py, pz); if (l < 1e-30) continue;
      px /= l; py /= l; pz /= l;
      const d = -(px * X[a] + py * Y[a] + pz * Z[a]);
      addPlane(a, px, py, pz, d, BW * el2); addPlane(b, px, py, pz, d, BW * el2);
    }
  }
  const err = (q, x, y, z) => q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9];
  const qs = new Float64Array(10);
  // best position and cost for collapsing edge a-b
  function evalEdge(a, b) {
    for (let i = 0; i < 10; i++) qs[i] = Q[a * 10 + i] + Q[b * 10 + i];
    const cand = [[X[a], Y[a], Z[a]], [X[b], Y[b], Z[b]], [(X[a] + X[b]) / 2, (Y[a] + Y[b]) / 2, (Z[a] + Z[b]) / 2]];
    // optimal point: solve A p = -b (Cramer); only when well conditioned and close to the edge
    const A = [qs[0], qs[1], qs[2], qs[1], qs[4], qs[5], qs[2], qs[5], qs[7]], B = [-qs[3], -qs[6], -qs[8]];
    const det3 = M => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
    const D = det3(A), tr = qs[0] + qs[4] + qs[7];
    if (Math.abs(D) > 1e-9 * tr * tr * tr) {
      const p = [0, 1, 2].map(col => det3(A.map((v, i) => (i % 3 === col ? B[(i / 3) | 0] : v))) / D);
      const el = Math.hypot(X[a] - X[b], Y[a] - Y[b], Z[a] - Z[b]);
      if (Math.hypot(p[0] - cand[2][0], p[1] - cand[2][1], p[2] - cand[2][2]) < el) cand.push(p);
    }
    let best = null, bc = Infinity;
    for (const p of cand) { const e = err(qs, p[0], p[1], p[2]); if (e < bc - 1e-18 * diag) { bc = e; best = p; } }
    return [Math.max(0, bc), best];
  }
  // binary min-heap of edge candidates; stale entries are skipped by version stamps
  const ver = new Uint32Array(nv), hc = [], ha = [], hb = [], hva = [], hvb = [], hp = [], heap = [];
  const less = (i, j) => hc[i] < hc[j] || (hc[i] === hc[j] && i < j);
  const push = (a, b) => {
    const [c, p] = evalEdge(a, b), id = hc.length;
    hc.push(c); ha.push(a); hb.push(b); hva.push(ver[a]); hvb.push(ver[b]); hp.push(p);
    let i = heap.length; heap.push(id);
    while (i > 0) { const pa = (i - 1) >> 1; if (!less(heap[i], heap[pa])) break; [heap[i], heap[pa]] = [heap[pa], heap[i]]; i = pa; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && less(heap[l], heap[s])) s = l; if (r < heap.length && less(heap[r], heap[s])) s = r; if (s === i) break; [heap[i], heap[s]] = [heap[s], heap[i]]; i = s; }
    }
    return top;
  };
  const liveFaces = v => { const L = vf[v].filter(f => alive[f] && (F[3 * f] === v || F[3 * f + 1] === v || F[3 * f + 2] === v)); vf[v] = L; return L; };
  const neighbours = v => { const s = new Set(); for (const f of liveFaces(v)) for (let k = 0; k < 3; k++) if (F[3 * f + k] !== v) s.add(F[3 * f + k]); return s; };
  for (const id of emap.keys()) { const a = Math.floor(id / nv), b = id % nv; push(a, b); }

  let nf = nf0, rounds = 0;
  target = Math.max(4, Math.round(target));
  while (nf > target) {
    if (!heap.length) {
      // edges rejected earlier may be valid now: a few fresh rounds when the queue runs dry
      if (rounds++ >= 3) break;
      const seen = new Set();
      for (let f = 0; f < nf0; f++) if (alive[f]) for (let k = 0; k < 3; k++) {
        const u = F[3 * f + k], w = F[3 * f + (k + 1) % 3], id = u < w ? u * nv + w : w * nv + u;
        if (!seen.has(id)) { seen.add(id); push(Math.min(u, w), Math.max(u, w)); }
      }
      if (!heap.length) break;
      continue;
    }
    const h = pop(), a = ha[h], b = hb[h];
    if (hva[h] !== ver[a] || hvb[h] !== ver[b]) continue;
    const p = hp[h];
    const fa = liveFaces(a), fb = liveFaces(b);
    const shared = fa.filter(f => fb.includes(f));
    if (!shared.length) continue;
    // link condition: the only common neighbours are the opposite corners of the shared faces
    const na = neighbours(a), nb = neighbours(b);
    let common = 0; for (const v of na) if (v !== b && nb.has(v)) common++;
    if (common !== shared.length) continue;
    // no face may flip or become a sliver
    let ok = true;
    for (const [v, L] of [[a, fa], [b, fb]]) {
      for (const f of L) {
        if (shared.includes(f)) continue;
        const k = F[3 * f] === v ? 0 : F[3 * f + 1] === v ? 1 : 2;
        const o1 = F[3 * f + (k + 1) % 3], o2 = F[3 * f + (k + 2) % 3];
        const N0 = fnorm(v, o1, o2, X[v], Y[v], Z[v]), N1 = fnorm(v, o1, o2, p[0], p[1], p[2]);
        const l0 = Math.hypot(...N0), l1 = Math.hypot(...N1);
        if (l1 < 1e-12 * diag * diag || (N0[0] * N1[0] + N0[1] * N1[1] + N0[2] * N1[2]) < 0.2 * l0 * l1) { ok = false; break; }
        // sliver check: smallest angle may not collapse completely
        const e1 = Math.hypot(X[o1] - p[0], Y[o1] - p[1], Z[o1] - p[2]), e2 = Math.hypot(X[o2] - p[0], Y[o2] - p[1], Z[o2] - p[2]), e3 = Math.hypot(X[o1] - X[o2], Y[o1] - Y[o2], Z[o1] - Z[o2]);
        const lmax = Math.max(e1, e2, e3);
        if (l1 < 0.02 * lmax * lmax) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (!ok) continue;
    // collapse b into a
    for (const f of shared) { alive[f] = 0; nf--; }
    for (const f of fb) if (alive[f]) { for (let k = 0; k < 3; k++) if (F[3 * f + k] === b) F[3 * f + k] = a; vf[a].push(f); }
    vf[b] = [];
    X[a] = p[0]; Y[a] = p[1]; Z[a] = p[2];
    for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
    ver[a]++; ver[b]++;
    for (const v of neighbours(a)) push(a, v);
  }
  const out = new Float32Array(nf * 9), src = new Int32Array(nf);
  let t = 0;
  for (let f = 0; f < nf0; f++) {
    if (!alive[f]) continue;
    for (let k = 0; k < 3; k++) { const v = F[3 * f + k]; out[t * 9 + k * 3] = X[v]; out[t * 9 + k * 3 + 1] = Y[v]; out[t * 9 + k * 3 + 2] = Z[v]; }
    src[t++] = fsrc[f];
  }
  return { pos: out, src };
}

const api = {
  nestLayout, simplifyMesh,
  toMM, pieceOutlinePts, autoPipeline, absorbSmall, tabSteps, growUnfold, edgeOrders,
  parseSTL, parseOBJ, parseGLB, parseModel, buildMesh, setFlat, placeTriangle, computePieces, sharpEdges, pieceFaceCount, growTiny,
  bbox, bbOver, polyOverlap, hull, rotBox, fitsRect, bestRotation, tabPoly, autoUnfold, layoutTabs,
  selfOverlaps, treePath, splitEdge, otherFace, hslToRgb, validateComponent, remergePass, repair, scoreJoined
};
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
