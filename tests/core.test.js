// Unit tests for src/core.js (run with: node --test tests/)
// The test models are generated here, so no external model files are needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

// ---------------------------------------------------------------- test models
function triangulate(V, polys) {
  const out = [];
  for (const p of polys) for (let k = 1; k + 1 < p.length; k++) for (const i of [p[0], p[k], p[k + 1]]) out.push(...V[i]);
  return new Float32Array(out);
}
function cube(s = 1) {
  const V = [[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0], [0, 0, s], [s, 0, s], [s, s, s], [0, s, s]];
  return triangulate(V, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]]);
}
function house() {
  const V = [[0, 0, 0], [2, 0, 0], [2, 1.5, 0], [0, 1.5, 0], [0, 0, 1.2], [2, 0, 1.2], [2, 1.5, 1.2], [0, 1.5, 1.2], [0, 0.75, 2], [2, 0.75, 2]];
  return triangulate(V, [[0, 3, 2, 1], [0, 1, 5, 4], [2, 3, 7, 6], [3, 0, 4, 8, 7], [1, 2, 6, 9, 5], [4, 5, 9, 8], [6, 7, 8, 9]]);
}
function cylinder(n = 12, r = 1, h = 3) {
  const V = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; V.push([r * Math.cos(a), r * Math.sin(a), 0], [r * Math.cos(a), r * Math.sin(a), h]); }
  const polys = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; polys.push([2 * i, 2 * j, 2 * j + 1, 2 * i + 1]); }
  polys.push(Array.from({ length: n }, (_, i) => 2 * (n - 1 - i)), Array.from({ length: n }, (_, i) => 2 * i + 1));
  return triangulate(V, polys);
}
function icosphere(sub = 2) {
  const t = (1 + Math.sqrt(5)) / 2, nrm = p => { const l = Math.hypot(...p); return p.map(x => x / l); };
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map(), mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!cache.has(k)) { V.push(nrm(V[a].map((x, i) => (x + V[b][i]) / 2))); cache.set(k, V.length - 1); } return cache.get(k); };
    F = F.flatMap(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  }
  return triangulate(V, F);
}
function stlBinary(pos) {
  const n = pos.length / 9, buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
  dv.setUint32(80, n, true);
  for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) dv.setFloat32(84 + i * 50 + 12 + k * 4, pos[i * 9 + k], true);
  return buf;
}
function stlAscii(pos) {
  let s = 'solid test\n';
  for (let i = 0; i < pos.length; i += 9) {
    s += ' facet normal 0 0 0\n  outer loop\n';
    for (let k = 0; k < 9; k += 3) s += `   vertex ${pos[i + k]} ${pos[i + k + 1]} ${pos[i + k + 2]}\n`;
    s += '  endloop\n endfacet\n';
  }
  return new TextEncoder().encode(s + 'endsolid test\n').buffer;
}
// Minimal GLB: one mesh with two primitives (= two materials)
function glbTwoMaterials() {
  const pos = cube();
  const half = pos.length / 2;
  const bin = Buffer.from(new Float32Array(pos).buffer);
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }, { attributes: { POSITION: 1 }, material: 1 }] }],
    materials: [{ name: 'red', pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } }, { name: 'blue', pbrMetallicRoughness: { baseColorFactor: [0, 0, 1, 1] } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: half * 4 }, { buffer: 0, byteOffset: half * 4, byteLength: half * 4 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: half / 3, type: 'VEC3' }, { bufferView: 1, componentType: 5126, count: half / 3, type: 'VEC3' }]
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  const all = Buffer.concat([head, jh, js, bh, bin]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
}

