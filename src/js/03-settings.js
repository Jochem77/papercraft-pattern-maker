// Settings panel
// ---------------------------------------------------------------- instellingen-paneel
// Instellingen per tabblad. Item: { k, label, type: number|select|check|dims, unit, min, max, step, opts, help, dep }
const TABS = [
  { id: 'general', icon: '🌐', title: 'General', intro: 'Language of the program.', items: [
    { k: 'lang', label: 'Language', type: 'select', raw: true, opts: { en: 'English', nl: 'Nederlands' } }] },
  { id: 'model', icon: '📐', title: 'Model', intro: 'Size of the finished paper model.', items: [
    { type: 'dims' },
    { k: 'thinMM', label: 'Clean up faces thinner than', type: 'number', unit: 'mm', min: 0, max: 20, step: 0.5, help: 'Very thin or tiny triangles in the model are removed by joining their shortest edge or turning an edge, where the shape hardly changes. Colour borders stay. 0 = off. Changing this starts the unfolding again.' },
    { k: 'flatDeg', label: 'Flat below angle', type: 'number', unit: '°', min: 0, max: 20, step: 0.5, help: 'Edges with a smaller angle count as flat: no fold line, and preferably not cut.' }] },
  { id: 'paper', icon: '📄', title: 'Paper & layout', intro: 'Paper size and how the pieces are distributed over the pages.', items: [
    { section: 'Paper' },
    { k: 'paper', label: 'Size', type: 'select', raw: true, opts: { A4: 'A4 (210 × 297 mm)', A3: 'A3 (297 × 420 mm)' } },
    { k: 'orient', label: 'Orientation', type: 'select', opts: { portrait: 'Portrait', landscape: 'Landscape' } },
    { k: 'margin', label: 'Margin', type: 'number', unit: 'mm', min: 0, max: 40, step: 0.5, help: 'Empty border all around; most printers cannot print up to the edge.' },
    { section: 'Layout' },
    { k: 'layoutMode', label: 'Arrangement', type: 'select', opts: { normal: 'Normal', compact: 'Fewest pages', together: 'Neighbours together' }, help: 'Fewest pages: tries several arrangements and keeps the one with the fewest pages (takes a few seconds). Neighbours together: pieces that are joined in the model lie next to each other, which makes building easier but can take more paper.' },
    { k: 'pieceGap', label: 'Space between pieces', type: 'number', unit: 'mm', min: 0, max: 10, step: 0.5, help: 'Room to cut between the pieces.' },
    { k: 'pageCols', label: 'Pages per row', type: 'number', min: 1, max: 12, step: 1, help: 'Only for the on-screen view.' }] },
  { id: 'tabs', icon: '🧩', title: 'Glue tabs', intro: 'Shape of the flaps used to glue the pieces together.', preview: 'tab', items: [
    { k: 'tabH', label: 'Tab width', type: 'number', unit: 'mm', min: 2, max: 25, step: 0.5, help: 'How far a glue tab sticks out.' },
    { k: 'tabAngle', label: 'Angle', type: 'number', unit: '°', min: 15, max: 85, step: 1, help: 'Slope of the sides; smaller = more pointed.' },
    { k: 'minTab', label: 'Minimum width', type: 'number', unit: '%', min: 30, max: 100, step: 5, help: 'Where space is tight, a tab may become this much narrower (or more pointed).' },
    { k: 'tabStyle', label: 'Type', type: 'select', opts: { glue: 'With glue', pair: 'Two flaps glued together', zip: 'Zipper (alternating tabs)' }, help: 'Zipper: on long seams the tabs alternate between the two pieces, each part glued under the other face. Short seams get one normal glue tab. Two flaps glued together: both pieces get a flap along the seam. Fold both flaps inwards and glue them onto each other. The edge number is printed on both flaps, so nothing has to be printed on the faces and the outside can be scored. The pieces are made so that both flaps fit; only on pieces you cut by hand can a normal glue tab remain where a second flap does not fit.' },
    { k: 'pairMin', label: 'Two flaps from seam length', type: 'number', unit: 'mm', min: 0, max: 100, step: 1, dep: 'tabStyle=pair', help: 'Seams shorter than this get one normal glue tab instead of two flaps: stronger, and less bulk inside narrow parts. 0 = two flaps on every seam.' },
    { k: 'zipSeg', label: 'Zipper part length', type: 'number', unit: 'mm', min: 6, max: 100, step: 1, dep: 'tabStyle=zip', help: 'Length of each alternating tab. Seams of at least twice this length become a zipper; shorter seams get one normal glue tab.' }] },
  { id: 'auto', icon: '✂️', title: 'Automatic unfolding', intro: 'How the model is divided into pieces automatically.', items: [
    { k: 'pieceShape', label: 'Shape of the pieces', type: 'select', opts: { large: 'Large (fewest pieces)', compact: 'Compact', vcompact: 'Very compact' }, help: 'Compact pieces have no long arms or ragged edges, so they are easier to fold and glue. They are a bit more pieces.' },
    { k: 'sharpCut', label: 'Cut at sharp folds', type: 'check', help: 'Sharp folds become a cut with a glue tab: easier to build than folding a sharp corner.' },
    { k: 'sharpDeg', label: 'Sharp from', type: 'number', unit: '°', min: 10, max: 170, step: 5, dep: 'sharpCut', help: 'Folds of this angle or more are cut. 0° = flat, 90° = the corner of a box. Lower = more cuts.' },
    { k: 'maxPieceOn', label: 'Limit piece size', type: 'check', help: 'Smaller pieces are easier to fold and glue, but there are more of them.' },
    { k: 'maxPiece', label: 'Maximum size', type: 'number', unit: 'mm', min: 30, max: 400, step: 5, dep: 'maxPieceOn', help: 'Every piece (with its glue tabs) fits in a square of this size.' },
    { k: 'minWidth', label: 'Avoid pieces narrower than', type: 'number', unit: 'mm', min: 0, max: 50, step: 1, help: 'Narrow strips (average width) are joined to a neighbouring piece where possible. 0 = off.' },
    { k: 'minSize', label: 'Avoid pieces smaller than', type: 'number', unit: 'mm', min: 0, max: 100, step: 1, help: 'Very small pieces are joined to a neighbouring piece where possible. 0 = off.' },
    { k: 'maxFaces', label: 'Maximum faces per piece', type: 'number', min: 0, max: 500, step: 1, help: 'Smaller pieces with fewer faces are easier to fold. A flat area made of several triangles (for example a square) counts as one face. 0 = no limit.' },
    { k: 'cutColors', label: 'Cut along color borders', type: 'check', help: 'Every piece gets a single color – useful for colored paper.' },
    { k: 'mergeIslands', label: 'Merge tiny color islands', type: 'check', dep: 'cutColors', help: 'Small or narrow color islands of 1–2 triangles (below Avoid pieces smaller / narrower than) join a neighbouring piece (their color is printed) instead of becoming a tiny piece. Larger islands stay a piece of their own.' },
    { k: 'groupColors', label: 'Pages per color', type: 'check', help: 'Each color gets its own pages.' }],
    note: 'When you change paper, size or tabs, the model is unfolded again automatically – unless you edited edges yourself. Then use <b>Unfold automatically</b>.' },
  { id: 'text', icon: '🔢', title: 'Text & numbers', intro: 'Font and size of the numbers in the pattern.', preview: 'font', items: [
    { k: 'fontFamily', label: 'Font', type: 'select', opts: { helvetica: 'Helvetica / Arial', 'helvetica-bold': 'Helvetica bold', times: 'Times', courier: 'Courier' }, help: 'Standard PDF fonts: work in every PDF reader, printer and Silhouette Studio.' },
    { section: 'Edge numbers' },
    { k: 'numbers', label: 'Show edge numbers', type: 'check', help: 'Edges with the same number are glued together.' },
    { k: 'fontSize', label: 'Font size', type: 'number', unit: 'mm', min: 1, max: 8, step: 0.5, dep: 'numbers', help: 'Maximum size; on small faces they shrink automatically.' },
    { section: 'Piece numbers' },
    { k: 'pieceNums', label: 'Show piece numbers', type: 'check', help: 'A number in a circle on every piece, also shown in 3D.' },
    { k: 'pieceNumSize', label: 'Font size', type: 'number', unit: 'mm', min: 2, max: 20, step: 0.5, dep: 'pieceNums' },
    { section: 'Faces' },
    { k: 'cleanFaces', label: 'Numbers only on tabs', type: 'check', help: 'Piece numbers go on a glue tab or flap, and edge numbers are only printed on the tabs and flaps. The faces stay clean, so the printed side can be the outside of the model (for example to score on the outside). Tip: also switch off Print fold lines.' }] },
  { id: 'print', icon: '🖨️', title: 'Printing & PDF', intro: 'What goes on the printed pages. The PDF is always true size (1:1).', items: [
    { k: 'printColors', label: 'Print colors', type: 'check', help: 'Off = only lines and numbers, for colored paper.' },
    { k: 'foldPrint', label: 'Print fold lines', type: 'check', help: 'Blue dashes = valley fold, red dash-dot = mountain fold.' },
    { k: 'printedInside', label: 'Printed side is the inside', type: 'check', help: 'For plain (photo) card: the numbers and lines end up on the inside of the model and the outside stays clean. The pieces are mirrored on the paper and mountain and valley folds swap; you still print and cut on one side only.' }],
    note: 'Always print the PDF at <b>100% / actual size</b>. Every page has a 50 mm check line at the bottom.' },
  { id: 'plotter', icon: '🔪', title: 'Cutting plotter', intro: 'Settings for the cutting plotter export and Silhouette Print & Cut.', items: [
    { section: 'Cut file (SVG)' },
    { k: 'foldMode', label: 'Fold lines', type: 'select', opts: { score: 'Score (own layer)', perf: 'Perforate (dashes)', mixed: 'Score + perforate', none: 'Leave out' }, help: 'Score + perforate: folds that bend away from the printed side are scored; folds that bend towards it are perforated, because a score line on the inside of a fold folds badly.' },
    { k: 'scoreMinDeg', label: 'Skip folds below', type: 'number', unit: '°', min: 0, max: 45, step: 1, help: 'Folds that bend less than this are not scored, perforated, printed or shown in the pattern and the 3D view: they fold easily by hand. 0 = all folds. Tab folds are always included.' },
    { k: 'perfCut', label: 'Perforation: cut', type: 'number', unit: 'mm', min: 0.5, max: 10, step: 0.1, help: 'Length of each cut of a perforated fold line.' },
    { k: 'perfGap', label: 'Perforation: bridge', type: 'number', unit: 'mm', min: 0.3, max: 5, step: 0.1, help: 'Uncut part between two cuts. Larger = stronger, but stiffer to fold. Photo card: about 1 mm.' },
    { section: 'Silhouette Print & Cut' },
    { k: 'silMarks', label: 'Registration marks (Type 1)', type: 'check', help: 'Black square top left and L-corners; pieces automatically stay out of the keep-clear zones.' },
    { k: 'silLen', label: 'Length', type: 'number', unit: 'mm', min: 5, max: 50, step: 0.01, dep: 'silMarks' },
    { k: 'silThick', label: 'Line thickness', type: 'number', unit: 'mm', min: 0.1, max: 3, step: 0.01, dep: 'silMarks' },
    { k: 'silInset', label: 'Inset', type: 'number', unit: 'mm', min: 3, max: 40, step: 0.01, dep: 'silMarks' },
    { k: 'silSquare', label: 'Square', type: 'number', unit: 'mm', min: 2, max: 15, step: 0.1, dep: 'silMarks', help: 'Size of the black square at the top left.' }],
    note: 'In Silhouette Studio, turn on the registration marks under <b>Print &amp; Cut</b> with the <b>same</b> length, line thickness and inset, and set the page size to the same paper. These values are also printed at the bottom of every PDF page.' }
];
const swHtml = k => `<label class="sw"><input type="checkbox" data-k="${k}"><span></span></label>`;
function rowHtml(it) {
  if (it.section) return `<h4>${tr(it.section)}</h4>`;
  if (it.type === 'dims') return ['Length', 'Width', 'Height'].map((lab, i) => `<div class="srow"><div><div class="t"><span class="axis a${i}">${'XYZ'[i]}</span>${tr(lab)}${i === 0 ? infoIcon(tr('Change one size; the others scale along (proportions stay the same).')) : ''}</div></div><div class="ctl"><input type="number" data-dim="${i}" min="1" max="20000" step="1"><span class="u">mm</span></div></div>`).join('');
  let ctl;
  if (it.type === 'number') ctl = `<input type="number" data-k="${it.k}" min="${it.min}" max="${it.max}" step="${it.step}"><span class="u">${it.unit || ''}</span>`;
  else if (it.type === 'select') ctl = `<select data-k="${it.k}">${Object.entries(it.opts).map(([v, o]) => `<option value="${v}">${it.raw ? o : tr(o)}</option>`).join('')}</select>`;
  else ctl = swHtml(it.k);
  return `<div class="srow" data-row="${it.k}"${it.dep ? ` data-dep="${it.dep}"` : ''}><div><div class="t">${tr(it.label)}${it.help ? infoIcon(tr(it.help)) : ''}</div></div><div class="ctl">${ctl}</div></div>`;
}
let curTab = 'model';
function renderSide() {
  $('setNav').innerHTML = TABS.map(tb => `<button data-tab="${tb.id}"><span class="ic">${tb.icon}</span>${tr(tb.title)}</button>`).join('');
  $('side').innerHTML = TABS.map(tb => `<section class="pane" data-pane="${tb.id}"><h3>${tr(tb.title)}</h3><p class="intro">${tr(tb.intro || '')}</p>${tb.preview ? `<div class="preview" id="prev-${tb.preview}"></div>` : ''}${tb.items.map(rowHtml).join('')}${tb.note ? `<div class="callout">${tr(tb.note)}</div>` : ''}</section>`).join('');
  showTab(curTab);
}
function buildSide() {
  renderSide();
  $('setNav').addEventListener('click', ev => { const b = ev.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  try { curTab = localStorage.getItem('papercraft.tab') || 'model'; } catch (e) {}
  if (!TABS.some(tb => tb.id === curTab)) curTab = 'model';
  showTab(curTab);
  setupMaterialEvents(); setupInfoTips();
  syncSide();
  $('side').addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.dim !== undefined) {
      const i = +el.dataset.dim, v = parseFloat(el.value);
      if (!S.mesh || !(v > 0) || !(S.mesh.size[i] > 0)) { syncSide(); return; }
      setDraft().size = v / S.mesh.size[i] * S.maxDim; syncSide(); return;
    }
    const k = el.dataset.k; if (!k) return;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) : el.value;
    if (el.type === 'number') { if (!isFinite(v)) { syncSide(); return; } v = Math.min(+el.max, Math.max(+el.min, v)); el.value = v; }
    setDraft()[k] = v; syncSide();
  });
  // live voorbeeld tijdens typen
  $('side').addEventListener('input', ev => { const k = ev.target.dataset.k; if (['tabH', 'tabAngle', 'fontFamily', 'fontSize', 'pieceNumSize'].includes(k)) drawPreviews(ev.target); });
}
function showTab(id) {
  curTab = id;
  try { localStorage.setItem('papercraft.tab', id); } catch (e) {}
  document.querySelectorAll('#setNav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
  document.querySelectorAll('#side [data-pane]').forEach(p => p.classList.toggle('on', p.dataset.pane === id));
  $('side').scrollTop = 0;
}
// The panel edits a draft; nothing changes until Done. Close (✕, Esc, click outside) discards it.
let draft = null;
const setDraft = () => draft || (draft = { ...S.set });
const panelSet = () => draft || S.set;
function openSettings(tab) {
  if (tab) showTab(tab);
  if (!$('settingsDlg').open) draft = { ...S.set };
  syncSide();
  $('setSub').textContent = S.mesh ? S.name : '';
  $('setBackdrop').classList.add('show');
  if (!$('settingsDlg').open) $('settingsDlg').show();
}
function closeSettings() { draft = null; syncSide(); $('settingsDlg').close(); $('setBackdrop').classList.remove('show'); }
function settingsDone() {
  const d = draft; draft = null;
  $('settingsDlg').close(); $('setBackdrop').classList.remove('show');
  if (!d) return;
  const keys = Object.keys(d).filter(k => d[k] !== S.set[k]);
  if (!keys.length) return;
  if (keys.includes('pageCols')) S.prevCols = pageCols();
  Object.assign(S.set, d); saveSettings(); syncSide();
  applySettings(keys);
}
// Apply several changed settings at once: unfold again at most once.
const RELAYOUT = ['minWidth', 'minSize', 'maxFaces', 'pieceShape', 'size', 'paper', 'orient', 'margin', 'tabH', 'tabAngle', 'minTab', 'cutColors', 'mergeIslands', 'sharpCut', 'sharpDeg', 'maxPieceOn', 'maxPiece'];
async function applySettings(keys) {
  if (keys.includes('lang')) applyLanguage();
  if (!S.mesh) return;
  if (keys.includes('printedInside')) await rebuildMeshSide();
  const rest = keys.filter(k => k !== 'lang' && k !== 'printedInside');
  if (!S.manual && rest.some(k => RELAYOUT.includes(k) || k.startsWith('sil'))) {
    S.scale = S.set.size / S.maxDim;
    Core.setFlat(S.mesh, S.set.flatDeg);
    S.world = null;
    return runAuto();
  }
  for (const k of rest) applySetting(k);
}
// voorbeelden: plakstrookje en lettertype
function drawPreviews(live) {
  const st = { ...panelSet() };
  if (live && live.dataset.k) { const v = live.type === 'number' ? parseFloat(live.value) : live.value; if (live.type !== 'number' || isFinite(v)) st[live.dataset.k] = v; }
  const pt = $('prev-tab');
  if (pt) {
    const L = 60, sc = 5, h = Math.max(1, st.tabH), ang = Math.max(5, Math.min(85, st.tabAngle));
    let d = h / Math.tan(ang * Math.PI / 180), hh = h; if (2 * d > 0.9 * L) { d = 0.45 * L; hh = Math.min(h, d * Math.tan(ang * Math.PI / 180)); }
    const x0 = 40, y0 = 30 + hh * sc, X = v => x0 + v * sc, Y = v => y0 - v * sc;
    const W = L * sc + 150, Hh = y0 + 105 + (st.tabStyle === 'pair' || st.tabStyle === 'zip' ? 24 : 0);
    pt.innerHTML = `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="max-width:100%">
      <polygon points="${X(0)},${Y(0)} ${X(L)},${Y(0)} ${X(L * 0.75)},${Y(-18)} ${X(L * 0.2)},${Y(-18)}" fill="#cdeccf" stroke="#111" stroke-width="1"/>
      <polygon points="${X(0)},${Y(0)} ${X(d)},${Y(hh)} ${X(L - d)},${Y(hh)} ${X(L)},${Y(0)}" fill="#f1f3f6" stroke="#111" stroke-width="1.4"/>
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(L)}" y2="${Y(0)}" stroke="#b42318" stroke-dasharray="12 4 0.1 4" stroke-linecap="round" stroke-width="1.6"/>
      <line x1="${X(L) + 14}" y1="${Y(0)}" x2="${X(L) + 14}" y2="${Y(hh)}" stroke="#2563eb"/><text x="${X(L) + 20}" y="${(Y(0) + Y(hh)) / 2 + 4}" font-size="16" fill="#2563eb">${fx(hh)} mm</text>
      <text x="${X(d) + 6}" y="${Y(0) - 6}" font-size="16" fill="#b45309">${fx(ang)}°</text>
      <path d="M${X(0) + 22} ${Y(0)} A 22 22 0 0 0 ${X(0) + 22 * Math.cos(ang * Math.PI / 180)} ${Y(0) - 22 * Math.sin(ang * Math.PI / 180)}" fill="none" stroke="#b45309"/>
      <text x="${X(L * 0.45)}" y="${Y(-10)}" font-size="15" fill="#475569" text-anchor="middle">${tr('face')}</text>
      <text x="${X(L / 2)}" y="${Y(hh / 2) + 4}" font-size="14" fill="#475569" text-anchor="middle">${tr(st.tabStyle === 'pair' ? 'flap (on both pieces)' : st.tabStyle === 'zip' ? 'tab (alternating)' : 'glue tab')}</text>
      ${st.tabStyle === 'zip' ? `<text x="${X(0)}" y="${Hh - 6}" font-size="14" fill="#2563eb">${esc(tr('Seams of at least {n} mm: zipper, parts of {m} mm', { n: fx(2 * Math.max(6, +st.zipSeg || 15)), m: fx(Math.max(6, +st.zipSeg || 15)) }))}</text>` : ''}${st.tabStyle === 'pair' ? `<text x="${X(0)}" y="${Hh - 6}" font-size="14" fill="#2563eb">${esc(+st.pairMin > 0 ? tr('Seams shorter than {n} mm: one glue tab', { n: fx(+st.pairMin) }) : tr('Every seam: two flaps'))}</text>` : ''}
    </svg>`;
  }
  const pf = $('prev-font');
  if (pf) {
    const F = FONTS[st.fontFamily] || FONTS.helvetica, e = Math.max(1, st.fontSize) * 4, p = Math.max(2, st.pieceNumSize) * 4;
    pf.innerHTML = `<svg width="100%" height="${Math.max(70, p * 1.7)}" viewBox="0 0 380 ${Math.max(70, p * 1.7)}" style="max-width:420px">
      <rect x="10" y="8" width="360" height="${Math.max(54, p * 1.4)}" rx="6" fill="#cdeccf" stroke="#111"/>
      <text x="80" y="${Math.max(35, p * 0.75) + 4}" font-family='${F.css}' font-weight="${F.weight}" font-size="${e}" text-anchor="middle" dominant-baseline="central">128</text>
      <text x="300" y="${Math.max(35, p * 0.75) + 4}" font-family='${F.css}' font-weight="${F.weight}" font-size="${e}" text-anchor="middle" dominant-baseline="central">57</text>
      <circle cx="190" cy="${Math.max(35, p * 0.75) + 4}" r="${p * 0.68}" fill="#fff" stroke="#222" stroke-width="${p * 0.07}"/>
      <text x="190" y="${Math.max(35, p * 0.75) + 4}" font-family='${F.css}' font-weight="bold" font-size="${p}" text-anchor="middle" dominant-baseline="central">12</text>
    </svg>`;
  }
}
function syncSide() {
  const set = panelSet();
  for (const el of $('side').querySelectorAll('[data-dim]')) {
    const i = +el.dataset.dim, d = S.mesh ? S.mesh.size[i] * set.size / S.maxDim : 0;
    el.disabled = !S.mesh || !(d > 0);
    el.value = S.mesh ? (Math.round(d * 10) / 10) : '';
  }
  for (const el of $('side').querySelectorAll('[data-k]')) {
    const v = set[el.dataset.k];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  }
  for (const r of $('side').querySelectorAll('[data-dep]')) {
    const [dk, dv] = r.dataset.dep.split('='), off = dv !== undefined ? set[dk] !== dv : !set[dk];
    r.classList.toggle('dis', off);
    r.querySelectorAll('input,select').forEach(i => i.disabled = off);
  }
  drawPreviews();
}
function applySetting(k) {
  if (k === 'lang') { applyLanguage(); return; }
  if (!S.mesh) return;
  const autoAgain = !S.manual;
  if (k === 'size') { S.scale = S.set.size / S.maxDim; S.world = null; if (autoAgain) return runAuto(); refresh(); fitView(); return; }
  if (k === 'thinMM') {
    if (!S.full) return;
    S.cleanTol = cleanTolFor(S.simplify ? simplifiedData(S.full, S.simplify) : S.full); S.cleanVer = 2;
    loadModel(modelData(), S.name, null).then(() => { if (S.cleanInfo) toast(tr('{n} thin faces cleaned up ({c} edges joined, {f} turned).', { n: S.cleanInfo.removed + S.cleanInfo.flipped, c: S.cleanInfo.collapsed, f: S.cleanInfo.flipped }), 4000); });
    return;
  }
  if (k === 'flatDeg') { Core.setFlat(S.mesh, S.set.flatDeg); refresh(); return; }
  if (k === 'lang') { applyLanguage(); return; }
  if (k === 'printedInside') { rebuildMeshSide(); return; }
  if (k === 'layoutMode') { busy(true, tr('Arranging pieces…')); setTimeout(() => { S.world = null; refresh(); fitView(); busy(false); }, 40); return; }
  if (k === 'pieceGap') { S.world = null; refresh(); fitView(); return; }
  if (k.startsWith('sil')) { if (autoAgain) return runAuto(); S.world = null; refresh(); fitView(); warnRecut(); return; }
  if (['paper', 'orient', 'margin'].includes(k)) { if (autoAgain) return runAuto(); S.world = null; refresh(); fitView(); warnRecut(); return; }
  if (['tabH', 'tabAngle', 'minTab', 'cutColors', 'mergeIslands', 'minWidth', 'minSize', 'maxFaces', 'pieceShape', 'sharpCut', 'sharpDeg', 'maxPieceOn', 'maxPiece'].includes(k)) { if (autoAgain) return runAuto(); refresh(); return; }
  if (k === 'pageCols') {
    const old = S.prevCols || 3, nc = pageCols();
    for (const p of S.cp.pieces) if (p.page >= 0) { const a = pageOrigin(p.page, old), b = pageOrigin(p.page, nc); p.x += b[0] - a[0]; p.y += b[1] - a[1]; }
    S.prevCols = nc; updateWorld(); render2D(); fitView(); return;
  }
  if (k === 'groupColors') { S.world = null; refresh(); fitView(); return; }
  // two flaps need room on both sides of every seam: the pieces are made again
  if (k === 'tabStyle' || k === 'pairMin' || k === 'zipSeg') { if (autoAgain) return runAuto(); S.world = null; refresh(); fitView(); if (pairNote()) toast(pairNote().slice(3), 5000); warnRecut(); return; }
  if (['numbers', 'fontSize', 'printColors', 'pieceNums', 'pieceNumSize', 'fontFamily', 'cleanFaces', 'scoreMinDeg'].includes(k)) { buildDrawings(); render2D(); buildPieceLabels3D(); if (k === 'scoreMinDeg') update3D(); return; }
}

