// Simplifying large models, projects, loading a model
// ---------------------------------------------------------------- vereenvoudigen (modellen met veel driehoeken)
const SIMPLIFY_ABOVE = 2000, SLOW_ABOVE = 10000;
const fmtN = n => n.toLocaleString(S.set.lang === 'nl' ? 'nl-NL' : 'en-US');
function simplifiedData(full, target) {
  const r = Core.simplifyMesh(full.pos, target, full.faceMat || null);
  const d = { ...full, pos: r.pos };
  if (full.faceMat) d.faceMat = Array.from(r.src, t => full.faceMat[t]);
  if (full.faceUV) {
    const uv = new Float32Array(r.src.length * 2);
    r.src.forEach((t, i) => { uv[2 * i] = full.faceUV[2 * t]; uv[2 * i + 1] = full.faceUV[2 * t + 1]; });
    d.faceUV = uv;
  }
  return d;
}
// Dialog with a slider; the 3D view shows a live preview. Resolves to the target (0 = original)
// or null (cancelled, only from the menu).
function askSimplify(full, n, cur, fromMenu) {
  return new Promise(resolve => {
    const dlg = $('simpDlg'), rng = $('simpRange'), num = $('simpNum');
    const lo = Math.min(100, n), hi = Math.max(lo + 1, Math.min(n, 20000));
    const toT = x => Math.max(lo, Math.round(Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * x / 1000) / 10) * 10);
    const toX = t => Math.round(1000 * (Math.log(t) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
    const old = { mesh: S.mesh, cp: S.cp, maxDim: S.maxDim, scale: S.scale };
    let t = cur || Math.min(1000, Math.round(n / 20) * 10), timer = 0, shown = -1;
    $('simpInfo').textContent = tr('This model has {n} triangles.', { n: fmtN(n) });
    const warn = [];
    if (n > SLOW_ABOVE) warn.push(tr('Unfolding the original can take several minutes and gives hundreds of tiny pieces.'));
    if (fromMenu) warn.push(tr('Your cuts, moved pieces and painted colors will be reset.'));
    $('simpWarn').textContent = warn.join(' ');
    $('simpCancel').hidden = !fromMenu;
    $('empty').style.display = 'none';
    const preview = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (shown === t) return; shown = t;
        const d = simplifiedData(full, t), m = Core.buildMesh(meshPos(d.pos), S.set.flatDeg);
        S.mesh = m; S.cp = null; S.maxDim = Math.max(...m.size); S.scale = S.set.size / S.maxDim;
        setup3D();
        if (d.materials && d.faceMat) {
          const col = meshObj.geometry.attributes.color, c = new THREE.Color();
          m.src.forEach((tt, f) => {
            const mc = (d.materials[d.faceMat[tt]] || { color: [220, 220, 220] }).color;
            c.setRGB(mc[0] / 255, mc[1] / 255, mc[2] / 255, THREE.SRGBColorSpace);
            for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, c.r, c.g, c.b);
          });
          col.needsUpdate = true;
        }
        req3();
        $('simpStat').textContent = tr('Preview in the 3D view: {t} triangles', { t: fmtN(m.F.length) });
      }, 120);
    };
    const set = (v, fromRange) => {
      t = Math.max(Math.min(lo, 4), Math.min(n, Math.round(v) || lo));
      if (!fromRange) rng.value = toX(Math.max(lo, t));
      num.value = t; preview();
    };
    rng.oninput = () => set(toT(+rng.value), true);
    num.onchange = () => set(+num.value);
    const finish = v => {
      clearTimeout(timer); dlg.close();
      rng.oninput = num.onchange = dlg.oncancel = null;
      if (fromMenu && (v === null || v === cur)) {
        Object.assign(S, old); setup3D(); refresh(); v = null;
      }
      resolve(v);
    };
    $('simpOk').onclick = () => finish(t);
    $('simpKeep').onclick = () => finish(0);
    $('simpCancel').onclick = () => finish(null);
    dlg.oncancel = e => { e.preventDefault(); if (fromMenu) finish(null); };
    num.max = n;
    set(t);
    dlg.showModal();
  });
}
async function openSimplify() {
  if (!S.full) return;
  if (S.fullCount <= 150) return toast(tr('This model is already simple enough.'));
  const v = await askSimplify(S.full, S.fullCount, S.simplify, true);
  if (v === null) return;
  S.simplify = v;
  S.cleanTol = cleanTolFor(v ? simplifiedData(S.full, v) : S.full);
  S.cleanVer = 2;
  await loadModel(modelData(), S.name, null);
}
// Settings saved by older versions (in the browser or in a project)
function fixOldSettings(set) {
  if (set.tabStyle === 'fin') set.tabStyle = 'pair'; // "tab and flap" was removed
  if (!['glue', 'pair', 'zip'].includes(set.tabStyle)) set.tabStyle = 'glue'; // removed options
}
async function loadProject(p) {
  if (!p || p.app !== 'papercraft') throw new Error(tr('Not a papercraft project'));
  S.set = { ...DEF, ...p.set };
  fixOldSettings(S.set);
  if (p.set && p.set.thinMM === undefined) S.set.thinMM = 0; // older project: its mesh was not cleaned up
  syncSide(); saveSettings();
  await loadModelBuffer(b64ToBuf(p.file), p.name, p);
}
function projectData() {
  const p = { app: 'papercraft', v: 1, appVersion: APP_VERSION, name: S.name, file: S.fileB64, simplify: S.simplify || 0, cleanTol: S.cleanTol || 0, cleanVer: S.cleanVer || 2, objScale: S.objScale || {}, colorPaper: S.colorPaper || {}, set: S.set, joined: Array.from(S.joined), tabUser: Array.from(S.tabUser), world: Array.from(S.world || []), manual: S.manual,
    paint: S.faceMat && S.faceColor ? { materials: S.model.materials, faceMat: S.faceMat, faceColor: S.faceColor } : null };
  return p;
}
function saveProject() {
  if (!S.mesh) return;
  download(baseName() + '.papercraft.json', JSON.stringify(projectData()), 'application/json');
}

