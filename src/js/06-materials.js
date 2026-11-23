// Materials, painting, tools, setting tooltips
function showMaterials() {
  const d = S.model; if (!d) return;
  const mats = d.materials;
  let h = '';
  if (!mats) h = `<div class="note">${tr('This model has no colors (STL): everything is white. Use 🖌 to add colors yourself.')}</div>`;
  else {
    const count = new Array(mats.length).fill(0);
    S.faceMat.forEach(i => count[i]++);
    h = mats.map((mt, i) => `<div class="row${S.paint && S.brush === i ? ' sel' : ''}" data-mat="${i}" title="${tr('Click to paint with this color')}"><input type="color" data-matcol="${i}" value="${hex(mt.color)}" title="${tr('Change color')}"><input class="mname" data-matname="${i}" value="${esc(mt.name)}" maxlength="40" spellcheck="false" title="${tr('Name of this material: on the pages and in the file name of its PDF')}"><span style="margin-left:auto">${count[i]}</span><select data-matpaper="${i}" title="${tr('Paper for this color (with Pages per color)')}"><option value="">${tr('Paper: standard')}</option>${Object.keys(PAPER).map(k => `<option value="${k}"${S.colorPaper && S.colorPaper[mt.color.join(',')] === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div>`).join('');
  }
  h += `<div class="matbtns"><button data-act="paint" class="${S.paint ? 'on' : ''}">${tr(S.paint ? 'Done painting' : '🖌 Paint faces')}</button><button data-act="add">${tr('+ Color')}</button><button data-act="fix" title="${tr('Single triangles with a different color get the color of their neighbours')}">${tr('Fix tiny islands')}</button></div>`;
  $('mats').innerHTML = h;
}
function ensureMaterials() {
  if (S.model.materials && S.faceMat) return;
  S.model.materials = [{ name: tr('White'), color: [255, 255, 255] }];
  S.faceMat = S.mesh.F.map(() => 0);
  S.faceColor = S.mesh.F.map(() => [255, 255, 255]);
}
function setPaint(on) { setTool(on ? 'paint' : 'select'); }
const CAPS = {
  select: '3D · click a piece to select it',
  cut: '✂ Click near an edge: cut ⇄ join · Shift: flip glue tab',
  paint: '🖌 Click/drag = paint · right drag = rotate',
  object: '⤢ Click a separate part of the model to make it larger or smaller'
};
function setTool(t) {
  if (t === 'paint' && !S.mesh) return toast(tr('Open a model first'));
  S.tool = t;
  const on = t === 'paint';
  S.paint = on;
  document.querySelectorAll('#toolSeg [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  svg.classList.toggle('tool-cut', t === 'cut');
  v3.classList.remove('tool-select', 'tool-cut', 'tool-paint', 'tool-object'); v3.classList.add('tool-' + t);
  $('cap3d').textContent = tr(CAPS[t]);
  $('matPanel').classList.toggle('show', t === 'paint');
  $('objPanel').classList.toggle('show', t === 'object');
  if (t !== 'object') S.selObject = -1;
  setHover(-1);
  if (!S.mesh) return;
  if (on) {
    ensureMaterials();
    if (!(S.brush >= 0 && S.brush < S.model.materials.length)) S.brush = 0;
    $('view3d').value = 'material';
    controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    setHover(-1);
  } else controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  update3DColors(); showMaterials(); showObjects();
}
function paintFace(f) {
  if (f < 0 || S.faceMat[f] === S.brush) return false;
  S.faceMat[f] = S.brush;
  S.faceColor[f] = S.model.materials[S.brush].color.slice();
  return true;
}
function finishPaint(changed) {
  if (!changed) { S.undo.pop(); return; }
  buildDrawings(); render2D(); update3DColors(); showMaterials();
  toast(tr(S.set.cutColors ? 'Color changed. Use Unfold automatically to recalculate.' : 'Color changed.'), 3500);
}
// Losse eilandjes (standaard 1 driehoek) van een andere kleur → kleur van de buren
function fixTinyColors(maxN = 1) {
  if (!S.mesh || !S.faceMat) return toast(tr('This model has no colors.'));
  const m = S.mesh, F = m.F.length, comp = new Int32Array(F).fill(-1), comps = [];
  for (let st = 0; st < F; st++) {
    if (comp[st] >= 0) continue;
    const list = [st]; comp[st] = comps.length;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      for (const e of m.FE[f]) { const E = m.E[e]; if (!E.m) continue; const g = Core.otherFace(E, f); if (comp[g] < 0 && S.faceMat[g] === S.faceMat[f]) { comp[g] = comps.length; list.push(g); } }
    }
    comps.push(list);
  }
  pushUndo();
  let n = 0, regions = 0;
  for (const list of comps) {
    if (list.length > maxN) continue;
    const w = new Map();
    for (const f of list) for (const e of m.FE[f]) { const E = m.E[e]; if (!E.m) continue; const g = Core.otherFace(E, f); const k = S.faceMat[g]; if (k !== S.faceMat[f]) w.set(k, (w.get(k) || 0) + E.len); }
    if (!w.size) continue;
    const best = [...w.entries()].sort((x, y) => y[1] - x[1])[0][0];
    for (const f of list) { S.faceMat[f] = best; S.faceColor[f] = S.model.materials[best].color.slice(); n++; }
    regions++;
  }
  if (!n) { S.undo.pop(); return toast(tr('No tiny color islands found.')); }
  buildDrawings(); render2D(); update3DColors(); showMaterials();
  toast(tr('{n} single triangle(s) got the color of their neighbours. Use Unfold automatically to recalculate.', { n: regions }), 6000);
}
function setupMaterialEvents() {
  const box = $('mats');
  box.addEventListener('keydown', ev => { if (ev.target.dataset.matname !== undefined && (ev.key === 'Enter' || ev.key === 'Escape')) ev.target.blur(); });
  box.addEventListener('click', ev => {
    const act = ev.target.closest('[data-act]');
    if (act) {
      const k = act.dataset.act;
      if (k === 'paint') setPaint(!S.paint);
      else if (k === 'fix') fixTinyColors(1);
      else if (k === 'add') {
        if (!S.mesh) return;
        ensureMaterials();
        const i = S.model.materials.length;
        S.model.materials.push({ name: tr('Color {n}', { n: i + 1 }), color: Core.hslToRgb((i * 0.618034) % 1, 0.55, 0.6) });
        S.brush = i; setPaint(true);
      }
      return;
    }
    if (ev.target.matches('input, select')) return;
    const row = ev.target.closest('[data-mat]');
    if (row) { S.brush = +row.dataset.mat; setPaint(true); }
  });
  box.addEventListener('input', ev => {
    const ni = ev.target.dataset.matname;
    if (ni !== undefined) { S.model.materials[+ni].name = ev.target.value; return; }
    const i = ev.target.dataset.matcol; if (i === undefined) return;
    const c = unhex(ev.target.value), mt = S.model.materials[+i];
    const oldKey = mt.color.join(','), newKey = c.join(','); // the paper choice moves with the colour
    if (S.colorPaper && S.colorPaper[oldKey] && oldKey !== newKey) { S.colorPaper[newKey] = S.colorPaper[oldKey]; delete S.colorPaper[oldKey]; }
    mt.color = c;
    S.faceMat.forEach((k, f) => { if (k === +i) S.faceColor[f] = c.slice(); });
    update3DColors();
  });
  box.addEventListener('change', ev => {
    if (ev.target.dataset.matname !== undefined) { // a name may not be empty: back to the old name
      const mt = S.model.materials[+ev.target.dataset.matname], v = ev.target.value.trim();
      mt.name = v || tr('Color {n}', { n: +ev.target.dataset.matname + 1 }); ev.target.value = mt.name;
      render2D(); return;
    }
    if (ev.target.dataset.matcol !== undefined) { buildDrawings(); render2D(); return; }
    const mi = ev.target.dataset.matpaper; if (mi === undefined || !S.mesh) return;
    const key = S.model.materials[+mi].color.join(','), v = ev.target.value;
    if (!S.colorPaper) S.colorPaper = {};
    if (v) S.colorPaper[key] = v; else delete S.colorPaper[key];
    if (v && !S.set.groupColors) { S.set.groupColors = true; saveSettings(); syncSide(); toast(tr('Pages per color switched on: every color gets its own pages.'), 4000); }
    // pieces may get another size limit: unfold again (unless edited by hand), else lay out again
    if (!S.manual) runAuto(); else { S.world = null; refresh(); fitView(); warnRecut(); }
  });
}
// (i) after a setting: its explanation shows on mouse-over (or keyboard focus)
const infoIcon = text => `<span class="info" tabindex="0" role="img" aria-label="${esc(text)}" data-tip="${esc(text)}">i</span>`;
function setupInfoTips() {
  const tip = document.createElement('div'); tip.id = 'setTip'; tip.setAttribute('role', 'tooltip');
  const dlg = $('settingsDlg'); dlg.appendChild(tip); // inside the dialog, so it shows above it (top layer)
  const show = el => {
    tip.textContent = el.dataset.tip; tip.classList.add('show');
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)), y = r.bottom + 6;
    if (y + h > window.innerHeight - 8) y = r.top - h - 6;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  const hide = () => tip.classList.remove('show');
  dlg.addEventListener('mouseover', ev => { const el = ev.target.closest('.info'); if (el) show(el); });
  dlg.addEventListener('mouseout', ev => { if (ev.target.closest('.info')) hide(); });
  dlg.addEventListener('focusin', ev => { const el = ev.target.closest('.info'); if (el) show(el); else hide(); });
  dlg.addEventListener('focusout', hide);
  dlg.addEventListener('scroll', hide, true);
  dlg.addEventListener('close', hide);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

