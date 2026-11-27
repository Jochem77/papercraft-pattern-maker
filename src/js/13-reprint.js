// Reprint pieces: put some pieces on new pages (for example A4 after printing A3, when cutting went
// wrong) and make a PDF or cutting plotter files of only those pages. The pieces keep their shape,
// their piece numbers and their edge numbers; the layout of the pattern itself does not change.
// ---------------------------------------------------------------- opnieuw printen
const RPS = { cp: null, sel: new Set(), paper: null, orient: null, plan: null, timer: 0 }; // sel: piece numbers

// "3, 7, 12-15" -> { nos: [3, 7, 12, 13, 14, 15], bad: ['x'] }
function parseNos(text) {
  const nos = new Set(), bad = [];
  for (const t of String(text).split(/[\s,;]+/)) {
    if (!t) continue;
    const m = /^(\d+)(?:-(\d+))?$/.exec(t);
    if (!m) { bad.push(t); continue; }
    let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a];
    if (b - a > 5000) { bad.push(t); continue; }
    for (let n = a; n <= b; n++) nos.add(n);
  }
  return { nos: [...nos], bad };
}
// [1, 2, 3, 7, 9, 10] -> "1-3, 7, 9, 10"
function formatNos(nos) {
  const s = [...nos].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length;) {
    let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j - i >= 2 ? s[i] + '-' + s[j] : j > i ? s[i] + ', ' + s[j] : String(s[i]));
    i = j + 1;
  }
  return out.join(', ');
}
const pieceOfNo = () => { const m = new Map(); for (const p of S.cp.pieces) m.set(S.pieceNo[p.id], p); return m; };

