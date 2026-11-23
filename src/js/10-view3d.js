// 3D view
// ---------------------------------------------------------------- 3D
const v3 = $('v3d');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
v3.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f7f9);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8090a0, 1.9));
const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(0.5, 1, 2); camera.add(dl); scene.add(camera);
// All model objects live in model3. "Mirror" only flips this group on screen: the mesh, the
// unfolding and the pattern stay exactly the same.
const model3 = new THREE.Group(); scene.add(model3);
const MX = () => (S.set.mirror3d ? -1 : 1) * (S.set.printedInside ? -1 : 1);
function applyMirror3() { model3.scale.x = MX(); model3.updateMatrixWorld(true); req3(); }
let meshObj = null, foldObj = null, cutObj = null, hlObj = null;
const cutMat = new LineMaterial({ color: 0xffffff, linewidth: 2, vertexColors: true, worldUnits: false });
const selMat = new LineMaterial({ color: 0x1d4ed8, linewidth: 4.5, worldUnits: false });
const hlMat = new LineMaterial({ color: 0xffa000, linewidth: 5, worldUnits: false, depthTest: false, transparent: true });
// lines must also be drawn when the 3D view is mirrored (mirroring reverses the winding)
for (const lm of [cutMat, selMat, hlMat]) lm.side = THREE.DoubleSide;
const center = new THREE.Vector3();
function resize3() { const w = v3.clientWidth, h = v3.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); cutMat.resolution.set(w, h); hlMat.resolution.set(w, h); selMat.resolution.set(w, h); req3(); }
new ResizeObserver(resize3).observe(v3);
// alleen tekenen als er iets veranderd is (spaart rekenkracht)
let need3 = true;
const req3 = () => { need3 = true; };
controls.addEventListener('change', req3);
renderer.setAnimationLoop(() => {
  if (camTween) {
    const k = Math.min(1, (performance.now() - camTween.t0) / 450), e = k * k * (3 - 2 * k);
    const dir = camTween.from.clone().lerp(camTween.to, e);
    if (dir.lengthSq() < 1e-6) dir.copy(camTween.to);
    camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(camTween.dist));
    camera.lookAt(controls.target);
    if (k >= 1) camTween = null;
    need3 = true;
  }
  const moved = controls.update();
  if (!need3 && !moved) return;
  need3 = false;
  updateDims(); updatePieceLabels3D(); renderer.render(scene, camera);
});