// ---------------------------------------------------------------- checks
function signedVolume(m) {
  let v = 0;
  for (const f of m.F) { const [a, b, c] = f.map(i => m.V[i]); v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); }
  return v / 6;
}
function checkUnfolding(m, joined, o) {
  const cp = C.computePieces(m, joined);
  assert.equal(cp.bad.length, 0, 'inconsistent joined edges');
  const lmm = C.toMM(cp.local, o.scale);
  // every edge keeps its 3D length
  m.F.forEach((f, fi) => {
    for (let i = 0; i < 3; i++) {
      const a = m.V[f[i]], b = m.V[f[(i + 1) % 3]], p = cp.local[fi][i], q = cp.local[fi][(i + 1) % 3];
      const l3 = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), l2 = Math.hypot(p[0] - q[0], p[1] - q[1]);
      assert.ok(Math.abs(l3 - l2) < 1e-9 * Math.max(1, l3), 'edge length changed');
    }
  });
  assert.equal(C.selfOverlaps(cp, lmm).pairs.length, 0, 'pieces overlap themselves');
  const tl = C.layoutTabs(m, cp, lmm, joined, o);
  assert.equal(tl.conflicts.length, 0, 'glue tabs without room');
  for (const p of cp.pieces) assert.ok(C.fitsRect(C.hull(C.pieceOutlinePts(p, lmm, m, tl)), o.W, o.H), 'piece larger than the paper');
  return { cp, lmm, tl };
}
const opts = (m, size, W = 190, H = 277) => ({ scale: size / Math.max(...m.size), W, H, tabH: 6, tabAngle: 45, minTab: 0.6, tries: 2, timeBudget: 2000 });

// ---------------------------------------------------------------- tests
test('binary and ASCII STL give the same mesh', () => {
  const pos = icosphere(1);
  const a = C.parseModel(stlBinary(pos), 'x.stl'), b = C.parseModel(stlAscii(pos), 'x.stl');
  assert.equal(a.pos.length, pos.length);
  assert.equal(b.pos.length, pos.length);
  assert.equal(C.buildMesh(a.pos).F.length, 80);
  assert.equal(C.buildMesh(b.pos).F.length, 80);
});

test('cube: closed, consistent and outward oriented', () => {
  const m = C.buildMesh(cube());
  assert.equal(m.V.length, 8); assert.equal(m.F.length, 12); assert.equal(m.E.length, 18);
  assert.ok(m.E.every(e => e.m), 'all edges manifold');
  assert.ok(signedVolume(m) > 0, 'normals point outward');
  assert.equal(m.E.filter(e => e.flat).length, 6, 'six diagonal edges are flat');
});

test('inconsistent triangle winding is repaired', () => {
  const pos = icosphere(1);
  for (let t = 0; t < pos.length / 9; t += 2) for (let k = 0; k < 3; k++) { const i = t * 9 + 3 + k, j = t * 9 + 6 + k; [pos[i], pos[j]] = [pos[j], pos[i]]; }
  const m = C.buildMesh(pos);
  assert.ok(m.E.every(e => e.m));
  assert.ok(signedVolume(m) > 0);
});

for (const [name, pos, size] of [['cube', cube(), 80], ['house', house(), 120], ['cylinder', cylinder(), 150], ['icosphere', icosphere(2), 140]]) {
  test(`automatic unfolding of a ${name} is valid`, () => {
    const m = C.buildMesh(pos);
    const o = opts(m, size);
    const joined = C.autoPipeline(m, o);
    const { cp } = checkUnfolding(m, joined, o);
    assert.ok(cp.pieces.length >= 1);
    assert.ok(cp.pieces.length < m.F.length / 2, `too many pieces (${cp.pieces.length})`);
  });
}

test('a large model is split so every piece fits on A4', () => {
  const m = C.buildMesh(icosphere(2));
  const o = opts(m, 400);
  const joined = C.autoPipeline(m, o);
  const { cp } = checkUnfolding(m, joined, o);
  assert.ok(cp.pieces.length > 1);
});

