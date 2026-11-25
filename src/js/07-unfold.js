// Automatic unfolding (in a worker) and undo
// ---------------------------------------------------------------- automatisch knippen (in een worker)
let workerURL = null;
function getWorkerURL() {
  if (workerURL) return workerURL;
  const src = $('core-src').textContent + `
self.onmessage = e => {
  const d = e.data;
  self.postMessage({ started: true });
  const m = Core.buildMesh(d.pos, d.flatDeg);
  if (d.avoid) d.o.avoid = d.avoid;
  const j = Core.autoPipeline(m, d.o, (k, n, b) => self.postMessage({ progress: [k, n, b] }));
  self.postMessage({ joined: j }, [j.buffer]);
};`;
  workerURL = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  return workerURL;
}
// Largest piece (with tabs) that fits on a sheet of this paper.
function pieceLimit(paper) {
  let [W, H] = printable(paper); const st = S.set;
  // met Silhouette-markeringen: stuk moet passen in de rechthoek die vrij is van alle hoekzones (+1 mm rasterspeling)
  const ob = silObstacles(paper);
  if (ob.length) { W -= ob[0].w + 1; H -= ob[0].h + 1; }
  // a little room for the space between pieces and the raster used to lay out the pages
  W -= st.pieceGap + 3; H -= st.pieceGap + 3;
  if (st.maxPieceOn && st.maxPiece > 0) { W = Math.min(W, st.maxPiece); H = Math.min(H, st.maxPiece); }
  return [W, H];
}
// zipper part length in mm (0 = no zipper)
// zipper parts: as long as possible up to zipMax, at least zipSeg (mm); null when not a zipper
const zipSeg = () => { if (S.set.tabStyle !== 'zip') return null; const max = Math.max(6, +S.set.zipMax || 20); return { max, min: Math.min(max, Math.max(6, +S.set.zipSeg || 10)) }; };
function autoOptions() {
  const st = S.set;
  let [W, H] = pieceLimit(st.paper), faceWH = null;
  // other paper for some colours: a limit per face; W, H become the largest (the check per piece is exact)
  const papers = st.groupColors && S.colorPaper && S.faceColor ? [...new Set(Object.values(S.colorPaper))].filter(pp => pp !== st.paper) : [];
  if (papers.length) {
    const lim = { [st.paper]: [W, H] }; for (const pp of papers) lim[pp] = pieceLimit(pp);
    faceWH = S.faceColor.map(c => lim[keyPaper(c.join(','))] || lim[st.paper]);
    for (const pp of papers) { W = Math.max(W, lim[pp][0]); H = Math.max(H, lim[pp][1]); }
  }
  return { scale: S.scale, W, H, faceWH, tabH: st.tabH, tabAngle: st.tabAngle, minTab: st.minTab / 100, pair: st.tabStyle === 'pair', pairMin: st.tabStyle === 'pair' ? Math.max(0, +st.pairMin || 0) : 0, zip: zipSeg(), timeBudget: 5000, tries: 8, mergeTinyColors: !!st.mergeIslands,
    sharpDeg: st.sharpCut ? st.sharpDeg : 0, maxFaces: Math.max(0, Math.round(+st.maxFaces || 0)), minWidth: Math.max(0, +st.minWidth || 0), minSize: Math.max(0, +st.minSize || 0), isoMax: { large: 0, compact: 6, vcompact: 4 }[st.pieceShape] || 0 };
}
// "two flaps glued together": how many seams got two flaps and how many one glue tab
function pairNote() {
  if (S.set.tabStyle === 'zip' && S.tl && S.tl.zip) {
    let z = 0, one = 0; S.tl.tabs.forEach((t, e) => { if (t) { if (S.tl.zip[e]) z++; else one++; } });
    return tr(' · {a} seams as a zipper, {b} with one glue tab', { a: z, b: one });
  }
  if (S.set.tabStyle !== 'pair' || !S.tl || !S.tl.tabs2) return '';
  let two = 0, one = 0; S.tl.tabs.forEach((t, e) => { if (t) { if (S.tl.tabs2[e]) two++; else one++; } });
  return tr(' · {a} seams with two flaps, {b} with one glue tab', { a: two, b: one });
}
function warnRecut() {
  const bad = S.cp ? S.cp.pieces.filter(p => p.off || p.big).length : 0;
  if (bad) toast(tr('{n} piece(s) no longer fit on the page (orange). Use Unfold automatically to cut again, or cut them smaller yourself.', { n: bad }), 7000);
}
function avoidEdges() {
  if (!S.set.cutColors || !S.faceColor) return null;
  const a = new Uint8Array(S.mesh.E.length);
  const key = f => S.faceColor[f].join(',');
  S.mesh.E.forEach((e, i) => { if (e.f.length === 2 && key(e.f[0]) !== key(e.f[1])) a[i] = 1; });
  return a;
}
function runAuto(initial) {
  if (!S.mesh) return;
  if (S.worker) { S.worker.terminate(); S.worker = null; }
  const o = autoOptions(), avoid = avoidEdges();
  busy(true, tr('Unfolding…'));
  return new Promise(resolve => {
    const done = async joined => {
      // "fewest pages" takes a few seconds: show it before the layout blocks the screen
      if (S.set.layoutMode === 'compact') { busy(true, tr('Arranging pieces…')); $('busyBar').style.width = '0'; await new Promise(r => setTimeout(r, 40)); }
      busy(false);
      if (!initial) pushUndo();
      S.joined = joined; S.tabUser.fill(-1); S.world = null; S.manual = false;
      refresh(); fitView();
      const n = S.cp.pieces.length;
      const bad = S.cp.pieces.filter(p => p.off || p.big).length;
      toast(tr('{n} {pieces} on {p} {pages}', { n, pieces: pl(n, 'piece', 'pieces'), p: S.pageCount, pages: pl(S.pageCount, 'page', 'pages') }) + pairNote() + (bad ? tr(' · note: {n} piece(s) do not fit (orange)', { n: bad }) : ''), bad || pairNote() ? 6000 : 2800);
      resolve();
    };
    const fallback = () => setTimeout(() => {
      $('busyText').textContent = tr('Unfolding… (please wait)');
      if (avoid) o.avoid = avoid;
      done(Core.autoPipeline(S.mesh, { ...o, tries: 3 }));
    }, 30);
    let w;
    try { w = new Worker(getWorkerURL()); } catch (e) { fallback(); return; }
    S.worker = w;
    let started = false;
    const watchdog = setTimeout(() => { if (!started && S.worker === w) { w.terminate(); S.worker = null; fallback(); } }, 3000);
    w.onmessage = ev => {
      if (ev.data.started) { started = true; clearTimeout(watchdog); return; }
      if (ev.data.progress) {
        const [k, n, b] = ev.data.progress;
        $('busyText').textContent = tr('Unfolding… attempt {k}/{n} · best: {b} pieces', { k, n, b });
        $('busyBar').style.width = (100 * k / n) + '%';
        return;
      }
      w.terminate(); S.worker = null; done(new Uint8Array(ev.data.joined));
    };
    w.onerror = ev => { ev.preventDefault(); clearTimeout(watchdog); w.terminate(); S.worker = null; fallback(); };
    $('bCancel').onclick = () => {
      clearTimeout(watchdog); w.terminate(); S.worker = null; busy(false);
      if (initial) { S.joined = new Uint8Array(S.mesh.E.length); refresh(); fitView(); toast(tr('Cancelled: all edges cut')); }
      resolve();
    };
    w.postMessage({ pos: meshPos(S.model.pos), flatDeg: S.set.flatDeg, o, avoid });
  });
}

// ---------------------------------------------------------------- ongedaan maken
function snapshot() { return { joined: S.joined.slice(), tabUser: S.tabUser.slice(), world: S.world ? S.world.slice() : null, manual: S.manual, faceMat: S.faceMat ? S.faceMat.slice() : null, faceColor: S.faceColor ? S.faceColor.slice() : null }; }
function pushUndo() { if (!S.joined) return; S.undo.push(snapshot()); if (S.undo.length > 100) S.undo.shift(); S.redo = []; }
function restore(s) {
  S.joined = s.joined; S.tabUser = s.tabUser; S.world = s.world; S.manual = s.manual;
  if (s.faceMat && S.faceMat) { S.faceMat = s.faceMat; S.faceColor = s.faceColor; }
  refresh(); showMaterials();
}
function undo() { if (!S.undo.length) return toast(tr('Nothing to undo')); S.redo.push(snapshot()); restore(S.undo.pop()); }
function redo() { if (!S.redo.length) return; S.undo.push(snapshot()); restore(S.redo.pop()); }

