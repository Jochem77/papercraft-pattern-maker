// Files, cleaning up thin faces, scaling separate objects
// ---------------------------------------------------------------- bestanden
function bufToB64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function b64ToBuf(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const baseName = () => (S.name || 'papercraft').replace(/\.[^.]+$/, '') + (RP ? '-' + tr('reprint') : '');

async function openFile(file) {
  try {
    const buf = await file.arrayBuffer();
    if (/\.(json|papercraft)$/i.test(file.name)) return loadProject(JSON.parse(new TextDecoder().decode(buf)));
    await loadModelBuffer(buf, file.name, null);
  } catch (err) { console.error(err); toast(tr('Could not open file: ') + err.message, 5000); busy(false); }
}
async function loadModelBuffer(buf, name, proj) {
  const full = Core.parseModel(buf, name);
  const n = Core.buildMesh(full.pos).F.length;
  let target = proj ? (proj.simplify || 0) : 0;
  if (!proj && n > SIMPLIFY_ABOVE) target = await askSimplify(full, n, 0, false);
  S.fileB64 = bufToB64(buf);
  S.full = full; S.fullCount = n; S.simplify = target;
  // a project brings its own clean-up tolerance (model units), so the same mesh comes back
  S.cleanTol = proj ? (proj.cleanTol || 0) : cleanTolFor(target ? simplifiedData(full, target) : full);
  S.cleanVer = proj ? (proj.cleanVer || 1) : 2; // the clean-up a project was made with
  S.objScale = proj && proj.objScale ? { ...proj.objScale } : {};
  await loadModel(modelData(), name, proj);
}
// ---------------------------------------------------------------- dunne vlakken opschonen
// The model as it is unfolded: the original, optionally simplified, then cleaned up.
function modelData() {
  const d = cleanedData(S.simplify ? simplifiedData(S.full, S.simplify) : S.full, S.cleanTol);
  S.basePos = d.pos; S.objIds = null;
  return hasObjScale() ? { ...d, pos: scaledPos() } : d;
}
// ---------------------------------------------------------------- losse objecten vergroten / verkleinen
// An object is a separate part of the model: faces connected by edges (welded like the mesh).
// They are numbered by their first face; S.objScale[number] = factor (1 = as loaded), scaled
// around the centre of the object's bounding box. The model size keeps meaning the model as loaded.
const hasObjScale = () => Object.values(S.objScale || {}).some(k => Math.abs(k - 1) > 1e-6);
function objIds() {
  if (S.objIds) return S.objIds;
  const m = Core.buildMesh(S.basePos), of = new Int32Array(m.F.length).fill(-1), size = [];
  for (let st = 0; st < m.F.length; st++) {
    if (of[st] >= 0) continue;
    const n = size.length, q = [st]; of[st] = n;
    for (let i = 0; i < q.length; i++) for (const e of m.FE[q[i]]) for (const g of m.E[e].f) if (of[g] < 0) { of[g] = n; q.push(g); }
    size.push(q.length);
  }
  S.objIds = { of, size, src: m.src };
  return S.objIds;
}
function scaledPos() {
  const { of, src, size } = objIds(), base = S.basePos, out = Float32Array.from(base);
  const lo = size.map(() => [Infinity, Infinity, Infinity]), hi = size.map(() => [-Infinity, -Infinity, -Infinity]);
  src.forEach((t, f) => { const c = of[f]; for (let j = 0; j < 9; j++) { const v = base[t * 9 + j], k = j % 3; if (v < lo[c][k]) lo[c][k] = v; if (v > hi[c][k]) hi[c][k] = v; } });
  src.forEach((t, f) => {
    const c = of[f], k = S.objScale[c];
    if (!k || Math.abs(k - 1) < 1e-6) return;
    for (let j = 0; j < 9; j++) { const a = j % 3, mid = (lo[c][a] + hi[c][a]) / 2; out[t * 9 + j] = mid + (base[t * 9 + j] - mid) * k; }
  });
  return out;
}
function baseMaxDim() {
  const p = S.basePos; if (!p) return 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { const v = p[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
}
function showObjects() {
  const box = $('objs'); if (!box) return;
  if (!S.mesh || S.tool !== 'object') { box.innerHTML = ''; return; }
  const { size } = objIds(), order = size.map((n, i) => i).sort((a, b) => size[b] - size[a]);
  const pct = i => Math.round((S.objScale[i] || 1) * 100);
  let h = '';
  if (size.length < 2) h += `<div class="hint">${tr('This model is one connected object. Make all of it larger or smaller in Settings → Model.')}</div>`;
  for (const i of order) h += `<div class="row${i === S.selObject ? ' sel' : ''}" data-obj="${i}"><span class="nm">${tr('Object {n}', { n: i + 1 })} · ${fmtN(size[i])} △</span><input type="number" min="10" max="1000" step="5" value="${pct(i)}" data-obj="${i}" title="${tr('Size in %')}">%</div>`;
  h += `<div class="hint">${tr('Click an object in the 3D view or in this list. A new size unfolds the model again.')}</div>`;
  if (hasObjScale()) h += `<div class="matbtns"><button id="objReset">${tr('All at 100 %')}</button></div>`;
  box.innerHTML = h;
  box.querySelectorAll('.row').forEach(r => r.onclick = ev => { if (ev.target.tagName === 'INPUT') return; S.selObject = +r.dataset.obj; showObjects(); update3DColors(); });
  box.querySelectorAll('input').forEach(inp => {
    inp.onfocus = () => { if (S.selObject !== +inp.dataset.obj) { S.selObject = +inp.dataset.obj; box.querySelectorAll('.row').forEach(r => r.classList.toggle('sel', +r.dataset.obj === S.selObject)); update3DColors(); } };
    inp.onchange = () => { const v = Math.max(10, Math.min(1000, +inp.value || 100)); setObjScale({ [inp.dataset.obj]: v / 100 }); };
  });
  const rb = $('objReset'); if (rb) rb.onclick = () => { const all = {}; for (const k of Object.keys(S.objScale)) all[k] = 1; setObjScale(all); };
}
async function setObjScale(changes) {
  for (const [c, k] of Object.entries(changes)) { if (Math.abs(k - 1) < 1e-6) delete S.objScale[c]; else S.objScale[c] = k; }
  S.model = { ...S.model, pos: hasObjScale() ? scaledPos() : S.basePos };
  const same = rebuildMesh();
  if (S.manual) { refresh(); fitView(); warnRecut(); } else await runAuto(!same);
  showObjects(); update3DColors();
}
// "Clean up faces thinner than" (mm) in model units, for the model size that is set now.
function cleanTolFor(d) {
  const mm = +S.set.thinMM || 0; if (!(mm > 0)) return 0;
  const mnx = [Infinity, Infinity, Infinity], mxx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < d.pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = d.pos[i + k]; if (v < mnx[k]) mnx[k] = v; if (v > mxx[k]) mxx[k] = v; }
  const maxDim = Math.max(mxx[0] - mnx[0], mxx[1] - mnx[1], mxx[2] - mnx[2]) || 1;
  return mm * maxDim / S.set.size;
}
function cleanedData(d, tol) {
  S.cleanInfo = null;
  if (!(tol > 0)) return d;
  const r = Core.cleanMesh(d.pos, tol, d.faceMat || null, undefined, S.cleanVer || 2);
  S.cleanInfo = { removed: d.pos.length / 9 - r.pos.length / 9, collapsed: r.collapsed, flipped: r.flipped };
  const out = { ...d, pos: r.pos };
  if (d.faceMat) out.faceMat = Array.from(r.src, t => d.faceMat[t]);
  if (d.faceUV) { const uv = new Float32Array(r.src.length * 2); r.src.forEach((t, i) => { uv[2 * i] = d.faceUV[2 * t]; uv[2 * i + 1] = d.faceUV[2 * t + 1]; }); out.faceUV = uv; }
  return out;
}