// Arrange the chosen pieces on pages of the chosen paper. Uses the arrangement from the settings
// (Paper & layout), with at most 2 seconds for "fewest pages". With "Pages per color" each material
// gets its own pages. Returns { pos: id -> { x, y, rot, page }, labels, pages, tooBig: [ids] }.
function reprintPlan(nos, paper, orient) {
  const st = S.set, key = [[...nos].sort((a, b) => a - b).join(','), paper, orient, paperWH(paper).join('x'), effMargin(), st.pieceGap, st.layoutMode, st.silMarks, st.groupColors].join('|');
  if (RPS.plan && RPS.plan.key === key && RPS.plan.cp === S.cp && RPS.plan.pno === S.pieceNo) return RPS.plan;
  const byNo = pieceOfNo(), list = nos.map(n => byNo.get(n)).filter(Boolean);
  const plan = { key, cp: S.cp, pno: S.pieceNo, paper, orient, pos: new Map(), labels: [], pages: 0, tooBig: [] };
  RP = { paper, orient, plan };
  try {
    const mg = effMargin(), groups = new Map();
    for (const p of list) { const k = S.set.groupColors ? dominantColor(p) : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    const [W, H] = printable(paper);
    for (const [k, ps] of groups) {
      const items = ps.map(p => ({ id: p.id, polys: piecePolys(p) }));
      const r = nestGroup(items, ps, W, H, 2000 / groups.size, paper);
      for (const pl of r.placements) {
        const o = pageOrigin(plan.pages + pl.page);
        plan.pos.set(pl.id, { x: o[0] + mg + pl.x, y: o[1] + mg + pl.y, rot: pl.deg, page: plan.pages + pl.page });
        if (pl.tooBig) plan.tooBig.push(pl.id);
      }
      for (let i = 0; i < r.pages; i++) plan.labels[plan.pages + i] = k;
      plan.pages += r.pages;
    }
  } finally { RP = null; }
  return (RPS.plan = plan);
}
// Run fn with the pieces of the plan on their reprint pages (the other pieces on no page), then put
// everything back exactly as it was. fn may be async.
function withPlan(plan, fn) {
  const ps = S.cp.pieces, saved = ps.map(p => [p.x, p.y, p.rot, p.page]), labels = S.pageLabels;
  RP = { paper: plan.paper, orient: plan.orient, plan };
  for (const p of ps) { const q = plan.pos.get(p.id); if (q) { p.x = q.x; p.y = q.y; p.rot = q.rot; p.page = q.page; } else p.page = -1; }
  S.pageLabels = plan.labels;
  const done = () => { RP = null; ps.forEach((p, i) => { [p.x, p.y, p.rot, p.page] = saved[i]; }); S.pageLabels = labels; };
  let r;
  try { r = fn(); } catch (e) { done(); throw e; }
  if (r && typeof r.then === 'function') return r.finally(done);
  done(); return r;
}

// ---- dialog
function reprintPapers() {
  const list = Object.keys(PAPER).map(k => [k, k]);
  list.push(['custom', tr('Custom size') + ' (' + paperName('custom') + ')']);
  const extra = new Set([S.set.paper, ...Object.values(S.colorPaper || {})]);
  for (const pp of extra) if (pp && !list.some(l => l[0] === pp)) list.push([pp, paperName(pp)]);
  return list;
}
function openReprint() {
  if (!S.cp || !S.pieceNo) return;
  if (RPS.cp !== S.cp) { RPS.cp = S.cp; RPS.sel = new Set(); RPS.plan = null; }
  const byNo = pieceOfNo();
  for (const n of [...RPS.sel]) if (!byNo.has(n)) RPS.sel.delete(n);
  if (!RPS.sel.size && S.selFace >= 0) RPS.sel.add(S.pieceNo[S.cp.pieceOf[S.selFace]]);
  const ps = $('rpPaper'), papers = reprintPapers();
  ps.innerHTML = papers.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  ps.value = papers.some(p => p[0] === RPS.paper) ? RPS.paper : S.set.paper;
  $('rpOrient').value = RPS.orient || S.set.orient;
  $('rpNos').value = formatNos(RPS.sel);
  $('rpBad').textContent = '';
  buildReprintPick();
  updateReprint();
  $('rpDlg').showModal();
}
// piece numbers per page of the pattern; a click on a page selects (or clears) all its pieces
function buildReprintPick() {
  const pages = new Map();
  for (const p of S.cp.pieces) { const k = p.page; if (!pages.has(k)) pages.set(k, []); pages.get(k).push(S.pieceNo[p.id]); }
  const keys = [...pages.keys()].sort((a, b) => (a < 0 ? 1e9 : a) - (b < 0 ? 1e9 : b));
  $('rpPick').innerHTML = keys.map(k => {
    const nos = pages.get(k).sort((a, b) => a - b);
    return `<div class="rp-page"><button class="rp-pg" data-nos="${nos.join(',')}">${k < 0 ? tr('Not on a page') : tr('Page') + ' ' + (k + 1)}</button>` +
      nos.map(n => `<button class="rp-n" data-no="${n}">${n}</button>`).join('') + '</div>';
  }).join('');
  markReprintPick();
}
function markReprintPick() {
  for (const b of $('rpPick').querySelectorAll('.rp-n')) b.classList.toggle('on', RPS.sel.has(+b.dataset.no));
  for (const b of $('rpPick').querySelectorAll('.rp-pg')) b.classList.toggle('on', b.dataset.nos.split(',').every(n => RPS.sel.has(+n)));
}
// recalculate the pages (a little later, so typing stays quick) and draw them
function updateReprint() {
  markReprintPick();
  RPS.paper = $('rpPaper').value; RPS.orient = $('rpOrient').value;
  const has = RPS.sel.size > 0;
  $('rpPdf').disabled = $('rpPlotter').disabled = true;
  clearTimeout(RPS.timer);
  if (!has) { $('rpInfo').textContent = tr('Choose one or more pieces.'); $('rpPrev').innerHTML = ''; return; }
  $('rpInfo').textContent = tr('Arranging pieces…');
  RPS.timer = setTimeout(() => {
    const plan = reprintPlan([...RPS.sel], RPS.paper, RPS.orient);
    const n = plan.pos.size;
    let info = tr('{n} {pieces} on {p} {pages}', { n, pieces: pl(n, 'piece', 'pieces'), p: plan.pages, pages: pl(plan.pages, 'page', 'pages') }) +
      ` · ${paperName(plan.paper)} ${tr(plan.orient === 'landscape' ? 'landscape' : 'portrait')}`;
    $('rpInfo').textContent = info;
    if (plan.tooBig.length) $('rpInfo').innerHTML = esc(info) + `<br><span class="rp-warn">⚠ ${esc(tr('Does not fit on this paper: piece {list}', { list: formatNos(plan.tooBig.map(id => S.pieceNo[id])) }))}</span>`;
    $('rpPrev').innerHTML = withPlan(plan, reprintPreview);
    $('rpPdf').disabled = $('rpPlotter').disabled = false;
  }, 150);
}
// small pictures of the new pages, drawn the way they are printed
function reprintPreview() {
  const mg = effMargin(), st = S.set, plan = RP.plan;
  let s = '';
  for (let i = 0; i < plan.pages; i++) {
    const [x, y] = pageOrigin(i), [PW, PH] = pageDims(i);
    const body = S.cp.pieces.filter(p => p.page === i).map(p => pieceBody(p, 'world', { cut: true, folds: st.foldPrint, labels: true })).join('');
    const lab = tr('Page') + ' ' + (i + 1) + (plan.labels[i] ? ' · ' + colorName(plan.labels[i]) : '');
    s += `<figure><svg viewBox="${fx(x)} ${fx(y)} ${fx(PW)} ${fx(PH)}" style="aspect-ratio:${fx(PW)}/${fx(PH)}"><rect x="${fx(x)}" y="${fx(y)}" width="${fx(PW)}" height="${fx(PH)}" fill="#fff"/><rect x="${fx(x + mg)}" y="${fx(y + mg)}" width="${fx(PW - 2 * mg)}" height="${fx(PH - 2 * mg)}" fill="none" stroke="#cbd5e1" stroke-width="0.6" stroke-dasharray="3 2"/>${body}</svg><figcaption>${esc(lab)}</figcaption></figure>`;
  }
  return s;
}
async function reprintExport(kind) {
  if (!RPS.sel.size) return;
  const plan = reprintPlan([...RPS.sel], RPS.paper, RPS.orient);
  $('rpDlg').close();
  await withPlan(plan, () => (kind === 'pdf' ? exportPDF() : exportPlotter()));
}
function setupReprint() {
  $('rpNos').addEventListener('input', () => {
    const { nos, bad } = parseNos($('rpNos').value), byNo = pieceOfNo();
    const unknown = nos.filter(n => !byNo.has(n));
    RPS.sel = new Set(nos.filter(n => byNo.has(n)));
    const wrong = bad.concat(unknown.length ? [formatNos(unknown)] : []);
    $('rpBad').textContent = wrong.length ? tr('Unknown piece numbers: {list}', { list: wrong.join(', ') }) : '';
    updateReprint();
  });
  $('rpPick').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.no) { const n = +b.dataset.no; RPS.sel.has(n) ? RPS.sel.delete(n) : RPS.sel.add(n); }
    else { const nos = b.dataset.nos.split(',').map(Number), all = nos.every(n => RPS.sel.has(n)); for (const n of nos) all ? RPS.sel.delete(n) : RPS.sel.add(n); }
    $('rpNos').value = formatNos(RPS.sel); $('rpBad').textContent = '';
    updateReprint();
  });
  $('rpClear').onclick = () => { RPS.sel.clear(); $('rpNos').value = ''; $('rpBad').textContent = ''; updateReprint(); };
  $('rpPaper').onchange = $('rpOrient').onchange = updateReprint;
  $('rpCancel').onclick = () => $('rpDlg').close();
  $('rpPdf').onclick = () => reprintExport('pdf');
  $('rpPlotter').onclick = () => reprintExport('plotter');
  $('rpDlg').addEventListener('close', () => clearTimeout(RPS.timer));
}
setupReprint();
Object.assign(window.__api, { openReprint, reprintPlan, withPlan, parseNos, formatNos, RPS });