test('nesting places pieces without overlap inside the page', () => {
  const m = C.buildMesh(icosphere(2));
  const o = opts(m, 140);
  const joined = C.autoPipeline(m, o);
  const cp = C.computePieces(m, joined), lmm = C.toMM(cp.local, o.scale), tl = C.layoutTabs(m, cp, lmm, joined, o);
  const items = cp.pieces.map(p => ({ id: p.id, polys: p.faces.map(f => lmm[f]).concat(p.faces.flatMap(f => m.FE[f].filter(e => tl.tabFace[e] === f).map(e => tl.tabs[e].poly))) }));
  const r = C.nestLayout(items, o.W, o.H, { gap: 2, cell: 1, angleStep: 30 });
  assert.equal(r.placements.length, items.length);
  const rot = (q, d) => { const a = d * Math.PI / 180; return [Math.cos(a) * q[0] - Math.sin(a) * q[1], Math.sin(a) * q[0] + Math.cos(a) * q[1]]; };
  const placed = r.placements.map(pl => ({ pl, polys: items.find(i => i.id === pl.id).polys.map(P => P.map(q => { const w = rot(q, pl.deg); return [w[0] + pl.x, w[1] + pl.y]; })) }));
  for (const a of placed) for (const P of a.polys) for (const q of P) {
    assert.ok(q[0] > -0.01 && q[1] > -0.01 && q[0] < o.W + 0.01 && q[1] < o.H + 0.01, 'outside the printable area');
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    if (placed[i].pl.page !== placed[j].pl.page) continue;
    for (const P of placed[i].polys) for (const Q of placed[j].polys) assert.ok(!C.polyOverlap(P, Q), 'pieces overlap');
  }
});

test('GLB: materials become per-face colors', () => {
  const d = C.parseModel(glbTwoMaterials(), 'x.glb');
  assert.equal(d.materials.length, 2);
  assert.deepEqual(d.materials[0].color, [255, 0, 0]);
  assert.equal(d.faceMat.length, 12);
  assert.equal(new Set(d.faceMat).size, 2);
});

test('OBJ with materials and polygons', () => {
  const obj = 'v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1\nusemtl a\nf 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nusemtl b\nf 3 4 8 7\nf 2 3 7 6\nf 4 1 5 8\n';
  const d = C.parseModel(new TextEncoder().encode(obj).buffer, 'x.obj');
  assert.equal(d.pos.length / 9, 12);
  assert.equal(d.materials.length, 2);
  assert.equal(C.buildMesh(d.pos).E.filter(e => !e.m).length, 0);
});

test('invalid input gives a clear error', () => {
  assert.throws(() => C.parseModel(new TextEncoder().encode('hello').buffer, 'x.stl'), /STL/);
  assert.throws(() => C.parseModel(new ArrayBuffer(20), 'x.glb'), /GLB/);
});

test('simplify: fewer triangles, still closed, colour borders kept, deterministic', () => {
  const pos = icosphere(5); // 20480 triangles
  const n = pos.length / 9;
  const key = new Int32Array(n).map((_, t) => (pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8]) > 0 ? 1 : 0);
  const r = C.simplifyMesh(pos, 600, key);
  const m = C.buildMesh(r.pos);
  assert.ok(m.F.length <= 600 && m.F.length > 500, `got ${m.F.length} triangles`);
  assert.equal(m.E.filter(e => !e.m).length, 0, 'mesh stays closed');
  assert.ok(signedVolume(m) > 0);
  for (const v of m.V) assert.ok(Math.abs(Math.hypot(...v) - 1) < 0.03, 'shape kept');
  // the border between the two materials stays on the equator
  const orig = C.buildMesh(pos);
  let bz0 = 0; for (const e of orig.E) if (key[orig.src[e.f[0]]] !== key[orig.src[e.f[1]]]) for (const v of e.v) bz0 = Math.max(bz0, Math.abs(orig.V[v][2]));
  for (const e of m.E) if (key[r.src[m.src[e.f[0]]]] !== key[r.src[m.src[e.f[1]]]]) for (const v of e.v) assert.ok(Math.abs(m.V[v][2]) <= bz0 + 1e-3, `colour border moved: ${Math.abs(m.V[v][2])} > ${bz0}`);
  // same input, same output (projects rebuild the simplified mesh when opened)
  assert.deepEqual(C.simplifyMesh(pos, 600, key).pos, r.pos);
  // and the result unfolds
  const o = opts(m, 150);
  checkUnfolding(m, C.autoPipeline(m, o), o);
});