// stuknummers in 3D (HTML-labels op het grootste vlak van elk stuk)
let pnLabels = [];
function buildPieceLabels3D() {
  const box = $('pnums'); if (!box) return;
  pnLabels = [];
  if (!S.cp || !S.pieceNo) { box.innerHTML = ''; return; }
  const m = S.mesh;
  let h = '';
  for (const p of S.cp.pieces) {
    const np = p.d && p.d.numPos; if (!np) continue;
    const F = m.F[np.f].map(i => m.V[i]);
    const pos = new THREE.Vector3(
      np.w[0] * F[0][0] + np.w[1] * F[1][0] + np.w[2] * F[2][0] - center.x,
      np.w[0] * F[0][1] + np.w[1] * F[1][1] + np.w[2] * F[2][1] - center.y,
      np.w[0] * F[0][2] + np.w[1] * F[1][2] + np.w[2] * F[2][2] - center.z);
    pnLabels.push({ pid: p.id, pos, nrm: new THREE.Vector3(...m.N[np.f]) });
    h += `<div class="pn" data-p="${p.id}">${S.pieceNo[p.id]}</div>`;
  }
  box.innerHTML = h;
  pnLabels.forEach((l, i) => l.el = box.children[i]);
  req3();
}
function updatePieceLabels3D() {
  const show = $('showPNums').checked && S.cp;
  const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3(), cam = new THREE.Vector3();
  const selP = S.selFace >= 0 && S.cp ? S.cp.pieceOf[S.selFace] : -1;
  for (const l of pnLabels) {
    if (!show) { l.el.style.display = 'none'; continue; }
    const mx = MX();
    cam.copy(camera.position); cam.x *= mx; cam.sub(l.pos); // camera in model coordinates
    const sel = l.pid === selP;
    if (!sel && cam.dot(l.nrm) <= 0) { l.el.style.display = 'none'; continue; } // achterkant
    v.copy(l.pos);
    if (OFF3 && OFF3[l.pid]) { const o = OFF3[l.pid]; v.x += o[0]; v.y += o[1]; v.z += o[2]; }
    v.x *= mx; v.project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block';
    l.el.classList.toggle('sel', sel);
    l.el.style.left = ((v.x + 1) / 2 * r.width) + 'px';
    l.el.style.top = ((1 - v.y) / 2 * r.height) + 'px';
  }
}
// maatvoering in 3D: kader + X/Y/Z-maten
let boxObj = null, dimObj = null;
const DIMCOL = [0xdc2626, 0x16a34a, 0x2563eb];
function setupDims() {
  if (boxObj) { model3.remove(boxObj); boxObj.geometry.dispose(); }
  if (!dimObj) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    const c = new Float32Array(18), col = new THREE.Color();
    DIMCOL.forEach((h, i) => { col.setHex(h); for (let k = 0; k < 2; k++) c.set([col.r, col.g, col.b], (i * 2 + k) * 3); });
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    dimObj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    dimObj.renderOrder = 9; model3.add(dimObj);
  }
  const s = S.mesh.size;
  boxObj = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(s[0] || 1e-6, s[1] || 1e-6, s[2] || 1e-6)), new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 }));
  model3.add(boxObj);
}
function updateDims() {
  const show = S.mesh && $('showDims').checked;
  if (boxObj) boxObj.visible = !!show;
  if (dimObj) dimObj.visible = !!show;
  if (!show) { for (let i = 0; i < 3; i++) $('dim' + i).style.display = 'none'; return; }
  const h = S.mesh.size.map(v => v / 2), cp = camera.position;
  const sx = cp.x * MX() >= 0 ? 1 : -1, sy = cp.y >= 0 ? 1 : -1, z0 = -h[2];
  const E = [
    [[-h[0], sy * h[1], z0], [h[0], sy * h[1], z0]],
    [[sx * h[0], -h[1], z0], [sx * h[0], h[1], z0]],
    [[sx * h[0], -sy * h[1], -h[2]], [sx * h[0], -sy * h[1], h[2]]]
  ];
  const pos = dimObj.geometry.attributes.position;
  E.forEach((e, i) => { pos.setXYZ(i * 2, ...e[0]); pos.setXYZ(i * 2 + 1, ...e[1]); });
  pos.needsUpdate = true;
  const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3();
  E.forEach((e, i) => {
    const el = $('dim' + i);
    v.set(MX() * (e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2, (e[0][2] + e[1][2]) / 2).project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { el.style.display = 'none'; return; }
    const mm = S.mesh.size[i] * S.scale;
    el.textContent = 'XYZ'[i] + ' ' + (mm >= 100 ? Math.round(mm) : Math.round(mm * 10) / 10) + ' mm';
    el.style.display = 'block';
    el.style.left = ((v.x + 1) / 2 * r.width) + 'px';
    el.style.top = ((1 - v.y) / 2 * r.height) + 'px';
  });
}

function disposeObj(o) { if (!o) return; model3.remove(o); o.geometry.dispose(); if (o.material !== cutMat) o.material.dispose(); }
function setup3D() {
  [meshObj, foldObj, cutObj].forEach(disposeObj); meshObj = foldObj = cutObj = null; G3 = null;
  const m = S.mesh;
  center.set((m.mn[0] + m.mx[0]) / 2, (m.mn[1] + m.mx[1]) / 2, (m.mn[2] + m.mx[2]) / 2);
  const pos = new Float32Array(m.F.length * 9);
  m.F.forEach((f, i) => { for (let k = 0; k < 3; k++) { const v = m.V[f[k]]; pos[i * 9 + k * 3] = v[0] - center.x; pos[i * 9 + k * 3 + 1] = v[1] - center.y; pos[i * 9 + k * 3 + 2] = v[2] - center.z; } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  g.computeVertexNormals();
  meshObj = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  model3.add(meshObj);
  if (!hlObj) { hlObj = new LineSegments2(new LineSegmentsGeometry(), hlMat); hlObj.renderOrder = 10; model3.add(hlObj); }
  hlObj.visible = false;
  setupDims();
  fit3();
}
function fit3() {
  if (!S.mesh) return;
  const d = S.mesh.diag;
  camera.near = d / 500; camera.far = d * 50;
  const dist = 0.55 * d / Math.tan(camera.fov * Math.PI / 360) / Math.min(1, camera.aspect || 1);
  const dir = new THREE.Vector3(0.6, -0.85, 0.5).normalize();
  camera.position.copy(dir.multiplyScalar(dist));
  controls.target.set(0, 0, 0); camera.updateProjectionMatrix(); controls.update();
}
function pieceColor(pid, sel) {
  const root = S.cp.pieces[pid].root;
  return new THREE.Color().setHSL((root * 0.618034) % 1, sel ? 0.8 : 0.5, sel ? 0.6 : 0.72);
}
function update3DColors() {
  if (!meshObj || !S.cp) return;
  const col = meshObj.geometry.attributes.color, mode = $('view3d').value;
  const selP = S.selFace >= 0 ? S.cp.pieceOf[S.selFace] : -1;
  const c = new THREE.Color();
  const cache = new Map();
  for (let f = 0; f < S.mesh.F.length; f++) {
    const pid = S.cp.pieceOf[f];
    if (S.tool === 'object') { // objects: the selected one in its colours, the rest faded
      if (S.faceColor) { const fc = S.faceColor[f]; c.setRGB(fc[0] / 255, fc[1] / 255, fc[2] / 255, THREE.SRGBColorSpace); } else c.set(0x9db8e8);
      if (S.selObject >= 0 && objIds().of[f] !== S.selObject) c.lerp(WHITE, 0.8);
    } else if (mode === 'material' && S.faceColor) {
      const fc = S.faceColor[f]; c.setRGB(fc[0] / 255, fc[1] / 255, fc[2] / 255, THREE.SRGBColorSpace);
      if (selP >= 0 && pid !== selP) c.lerp(WHITE, 0.82);
    } else {
      if (!cache.has(pid)) cache.set(pid, pieceColor(pid, pid === selP));
      c.copy(cache.get(pid));
      if (selP >= 0 && pid !== selP) c.lerp(WHITE, 0.8);
    }
    for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, c.r, c.g, c.b);
  }
  col.needsUpdate = true; req3();
  updateSelOutline(selP);
}
const WHITE = new THREE.Color(0xffffff);
let selObj = null;
// dikke blauwe omtrek rond het geselecteerde stuk
function updateSelOutline(selP) {
  if (selObj) { model3.remove(selObj); selObj.geometry.dispose(); selObj = null; }
  cutMat.opacity = selP >= 0 ? 0.35 : 1; cutMat.transparent = selP >= 0;
  if (selP < 0 || !S.cp || !S.cp.pieces[selP]) return;
  const m = S.mesh, inP = new Set(S.cp.pieces[selP].faces), pos = [];
  for (const f of inP) for (const e of m.FE[f]) {
    const E = m.E[e];
    const inner = E.m && S.joined[e] && inP.has(Core.otherFace(E, f));
    if (inner) continue;
    for (const v of E.v) G3 ? corner3(f, v, pos) : pos.push(m.V[v][0] - center.x, m.V[v][1] - center.y, m.V[v][2] - center.z);
  }
  if (!pos.length) return;
  const g = new LineSegmentsGeometry(); g.setPositions(pos);
  selObj = new LineSegments2(g, selMat); selObj.renderOrder = 8;
  model3.add(selObj); req3();
}
// draai de camera zodat het geselecteerde stuk naar de kijker wijst
let camTween = null;
function focusPiece3D() {
  if (S.selFace < 0 || !S.cp || !meshObj) return;
  const m = S.mesh, p = S.cp.pieces[S.cp.pieceOf[S.selFace]];
  const n = new THREE.Vector3(), c = new THREE.Vector3();
  let A = 0;
  for (const f of p.faces) {
    const [a, b, d] = m.F[f].map(i => m.V[i]);
    const u = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), w = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const cr = u.cross(w), ar = cr.length() / 2;
    n.add(cr.multiplyScalar(0.5));
    c.add(new THREE.Vector3((a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3).multiplyScalar(ar));
    A += ar;
  }
  if (A <= 0) return;
  c.multiplyScalar(1 / A).sub(center);
  // stukken die rondom gaan: kijk vanaf het zwaartepunt naar buiten
  if (n.length() < 0.25 * A) n.copy(c);
  if (n.lengthSq() < 1e-12) return;
  n.normalize();
  const dist = camera.position.distanceTo(controls.target);
  camTween = { t0: performance.now(), from: camera.position.clone().sub(controls.target).normalize(), to: n, dist };
  req3();
}
// 3D corner positions per face (centred). With "Gaps", every corner on the edge of its piece moves
// a little into its own piece, so a gap opens along each cut. All faces of a piece share the same
// displacement for a vertex, so the piece itself stays closed.
// "Exploded": every piece moves as a whole away from the model, along its average outward
// normal (or away from the centre when the piece wraps around). OFF3[pid] is that offset.
let G3 = null, OFF3 = null;
const split3 = () => (S.cp ? S.set.split3d || 'none' : 'none');
function explodeOffsets() {
  // slider 50..100 % of the largest distance (1.5 % of the model diagonal)
  const m = S.mesh, cp = S.cp, dist = m.diag * 0.015 * (S.set.explodeAmt || 75) / 100;
  const mc = [(m.mn[0] + m.mx[0]) / 2, (m.mn[1] + m.mx[1]) / 2, (m.mn[2] + m.mx[2]) / 2];
  return cp.pieces.map(p => {
    const n = [0, 0, 0], c = [0, 0, 0]; let A = 0;
    for (const f of p.faces) {
      const T = m.F[f], a = m.V[T[0]], b = m.V[T[1]], d = m.V[T[2]];
      const ar = Math.hypot(...[0, 1, 2].map(k => ((b[(k + 1) % 3] - a[(k + 1) % 3]) * (d[(k + 2) % 3] - a[(k + 2) % 3]) - (b[(k + 2) % 3] - a[(k + 2) % 3]) * (d[(k + 1) % 3] - a[(k + 1) % 3])))) / 2;
      A += ar;
      for (let k = 0; k < 3; k++) { n[k] += m.N[f][k] * ar; c[k] += (a[k] + b[k] + d[k]) / 3 * ar; }
    }
    if (!(A > 0)) return [0, 0, 0];
    let dir = n.map(x => x / A);
    if (Math.hypot(...dir) < 0.35) dir = c.map((x, k) => x / A - mc[k]);
    const l = Math.hypot(...dir) || 1;
    return dir.map(x => x / l * dist);
  });
}
function gapPositions() {
  const m = S.mesh, nF = m.F.length, out = new Float32Array(nF * 9);
  const gap = split3() === 'gaps' ? m.diag * 0.006 : 0;
  OFF3 = split3() === 'explode' ? explodeOffsets() : null;
  const disp = new Map();
  if (gap) {
    const pof = S.cp.pieceOf, nV = m.V.length, acc = new Map(), edge = new Set(), lim = new Map();
    m.F.forEach((T, f) => {
      const p = pof[f], c = [0, 1, 2].map(k => (m.V[T[0]][k] + m.V[T[1]][k] + m.V[T[2]][k]) / 3);
      for (let k = 0; k < 3; k++) {
        const v = T[k], key = p * nV + v, V = m.V[v];
        const a = acc.get(key) || [0, 0, 0];
        a[0] += c[0] - V[0]; a[1] += c[1] - V[1]; a[2] += c[2] - V[2]; acc.set(key, a);
        // the two edges of this face at corner k
        for (const e of [m.FE[f][k], m.FE[f][(k + 2) % 3]]) {
          const E = m.E[e];
          if (!(E.m && S.joined[e] && pof[Core.otherFace(E, f)] === p)) edge.add(key);
          lim.set(key, Math.min(lim.has(key) ? lim.get(key) : Infinity, E.len * 0.3));
        }
      }
    });
    for (const key of edge) {
      const a = acc.get(key), l = Math.hypot(a[0], a[1], a[2]);
      if (l < 1e-12) continue;
      const d = Math.min(gap, lim.get(key)) / l;
      disp.set(key, [a[0] * d, a[1] * d, a[2] * d]);
    }
  }
  const nV = m.V.length;
  m.F.forEach((T, f) => {
    const p = S.cp ? S.cp.pieceOf[f] : 0;
    for (let k = 0; k < 3; k++) {
      const V = m.V[T[k]], d = OFF3 ? OFF3[p] : disp.get(p * nV + T[k]), o = f * 9 + k * 3;
      out[o] = V[0] - center.x + (d ? d[0] : 0); out[o + 1] = V[1] - center.y + (d ? d[1] : 0); out[o + 2] = V[2] - center.z + (d ? d[2] : 0);
    }
  });
  return out;
}
// position of vertex v as drawn on face f
function corner3(f, v, arr) {
  const k = S.mesh.F[f].indexOf(v), o = f * 9 + k * 3;
  arr.push(G3[o], G3[o + 1], G3[o + 2]);
}
function update3D() {
  if (!meshObj) return;
  const m = S.mesh;
  G3 = gapPositions();
  const pa = meshObj.geometry.attributes.position;
  pa.array.set(G3); pa.needsUpdate = true;
  meshObj.geometry.computeVertexNormals(); meshObj.geometry.computeBoundingSphere(); meshObj.geometry.computeBoundingBox();
  update3DColors();
  disposeObj(foldObj); disposeObj(cutObj);
  const fp = [], minBend = (+S.set.scoreMinDeg || 0) * Math.PI / 180; // nearly flat folds (Skip folds below) are not shown
  m.E.forEach((e, i) => {
    if (!(e.m && S.joined[i] && !e.flat) || e.bend < minBend) return;
    for (const v of e.v) corner3(e.f[0], v, fp);
  });
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  foldObj = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.55 }));
  model3.add(foldObj);
  const list = [];
  m.E.forEach((e, i) => { if (!e.m) list.push([i, 0xf59e0b]); else if (!S.joined[i]) list.push([i, 0xe11d48]); });
  // knip-randen als lijnen met vaste schermdikte (pixels), ongeacht zoom
  const cp = [], cc = [], col = new THREE.Color();
  list.forEach(([e, c]) => {
    const E = m.E[e];
    // with gaps: the cut is drawn along both pieces
    for (const f of (split3() !== 'none' ? E.f : E.f.slice(0, 1))) {
      for (const v of E.v) corner3(f, v, cp);
      col.setHex(c); cc.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
  });
  const cg = new LineSegmentsGeometry();
  if (cp.length) { cg.setPositions(cp); cg.setColors(cc); }
  cutObj = new LineSegments2(cg, cutMat);
  cutObj.visible = cp.length > 0;
  model3.add(cutObj);
  drawHover3D();
}
function drawHover3D() {
  if (!hlObj) return;
  const e = S.hover;
  req3();
  if (e < 0 || !S.mesh) { hlObj.visible = false; return; }
  const E = S.mesh.E[e], V = S.mesh.V;
  const hp = [];
  for (const v of E.v) G3 ? corner3(E.f[0], v, hp) : hp.push(V[v][0] - center.x, V[v][1] - center.y, V[v][2] - center.z);
  hlObj.geometry.setPositions(hp);
  hlObj.visible = true;
}
$('view3d').addEventListener('change', () => update3DColors());
$('showDims').addEventListener('change', req3);
$('mirror3d').checked = !!S.set.mirror3d; applyMirror3();
fixOldSettings(S.set);
if (!S.set.split3d) S.set.split3d = S.set.gaps3d ? 'gaps' : 'none';
if (!(S.set.explodeAmt >= 50 && S.set.explodeAmt <= 100)) S.set.explodeAmt = 75;
$('split3d').value = S.set.split3d; $('explode3d').value = S.set.explodeAmt; $('explode3d').hidden = S.set.split3d !== 'explode';
$('split3d').addEventListener('change', () => { S.set.split3d = $('split3d').value; $('explode3d').hidden = S.set.split3d !== 'explode'; saveSettings(); update3D(); });
$('explode3d').addEventListener('input', () => { S.set.explodeAmt = +$('explode3d').value; update3D(); });
$('explode3d').addEventListener('change', saveSettings);
$('mirror3d').addEventListener('change', () => { S.set.mirror3d = $('mirror3d').checked; saveSettings(); applyMirror3(); });
$('showPNums').addEventListener('change', req3);
$('bFit3').onclick = fit3;
document.querySelectorAll('#toolSeg [data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick3(ev) {
  if (!meshObj || !S.cp) return { face: -1, edge: -1 };
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(meshObj)[0];
  if (!hit) return { face: -1, edge: -1 };
  const f = hit.faceIndex, m = S.mesh;
  let best = -1, bd = 14;
  const px = v => { const p = new THREE.Vector3(MX() * (v[0] - center.x), v[1] - center.y, v[2] - center.z).project(camera); return [(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height]; };
  const mx = ev.clientX - r.left, my = ev.clientY - r.top;
  for (const e of m.FE[f]) {
    const E = m.E[e];
    if (E.m && E.flat && S.joined[e] && !ev.altKey) continue;
    const a = px(m.V[E.v[0]]), b = px(m.V[E.v[1]]);
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (my - a[1]) * dy) / l2));
    const dd = Math.hypot(a[0] + t * dx - mx, a[1] + t * dy - my);
    if (dd < bd) { bd = dd; best = e; }
  }
  return { face: f, edge: best };
}
let down3 = null;
let painting = null;
function paintAt(ev) { const p = pick3(ev); if (p.face >= 0 && paintFace(p.face)) { painting.changed = true; update3DColors(); } }
renderer.domElement.addEventListener('pointermove', ev => {
  if (S.paint) { if (painting && (ev.buttons & 1)) paintAt(ev); return; }
  if (ev.buttons || S.tool !== 'cut') return; setHover(pick3(ev).edge);
});
renderer.domElement.addEventListener('pointerleave', () => setHover(-1));
renderer.domElement.addEventListener('pointerdown', ev => {
  if (S.paint && ev.button === 0) { pushUndo(); painting = { changed: false }; paintAt(ev); return; }
  down3 = { x: ev.clientX, y: ev.clientY, b: ev.button };
});
renderer.domElement.addEventListener('pointerup', ev => {
  if (painting) { const c = painting.changed; painting = null; finishPaint(c); return; }
  if (!down3 || down3.b !== 0 || Math.hypot(ev.clientX - down3.x, ev.clientY - down3.y) > 5) { down3 = null; return; }
  down3 = null;
  const p = pick3(ev);
  if (S.tool === 'cut' && p.edge >= 0) { if (ev.shiftKey) flipTab(p.edge); else toggleEdge(p.edge); }
  else if (S.tool === 'object') { S.selObject = p.face >= 0 ? objIds().of[p.face] : -1; showObjects(); update3DColors(); }
  else if (p.face >= 0) selectPiece(p.face, true);
  else selectPiece(-1, true);
});