async function faceColors(data, m) {
  if (!data.materials || !data.faceMat) return null;
  const imgs = [];
  if (data.images && data.images.length && typeof createImageBitmap === 'function') {
    for (const im of data.images) {
      try {
        const bmp = await createImageBitmap(new Blob([im.data], { type: im.mime }));
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
        imgs.push({ w: c.width, h: c.height, px: ctx.getImageData(0, 0, c.width, c.height).data });
      } catch (e) { imgs.push(null); }
    }
  }
  return m.src.map(t => {
    const mat = data.materials[data.faceMat[t]] || { color: [220, 220, 220] };
    let col = mat.color.slice();
    if (mat.texture !== undefined && data.textures) {
      const img = imgs[data.textures[mat.texture]];
      const u = data.faceUV[t * 2], v = data.faceUV[t * 2 + 1];
      if (img && isFinite(u)) {
        const x = Math.min(img.w - 1, Math.floor((u - Math.floor(u)) * img.w)), y = Math.min(img.h - 1, Math.floor((v - Math.floor(v)) * img.h));
        const o = (y * img.w + x) * 4, f = mat.factor || [1, 1, 1];
        col = [0, 1, 2].map(k => Math.round(img.px[o + k] * Math.pow(f[k], 1 / 2.2)));
      }
    }
    return col;
  });
}

// The pattern is unfolded from this mesh. With the printed side on the inside, the mesh is the
// mirror image: its pieces, printed on top and folded with the print inwards, build the real model.
// The 3D view mirrors it back (see MX), so the model on screen still looks the right way round.
function meshPos(pos) {
  const q = Float32Array.from(pos);
  if (S.set.printedInside) for (let i = 0; i < q.length; i += 3) q[i] = -q[i];
  return q;
}
// Rebuild the mesh after switching the printed side. The edge and face numbering stay the same
// (edges are numbered before the faces are oriented), so cuts, glue tab sides and colors are kept.
async function rebuildMeshSide() {
  if (rebuildMesh()) { refresh(); fitView(); } else await runAuto(true);
}
// Build the mesh again from S.model. Returns true when the edge and face numbering stayed the
// same (cuts, glue tab sides and colors are kept); otherwise those are reset for a new unfolding.
function rebuildMesh() {
  const old = S.mesh, keepE = old.E.map(e => e.v.join());
  const m = Core.buildMesh(meshPos(S.model.pos), S.set.flatDeg);
  const same = m.E.length === keepE.length && m.F.length === old.F.length && m.E.every((e, i) => e.v.join() === keepE[i]);
  S.mesh = m; S.cp = null; S.world = null;
  applyMirror3(); setup3D();
  if (!same) { S.tabUser = new Int8Array(m.E.length).fill(-1); S.joined = new Uint8Array(m.E.length); S.manual = false; }
  return same;
}
// Fold type as seen from the printed side
const foldType = convex => (convex !== !!S.set.printedInside ? 'm' : 'v');

async function loadModel(data, name, proj) {
  const m = Core.buildMesh(meshPos(data.pos), S.set.flatDeg);
  if (!m.F.length) throw new Error(tr('No triangles found'));
  S.model = data; S.name = name; S.mesh = m;
  applyMirror3();
  S.maxDim = (S.basePos && hasObjScale() && baseMaxDim()) || Math.max(...m.size); S.scale = S.set.size / S.maxDim;
  S.selObject = -1;
  syncSide();
  S.faceMat = data.faceMat ? m.src.map(t => data.faceMat[t]) : null;
  S.colorPaper = proj && proj.colorPaper ? { ...proj.colorPaper } : {};
  S.faceColor = await faceColors(data, m);
  if (proj && proj.paint && proj.paint.faceMat && proj.paint.faceMat.length === m.F.length) {
    data.materials = proj.paint.materials; S.faceMat = proj.paint.faceMat.slice(); S.faceColor = proj.paint.faceColor.map(c => c.slice());
  }
  S.paint = false; S.brush = 0;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  if (S.tool === 'paint' || S.tool === 'object') { S.tool = 'select'; $('objPanel').classList.remove('show'); }
  S.undo = []; S.redo = []; S.selFace = -1; S.hover = -1; S.cp = null;
  $('empty').style.display = 'none';
  $('cap2d').textContent = tr('Pattern') + ' · ' + name;
  $('fname').textContent = name;
  document.title = name + ' · Papercraft Pattern Maker';
  showMaterials();
  $('view3d').value = S.faceColor ? 'material' : 'pieces';
  setup3D();
  const open = m.E.filter(e => !e.m).length;
  if (open) toast(tr('Note: {n} open or non-manifold edges (orange). These get no glue tab.', { n: open }), 5000);
  if (proj) {
    S.joined = Uint8Array.from(proj.joined); S.tabUser = Int8Array.from(proj.tabUser);
    S.world = proj.world && proj.world.length === m.F.length * 6 ? Float64Array.from(proj.world) : null;
    S.manual = !!proj.manual;
    refresh(); fitView();
  } else {
    S.tabUser = new Int8Array(m.E.length).fill(-1);
    S.joined = new Uint8Array(m.E.length);
    S.world = null; S.manual = false;
    await runAuto(true);
  }
}
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
const unhex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