test('sharp folds are cut, gentle folds stay joined', () => {
  // house: the walls meet at 90°, the roof ridge folds less
  const m = C.buildMesh(house());
  const o = { ...opts(m, 150), sharpDeg: 60 };
  const joined = C.autoPipeline(m, o);
  checkUnfolding(m, joined, o);
  const sharp = C.sharpEdges(m, 60);
  m.E.forEach((E, e) => { if (sharp[e]) assert.equal(joined[e], 0, 'sharp edge joined'); });
  assert.ok(sharp.some(x => x) && sharp.some((x, e) => !x && m.E[e].m && !m.E[e].flat), 'test needs both kinds of folds');
  // a cylinder (30° between the sides) is not affected
  const c = C.buildMesh(cylinder(12));
  const oc = { ...opts(c, 150), sharpDeg: 60 };
  const jc = C.autoPipeline(c, oc);
  checkUnfolding(c, jc, oc);
  assert.ok(C.computePieces(c, jc).pieces.length < 6);
});

test('a size limit gives smaller pieces that all fit', () => {
  const m = C.buildMesh(icosphere(2));
  const big = opts(m, 150), small = { ...big, W: 60, H: 60 };
  const nBig = C.computePieces(m, C.autoPipeline(m, big)).pieces.length;
  const js = C.autoPipeline(m, small);
  const { cp } = checkUnfolding(m, js, small);
  assert.ok(cp.pieces.length > nBig);
});

test('compact pieces: no long ragged pieces, still a valid unfolding', () => {
  const m = C.buildMesh(icosphere(2));
  const o = { ...opts(m, 150), isoMax: 4 };
  const { cp } = checkUnfolding(m, C.autoPipeline(m, o), o);
  const area = f => { const T = m.F[f]; const a = m.V[T[0]], b = m.V[T[1]], c = m.V[T[2]]; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };
  const joined = C.autoPipeline(m, o);
  for (const p of C.computePieces(m, joined).pieces) {
    if (p.faces.length <= 4) continue;
    let per = 0, A = 0;
    for (const f of p.faces) { A += area(f); for (const e of m.FE[f]) if (!joined[e]) per += m.E[e].len; }
    assert.ok(per * per / (4 * Math.PI * A) <= 4 + 1e-9, 'piece too ragged');
  }
  assert.ok(cp.pieces.length >= 2);
});

test('maximum faces per piece', () => {
  const m = C.buildMesh(icosphere(2));
  const o = { ...opts(m, 150), maxFaces: 8 };
  const joined = C.autoPipeline(m, o);
  const { cp } = checkUnfolding(m, joined, o);
  for (const p of cp.pieces) assert.ok(C.pieceFaceCount(m, joined, p.faces) <= 8, 'piece with too many faces');
  // and no fiddly pieces of only 1 or 2 faces
  assert.equal(cp.pieces.filter(p => C.pieceFaceCount(m, joined, p.faces) <= 2).length, 0, 'tiny pieces left');
  // a flat square of two triangles counts as one face
  const b = C.buildMesh(cube());
  const jb = C.autoPipeline(b, { ...opts(b, 100), maxFaces: 6 });
  const cb = C.computePieces(b, jb);
  assert.ok(cb.pieces.length === 1 || cb.pieces.every(p => C.pieceFaceCount(b, jb, p.faces) <= 6));
});

