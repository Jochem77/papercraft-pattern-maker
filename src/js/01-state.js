// Imports, constants, default settings and the app state S
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const Core = window.Core;
const APP_VERSION = '__VERSION__'; // wordt bij het bouwen ingevuld vanuit package.json
const REPO_URL = 'https://github.com/Jochem77/papercraft-pattern-maker';
const $ = id => document.getElementById(id);
const PAPER = { A4: [210, 297], A3: [297, 420] };
const GAP = 20; // ruimte tussen pagina's op het scherm (mm)
const DEF = {
  size: 150, flatDeg: 1, thinMM: 2, paper: 'A4', orient: 'portrait', margin: 10, pieceGap: 2, layoutMode: 'normal',
  silMarks: false, silInset: 15.88, silLen: 20, silThick: 0.5, silSquare: 5,
  tabH: 6, tabAngle: 45, minTab: 60, tabStyle: 'glue', pairMin: 0, zipSeg: 15, cutColors: false, mergeIslands: false, groupColors: false, pieceShape: 'compact', sharpCut: false, sharpDeg: 60, maxPieceOn: false, maxPiece: 100, maxFaces: 8, minWidth: 8, minSize: 25,
  lang: 'en', numbers: true, fontSize: 3, pieceNums: true, pieceNumSize: 5, cleanFaces: false, fontFamily: 'helvetica', pageCols: 3, printColors: true, foldMode: 'score', foldPrint: true, printedInside: false, perfCut: 2, perfGap: 1, scoreMinDeg: 0
};
const S = {
  set: { ...DEF }, model: null, fileB64: null, name: '', mesh: null, maxDim: 1, scale: 1,
  joined: null, tabUser: null, cp: null, lmm: null, tl: null, so: null, num: null,
  world: null, selFace: -1, hover: -1, undo: [], redo: [], manual: false,
  faceColor: null, faceMat: null, paint: false, brush: 0, tool: 'select', layoutPages: 1, pageLabels: [], pageCount: 1, worker: null
};
try { Object.assign(S.set, JSON.parse(localStorage.getItem('papercraft.settings') || '{}')); } catch (e) {}
if (S.set.silInset === 15.9) S.set.silInset = 15.88; // oude standaard → waarde uit Silhouette Studio
const saveSettings = () => { try { localStorage.setItem('papercraft.settings', JSON.stringify(S.set)); } catch (e) {} };

// Paper per colour (S.colorPaper: 'r,g,b' -> 'A4' | 'A3'), used with "Pages per color".
// Functions that take "i" accept a page number, a paper name, or nothing (the standard paper).
const dimsOf = paper => { let [w, h] = PAPER[paper] || PAPER.A4; if (S.set.orient === 'landscape') [w, h] = [h, w]; return [w, h]; };
const keyPaper = key => (S.set.groupColors && S.colorPaper && S.colorPaper[key]) || S.set.paper;
const pagePaper = i => typeof i === 'string' ? i : (i != null && S.pageLabels && S.pageLabels[i] != null ? keyPaper(S.pageLabels[i]) : S.set.paper);
const pageDims = i => dimsOf(pagePaper(i));
// size of a cell in the page grid on screen: the largest paper in use
const cellDims = () => {
  let [w, h] = dimsOf(S.set.paper);
  if (S.set.groupColors && S.colorPaper) for (const pp of Object.values(S.colorPaper)) { const [a, b] = dimsOf(pp); w = Math.max(w, a); h = Math.max(h, b); }
  return [w, h];
};
// Effectieve marge: bij Silhouette-markeringen moeten de stukken binnen de markeringen blijven
const effMargin = () => S.set.silMarks ? Math.max(S.set.margin, S.set.silInset + S.set.silThick + 1.5) : S.set.margin;
const printable = i => { const [w, h] = pageDims(i), m = effMargin(); return [w - 2 * m, h - 2 * m]; };
// Silhouette Type 1: zwart vierkant linksboven, L-hoeken rechtsboven en linksonder (rechthoeken in pagina-mm)
function silMarkRects(pg) {
  if (!S.set.silMarks) return [];
  const [W, H] = pageDims(pg), i = S.set.silInset, L = S.set.silLen, t = S.set.silThick, q = S.set.silSquare;
  return [
    [i, i, q, q],
    [W - i - L, i, L, t], [W - i - t, i, t, L],
    [i, H - i - t, L, t], [i, H - i - L, t, L]
  ];
}
// zone rond het vierkant die vrij moet blijven (in coördinaten van het printbare gebied)
// Silhouette Studio houdt rond het vierkant en de L-hoeken een vak van (inzet + lengte) vrij; +1 mm marge
function silObstacles(i) {
  if (!S.set.silMarks) return [];
  const m = effMargin(), [W, H] = pageDims(i), st = S.set;
  const z = Math.max(st.silInset + st.silLen, st.silInset + st.silSquare + 2) + 1, e = z - m;
  if (e <= 0) return [];
  const pw = W - 2 * m, ph = H - 2 * m;
  return [{ x: 0, y: 0, w: e, h: e }, { x: pw - e, y: 0, w: e, h: e }, { x: 0, y: ph - e, w: e, h: e }];
}
// Pagina-raster: pagina i staat in kolom i % cols, rij floor(i / cols)
const pageCols = () => Math.max(1, Math.round(S.set.pageCols || 3));
function pageOrigin(i, cols = pageCols()) { const [PW, PH] = cellDims(); return [(i % cols) * (PW + GAP), Math.floor(i / cols) * (PH + GAP)]; }
function pageAt(x, y) {
  const [PW, PH] = cellDims(), cols = pageCols();
  const c = Math.floor(x / (PW + GAP)), r = Math.floor(y / (PH + GAP));
  return c < 0 || c >= cols || r < 0 ? -1 : r * cols + c;
}
