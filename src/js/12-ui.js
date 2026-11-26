// Buttons, menus and keyboard shortcuts; start-up
// ---------------------------------------------------------------- knoppen & toetsen
$('bOpen').onclick = () => $('fModel').click();
$('bLoad').onclick = () => $('fProj').click();
$('fModel').onchange = ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) openFile(f); };
$('fProj').onchange = ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) openFile(f); };
$('bSave').onclick = saveProject;
$('bAuto').onclick = async () => {
  if (!S.mesh) return;
  if (S.manual && !confirm(tr('Unfolding automatically replaces your own edits (you can undo this). Continue?'))) return;
  if (await upgradeClean()) return;
  runAuto(false);
};
// A project made with an older clean-up keeps its mesh (so its cuts still fit). Unfolding it
// automatically replaces all cuts anyway, so then the model is cleaned up the current way first;
// colours (also painted ones) go along per original triangle. Unfolds; returns true when it did.
async function upgradeClean() {
  if (!S.full || !(S.cleanTol > 0) || (S.cleanVer || 2) >= 2) return false;
  const d = S.simplify ? simplifiedData(S.full, S.simplify) : S.full;
  const old = Core.cleanMesh(d.pos, S.cleanTol, d.faceMat || null, undefined, S.cleanVer);
  const colOf = new Map(), matOf = new Map();
  S.mesh.src.forEach((t, f) => { const o = old.src[t]; if (S.faceColor) colOf.set(o, S.faceColor[f]); if (S.faceMat) matOf.set(o, S.faceMat[f]); });
  const mats = S.model.materials, colorPaper = S.colorPaper;
  S.cleanVer = 2;
  const data = modelData();
  busy(true, tr('Unfolding…'));
  await loadModel(data, S.name, null);
  S.colorPaper = colorPaper;
  // carry over the colours of the faces as they were
  const nsrc = Core.cleanMesh(d.pos, S.cleanTol, d.faceMat || null, undefined, 2).src;
  if (colOf.size) {
    if (!S.faceColor) S.faceColor = S.mesh.src.map(() => [255, 255, 255]);
    S.mesh.src.forEach((t, f) => { const o = nsrc[t], c = colOf.get(o), k = matOf.get(o); if (c && S.faceColor) S.faceColor[f] = c.slice(); if (k !== undefined && S.faceMat) S.faceMat[f] = k; });
    if (mats) S.model.materials = mats;
    showMaterials(); setup3D(); await runAuto(false);
  }
  return true;
}
$('bLayout').onclick = () => {
  if (!S.cp) return;
  pushUndo(); busy(true, tr('Arranging pieces…'));
  setTimeout(() => { autoLayout(); updateWorld(); numberPieces(); render2D(); buildPieceLabels3D(); fitView(); busy(false); toast(tr('{n} {pieces} on {p} {pages}', { n: S.cp.pieces.length, pieces: pl(S.cp.pieces.length, 'piece', 'pieces'), p: S.pageCount, pages: pl(S.pageCount, 'page', 'pages') })); }, 30);
};
$('bUndo').onclick = undo; $('bRedo').onclick = redo;
$('bPrint').onclick = exportPDF;
$('bPlotter').onclick = exportPlotter;
$('bHelp').onclick = () => $('help').showModal();
// ---- menubalk
const mbar = $('menubar');
function closeMenus() { mbar.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); }
function refreshMenu(menu) {
  const has = !!S.mesh, sel = S.selFace >= 0;
  for (const it of menu.querySelectorAll('.mi')) {
    const need = it.dataset.need;
    it.disabled = (need === 'model' && !has) || (need === 'sel' && !sel) || (need === 'undo' && !S.undo.length) || (need === 'redo' && !S.redo.length);
    const ch = it.dataset.check; if (!ch) continue;
    const [kind, v] = ch.split(':');
    let on = false;
    if (kind === 'tool') on = S.tool === v;
    else if (kind === 'view3d') on = $('view3d').value === v;
    else if (kind === 'toggle') on = $(v).checked;
    else if (kind === 'set') on = !!S.set[v];
    else if (kind === 'lang') on = S.set.lang === v;
    it.querySelector('.ck').textContent = on ? (kind === 'tool' || kind === 'view3d' ? '●' : '✓') : '';
  }
}
mbar.addEventListener('click', ev => {
  const mt = ev.target.closest('.mt');
  if (mt) { const m = mt.parentElement, was = m.classList.contains('open'); closeMenus(); if (!was) { refreshMenu(m); m.classList.add('open'); } return; }
  const it = ev.target.closest('.mi');
  if (it && !it.disabled) { closeMenus(); runCmd(it.dataset.cmd); }
});
mbar.addEventListener('mouseover', ev => {
  const mt = ev.target.closest('.mt'); if (!mt || !mbar.querySelector('.menu.open')) return;
  const m = mt.parentElement; if (m.classList.contains('open')) return;
  closeMenus(); refreshMenu(m); m.classList.add('open');
});
document.addEventListener('pointerdown', ev => { if (!ev.target.closest('#menubar')) closeMenus(); });
function runCmd(c) {
  const [kind, v] = c.split(':');
  const cmds = {
    open: () => $('fModel').click(), load: () => $('fProj').click(), save: saveProject,
    pdf: exportPDF, plotter: exportPlotter, settings: () => openSettings(),
    undo, redo, rotL: () => rotateSel(-15), rotR: () => rotateSel(15), rot90: () => rotateSel(90), deselect: () => selectPiece(-1, true),
    auto: () => $('bAuto').click(), layout: () => $('bLayout').click(), fixTiny: () => fixTinyColors(1), simplify: openSimplify,
    help: () => $('help').showModal(), fit3, fit2: fitView,
    about: () => $('about').showModal(),
    releases: () => window.open(REPO_URL + '/releases', '_blank', 'noopener'),
    issues: () => window.open(REPO_URL + '/issues', '_blank', 'noopener')
  };
  if (kind === 'tool') return setTool(v);
  if (kind === 'lang') { S.set.lang = v; saveSettings(); return applyLanguage(); }
  if (kind === 'view3d') { $('view3d').value = v; return update3DColors(); }
  if (kind === 'toggle') { $(v).checked = !$(v).checked; $(v).dispatchEvent(new Event('change')); return req3(); }
  if (kind === 'set') {
    if (TABS.some(t => t.id === v)) return openSettings(v);
    S.set[v] = !S.set[v]; saveSettings(); syncSide(); return applySetting(v);
  }
  if (cmds[c]) cmds[c]();
}
$('bSettings').onclick = () => $('settingsDlg').open ? closeSettings() : openSettings();
$('bSetClose').onclick = closeSettings;
$('bSetDone').onclick = settingsDone;
$('setBackdrop').onclick = closeSettings;
$('bSetReset').onclick = () => {
  const cur = setDraft();
  draft = { ...DEF, size: cur.size, lang: cur.lang, mirror3d: S.set.mirror3d };
  syncSide();
  toast(tr('Defaults filled in (the model size stays the same). Click Done to apply them.'), 4000);
};
$('bFit2').onclick = fitView;
$('bRotL').onclick = () => rotateSel(-15);
$('bRotR').onclick = () => rotateSel(15);
window.addEventListener('keydown', ev => {
  if (ev.target.matches('input,select,textarea')) return;
  const k = ev.key.toLowerCase();
  if (k === 'escape' && mbar.querySelector('.menu.open')) { closeMenus(); return; }
  if ((ev.ctrlKey || ev.metaKey) && k === 'o') { ev.preventDefault(); $(ev.shiftKey ? 'fProj' : 'fModel').click(); return; }
  if ((ev.ctrlKey || ev.metaKey) && k === 'p') { ev.preventDefault(); if (S.cp) exportPDF(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key === ',') { ev.preventDefault(); openSettings(); return; }
  if (ev.key === 'F1') { ev.preventDefault(); $('help').showModal(); return; }
  if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
  else if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); redo(); }
  else if ((ev.ctrlKey || ev.metaKey) && k === 's') { ev.preventDefault(); saveProject(); }
  else if (k === 'q') rotateSel(ev.shiftKey ? -90 : -15);
  else if (k === 'e') rotateSel(ev.shiftKey ? 90 : 15);
  else if (k === 'escape' && $('settingsDlg').open) closeSettings();
  else if (k === 'escape') { if (S.tool !== 'select') setTool('select'); else selectPiece(-1, true); }
  else if (k === 's' && !ev.ctrlKey && !ev.metaKey) setTool('select');
  else if (k === 'k') setTool('cut');
  else if (k === 'b') setTool('paint');
  else if (k === 'o' && !ev.ctrlKey && !ev.metaKey) setTool('object');
});
window.addEventListener('dragover', ev => ev.preventDefault());
window.addEventListener('drop', ev => { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if (f) openFile(f); });
window.addEventListener('beforeprint', () => { if (S.cp) fillPrintArea(); });
// When the pattern view changes size (window, divider), keep the zoom: same mm per pixel, same top left
let svgSize = null;
new ResizeObserver(() => {
  const w = svg.clientWidth, h = svg.clientHeight; if (!w || !h) return;
  if (svgSize && S.cp) { const k = VB.w / svgSize[0]; VB.w = w * k; VB.h = h * k; }
  svgSize = [w, h]; applyVB();
}).observe(svg);