test('clean up thin faces: fewer slivers, same shape, still closed', () => {
  // a cube whose top face has an extra vertex very close to one of its edges: thin triangles
  const V = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], [0.5, 0.002, 1]];
  const tris = [[0, 2, 1], [0, 3, 2], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
    [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8]]; // top face as a fan around vertex 8 (near edge 4-5)
  const pos = Float32Array.from(tris.flatMap(t => t.flatMap(i => V[i])));
  const thin = m => m.F.filter(f => { const [a, b, c] = f.map(v => m.V[v]); const A2 = Math.hypot(...[0, 1, 2].map(k => (b[(k + 1) % 3] - a[(k + 1) % 3]) * (c[(k + 2) % 3] - a[(k + 2) % 3]) - (b[(k + 2) % 3] - a[(k + 2) % 3]) * (c[(k + 1) % 3] - a[(k + 1) % 3])));
    const L = Math.max(...[[a, b], [b, c], [c, a]].map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))); return A2 / L < 0.05; }).length;
  const before = C.buildMesh(pos);
  assert.ok(thin(before) > 0);
  const r = C.cleanMesh(pos, 0.05);
  const after = C.buildMesh(r.pos);
  assert.equal(thin(after), 0, 'thin faces left');
  assert.equal(after.E.filter(e => !e.m).length, 0, 'not closed');
  assert.ok(Math.abs(signedVolume(after) - 1) < 1e-3, 'shape changed');
  assert.equal(r.src.length, after.F.length);
  assert.deepEqual(C.cleanMesh(pos, 0.05).pos, r.pos); // deterministic
});

test('clean up thin faces: a sliver on a sharp edge along a colour border goes too', () => {
  // a cube with a thin bevel along top edge 4-5: vertex 8 sits just outside that edge, so triangle
  // 4-5-8 is a sliver between a colour border (top vs side) and two sharp folds
  const V = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], [0.5, -0.03, 0.97]];
  const tris = [[0, 2, 1], [0, 3, 2], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
    [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8]];
  const key = tris.map((t, i) => (i >= 10 ? 1 : 0)); // the top fan (with the sliver) has another colour
  const pos = Float32Array.from(tris.flatMap(t => t.flatMap(i => V[i])));
  const minH = m => Math.min(...m.F.map(f => { const [a, b, c] = f.map(v => m.V[v]); const u = [0, 1, 2].map(k => b[k] - a[k]), w = [0, 1, 2].map(k => c[k] - a[k]);
    const A2 = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
    return A2 / Math.max(...[[a, b], [b, c], [c, a]].map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))); }));
  assert.ok(minH(C.buildMesh(pos)) < 0.05);
  const r = C.cleanMesh(pos, 0.1, key);
  const after = C.buildMesh(r.pos);
  assert.ok(minH(after) >= 0.1, 'sliver left: ' + minH(after));
  assert.equal(after.E.filter(e => !e.m).length, 0, 'not closed');
  assert.ok(Math.abs(signedVolume(after) - signedVolume(C.buildMesh(pos))) < 0.02, 'shape changed too much');
  // the old clean-up (projects saved before) leaves the mesh as it was
  assert.ok(minH(C.buildMesh(C.cleanMesh(pos, 0.1, key, undefined, 1).pos)) < 0.05);
});

test('zipper: equal parts as long as possible up to the maximum, never below the minimum', () => {
  const s = { max: 20, min: 10 };
  assert.equal(C.zipParts(19, s), 0, 'shorter than twice the minimum: no zipper');
  assert.equal(C.zipParts(25, s), 2);
  assert.equal(C.zipParts(60, s), 3);
  assert.equal(C.zipParts(61, s), 4);
  for (let L = 20; L < 300; L += 0.7) { const n = C.zipParts(L, s); assert.ok(n >= 2 && L / n <= 20 + 1e-9 && L / n >= 10 - 1e-9, 'L ' + L); }
  assert.equal(C.zipParts(25, { max: 20, min: 15 }), 0, 'two parts of 12.5 mm are too short');
  assert.equal(C.zipParts(31, 15), 2, 'a number keeps the old rule');
});