// Divider between the 3D view and the pattern: drag to make one larger (also by touch and with the
// arrow keys); double-click goes back to the standard. The width is remembered in this browser.
(() => {
  const sp = $('split'), main = sp.parentElement, MIN = 15, MAX = 85;
  const set = pc => { pc = Math.min(MAX, Math.max(MIN, pc)); main.style.setProperty('--split', pc.toFixed(2) + '%'); return pc; };
  const save = pc => { try { if (pc == null) localStorage.removeItem('papercraft.split'); else localStorage.setItem('papercraft.split', pc.toFixed(2)); } catch (e) {} };
  try { const v = parseFloat(localStorage.getItem('papercraft.split')); if (v) set(v); } catch (e) {}
  const cur = () => $('v3d').getBoundingClientRect().width / main.getBoundingClientRect().width * 100;
  let drag = null;
  sp.addEventListener('pointerdown', ev => { ev.preventDefault(); drag = { id: ev.pointerId }; sp.setPointerCapture(ev.pointerId); sp.classList.add('drag'); document.body.classList.add('splitting'); });
  sp.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    const r = main.getBoundingClientRect();
    drag.pc = set((ev.clientX - r.left - 3) / r.width * 100);
  });
  const end = ev => { if (!drag || ev.pointerId !== drag.id) return; if (drag.pc != null) save(drag.pc); drag = null; sp.classList.remove('drag'); document.body.classList.remove('splitting'); };
  sp.addEventListener('pointerup', end); sp.addEventListener('pointercancel', end);
  sp.addEventListener('dblclick', () => { main.style.removeProperty('--split'); save(null); });
  sp.addEventListener('keydown', ev => {
    const d = ev.key === 'ArrowLeft' ? -2 : ev.key === 'ArrowRight' ? 2 : 0; if (!d) return;
    ev.preventDefault(); save(set(cur() + d));
  });
})();

applyStatic();
buildSide();
applyVB();
setTool('select');
// testhaak: ?model=pad (alleen via een webserver)
const qp = new URLSearchParams(location.search).get('model');
if (qp) fetch(qp).then(r => r.arrayBuffer()).then(b => loadModelBuffer(b, qp.split('/').pop(), null)).catch(e => toast(tr('Loading failed: ') + e.message));
window.__S = S;
window.__api = { openSimplify, pieceBody, tabNumPos, font, projectData, loadProject, setTool, focusPiece3D, setPaint, paintFace, finishPaint, fixTinyColors, toggleEdge, flipTab, refresh, runAuto, plotterSVG, cutLoops, pagesWithContent, buildPDFs, pagePaper, pageDims, rotateSel, selectPiece, undo, autoLayout, updateWorld, render2D, applySetting, camera, controls, center, req3, pdfPageOps, exportPlotter, piecePolys, printable, silObstacles };
