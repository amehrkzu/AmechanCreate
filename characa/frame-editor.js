"use strict";
// 枠エディタ:オリジナル枠の「角の飾り」と「辺の模様」を描く。描き方の共通部分は frames.js
//   保存すると、このブラウザのオリジナル枠(characa:frames)に入り、キャラカの「枠の形」に並ぶ
// シンボルエディタ(symbol-editor.html、<body data-editor="symbol">)も、このファイルで動く
//   部品は「シンボル」1つだけ。保存先は characa:symbols。キャラカの「要素を追加」に並ぶ
const SYMBOL_MODE = document.body.dataset.editor === "symbol";

const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const editor = $("editor");

// ---------- 色(キャラカで選んでいる配色を使う) ----------
const FALLBACK_COLORS = { accent: "#e0c27a", text: "#ffffff", sub: "#cfd6e6", muted: "#6b7280", panel: "#000000", bg1: "#1c2333", bg2: "#4a3558", shadow: "#000000" };
let palette = { ...FALLBACK_COLORS, ...(window.CHARACA_PALETTES?.[0]?.colors ?? {}) };
try {
  const p = JSON.parse(localStorage.getItem("characa:v1"));
  if (p?.palette) palette = { ...palette, ...p.palette };
} catch {}
const col = (v) => (typeof v === "string" && v[0] === "@" ? palette[v.slice(1)] ?? "#ff00ff" : v);
const ROLES = [["accent", "アクセント"], ["text", "文字"], ["sub", "サブ文字"], ["muted", "控えめ"], ["panel", "パネル"], ["bg1", "背景1"], ["bg2", "背景2"]];

// ---------- 編集している枠 ----------
const editId = new URLSearchParams(location.search).get("id");
const newFrame = () => ({
  id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  name: "オリジナル枠",
  base: "custom", // 土台の形:最初から自分で描く
  inset: 0.02,
  corner: { size: 0.2, paths: [] },
  edge: { size: 0.07, gap: 0.4, paths: [] },
  baseRadius: 0.08, // 土台の角の大きさ(パネルの短い辺に対する割合)
  baseCorner: { paths: [defaultBasePath()] }, // 土台の形「自分で描く」の左上の角の形
  border: { w: 2, color: "@accent", paths: [], size: 0.08, gap: 0.5 }, // 枠線の色・太さ(太さの単位はパネルの短い辺の 1/200)と、枠線に沿って並べる図形
});
// シンボル:描くマスの大きさ(長い辺が 100)と、線・図形
const newSymbol = () => ({
  id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  name: "オリジナルシンボル",
  w: 100,
  h: 100,
  symbol: { paths: [] },
});
const isNew = !(SYMBOL_MODE ? loadSymbols() : loadCustomFrames()).some((f) => f.id === editId);
let def = SYMBOL_MODE
  ? structuredClone(loadSymbols().find((f) => f.id === editId) ?? newSymbol())
  : structuredClone(loadCustomFrames().find((f) => f.id === editId) ?? newFrame());
if (!SYMBOL_MODE) {
  def.baseRadius ??= 0.08;
  def.baseCorner ??= { paths: [] };
  def.border ??= { w: 2, color: "@accent" }; // 枠線の色・太さ
  def.border.paths ??= []; // 枠線に沿って並べる図形
  def.border.size ??= 0.08; // 並べる図形の大きさ(パネルの短い辺に対する割合)
  def.border.gap ??= 0.5; // 並べる間隔(図形の大きさに対する割合)
}
const savedJson = JSON.stringify(def); // 変更があるかを見る用

let piece = SYMBOL_MODE ? "symbol" : "corner"; // 描いている部品
let mode = "draw";
let sel = { path: null, point: -1 };
let drawing = null;
let drag = null;
const undoStack = [], redoStack = [];

// 部品:角の飾り(corner)・辺の模様(edge)・土台の角(base → def.baseCorner)
const PIECE_KEY = { corner: "corner", edge: "edge", base: "baseCorner", border: "border", symbol: "symbol" };
const BORDER_ID = "__border"; // 枠線を選んだときの sel.path
const box = () => (piece === "symbol" ? { w: def.w || 100, h: def.h || 100 } : piece === "edge" ? { w: EDGE_W, h: EDGE_H } : { w: CORNER_BOX, h: CORNER_BOX });
const paths = () => def[PIECE_KEY[piece]].paths;
const findPath = (id) => paths().find((p) => p.id === id) ?? null;
function uid() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
const snapV = (v) => Math.round(v * 10) / 10;

function snapshot() {
  undoStack.push(JSON.stringify(def));
  if (undoStack.length > 150) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(def));
  def = JSON.parse(undoStack.pop());
  drawing = null;
  renderAll();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(def));
  def = JSON.parse(redoStack.pop());
  drawing = null;
  renderAll();
}

// ---------- 描画 ----------
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}

// 表示の拡大・縮小と移動(見え方だけ。枠のデータは変わらない)
const view = { zoom: 1, cx: null, cy: null }; // cx, cy は表示の真ん中(マスの座標)。null ならもとの真ん中
const ZOOM_MIN = 0.25, ZOOM_MAX = 8;
const u = () => 1 / view.zoom; // 点やハンドルを、画面上で同じ大きさに保つための倍率

// もとの表示範囲(辺の模様・枠線は、となりが少し見えるように横を広く)
function baseRect() {
  const { w, h } = box();
  const pad = 18, padX = piece === "border" ? 120 : piece === "edge" ? 70 : pad;
  return { x: -padX, y: -pad, w: w + padX * 2, h: h + pad * 2 };
}
// 今の表示範囲
//   編集マスの実際の縦横比が違うときは、そちらに合わせて表示範囲を広げる(はみ出した所も、マス目などを描くため)
function viewRect() {
  const b = baseRect(), z = view.zoom;
  let w = b.w, h = b.h;
  const ew = editor.clientWidth, eh = editor.clientHeight;
  if (ew > 0 && eh > 0) {
    if (ew / eh > w / h) w = (h * ew) / eh;
    else h = (w * eh) / ew;
  }
  const cx = view.cx ?? b.x + b.w / 2, cy = view.cy ?? b.y + b.h / 2;
  return { x: cx - w / z / 2, y: cy - h / z / 2, w: w / z, h: h / z };
}
// 編集マスの大きさが変わったら(画面の幅を変えたときなど)、表示範囲を描き直す
new ResizeObserver(() => renderView()).observe(editor);
// 点 p(マスの座標)を動かさずに拡大・縮小する
function zoomAt(z, p) {
  z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  const v = viewRect(), cx = v.x + v.w / 2, cy = v.y + v.h / 2, f = view.zoom / z;
  view.zoom = z;
  view.cx = p.x + (cx - p.x) * f;
  view.cy = p.y + (cy - p.y) * f;
  renderView();
}
function resetView() {
  Object.assign(view, { zoom: 1, cx: null, cy: null });
  renderView();
}
function renderView() {
  renderGuides();
  renderShapes();
  renderOverlay();
  $("zoomFit").textContent = `${Math.round(view.zoom * 100)}%`;
}

// 描くマスの表示範囲と、パネルの縁・大きさの目安
function renderGuides() {
  const { w, h } = box();
  const pad = 18;
  const b = baseRect(), v = viewRect();
  if (![v.x, v.y, v.w, v.h].every(Number.isFinite)) return resetView(); // 念のため(無限に線を引かないように)
  editor.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  $("board").style.aspectRatio = `${b.w} / ${b.h}`;
  const g = $("guideLayer");
  g.replaceChildren();
  // マス目(10 ごと。見えている範囲いっぱいに)
  for (let x = Math.ceil(v.x / 10) * 10; x <= v.x + v.w; x += 10) el("line", { x1: x, y1: v.y, x2: x, y2: v.y + v.h, stroke: "#f1e8f7", "stroke-width": 0.4 * u() }, g);
  for (let y = Math.ceil(v.y / 10) * 10; y <= v.y + v.h; y += 10) el("line", { x1: v.x, y1: y, x2: v.x + v.w, y2: y, stroke: "#f1e8f7", "stroke-width": 0.4 * u() }, g);
  renderContext(g, v.x, v.y, v.w, v.h);
  // パネルの縁(太い線)と、部品の大きさ(点線の四角)
  const edgeAt = piece === "symbol" || piece === "border" ? 0 : piece === "base" ? 0 : -(def.inset ?? 0.02) / (piece === "corner" ? def.corner.size || 0.2 : def.edge.size || 0.07) * (piece === "corner" ? CORNER_BOX : EDGE_H);
  const e = Math.max(-pad + 2, edgeAt);
  if (piece === "border" || piece === "symbol") {
    // 枠線の画面・シンボルは、パネルの縁の目安を出さない(シンボルは点線の四角がマス)
    // 枠線の画面は、真ん中の横線(上で描く)が枠線なので、縁の目安は出さない
  } else if (piece !== "edge") {
    el("path", { d: `M${e},${v.y + v.h}V${e}H${v.x + v.w}`, fill: "none", stroke: "#d9c6e6", "stroke-width": 3 * u() }, g);
  } else {
    el("line", { x1: v.x, y1: e, x2: v.x + v.w, y2: e, stroke: "#d9c6e6", "stroke-width": 3 * u() }, g);
  }
  el("rect", { x: 0, y: 0, width: w, height: h, fill: "none", stroke: "#ffb3cf", "stroke-width": 0.8 * u(), "stroke-dasharray": `${3 * u()} ${3 * u()}` }, g);
}

// 今編集していない部分(土台の形・枠線・ほかの飾り)を、プレビューと同じ描き方でうすく重ねる
//   仮の大きなパネルを canvas に描き、編集しているマスの位置に合わせて画像として敷く
//   枠線の画面は、枠線をまっすぐ伸ばした表示なので出さない
//   先に描かれる部分(土台の塗り・枠線など)は、切り抜きで一緒に透明になるので renderShapes で敷く(contextBefore)
let contextBefore = null;
function renderContext(g, vx, vy, vw, vh) {
  contextBefore = null;
  if (piece === "border" || piece === "symbol") return;
  const M = 1000; // 仮のパネルの短い辺
  const l = { x: 0, y: 0, w: piece === "edge" ? M * 1.6 : M, h: M, radius: 0, borderWidth: 0, borderColor: "@accent" };
  const others = structuredClone(def); // 編集している部品だけ外す
  if (piece === "corner") others.corner.paths = [];
  if (piece === "edge") others.edge.paths = [];
  // 編集のマスの座標 (u, v) → 仮のパネルの座標 (ox + u * sc, oy + v * sc)
  const inset = (def.inset ?? 0.02) * M;
  let ox, oy, sc;
  if (piece === "corner") {
    sc = ((def.corner.size ?? 0.2) * M) / CORNER_BOX;
    ox = oy = inset;
  } else if (piece === "base") {
    sc = ((def.baseRadius ?? 0.08) * 2 * M) / CORNER_BOX;
    ox = oy = 0;
  } else {
    // 辺の模様:上の辺の、真ん中あたりの1回分の位置(frames.js の並べ方と同じ計算)
    sc = ((def.edge.size ?? 0.07) * M) / EDGE_H;
    const pw = EDGE_W * sc, gap = (def.edge.gap ?? 0.4) * pw;
    const cs = def.corner.paths.length ? (def.corner.size ?? 0.2) * M : 0;
    const from = inset + cs, L = l.w - inset - cs - from;
    const n = Math.max(1, Math.floor((L + gap) / (pw + gap)));
    ox = from + (L - (n * pw + (n - 1) * gap)) / 2 + Math.floor(n / 2) * (pw + gap);
    oy = inset;
  }
  const PX = Math.min(4, 1400 / vw); // マスの1単位あたりの画素数(縮小したときに大きくなりすぎないように)
  const make = (draw) => {
    const c = document.createElement("canvas");
    c.width = Math.round(vw * PX);
    c.height = Math.round(vh * PX);
    const gg = c.getContext("2d");
    const k = PX / sc;
    gg.setTransform(k, 0, 0, k, -(ox + vx * sc) * k, -(oy + vy * sc) * k);
    draw(gg);
    return { href: c.toDataURL(), x: vx, y: vy, width: vw, height: vh, opacity: 0.45, preserveAspectRatio: "none", "pointer-events": "none" };
  };
  // 先に描かれる部分:土台の塗り・枠線(辺の模様のときは角の飾りも)
  //   土台の角を描いている間は、土台の形と枠線は出さない(今描いている線と重なるため)
  if (piece !== "base") {
    contextBefore = make((gg) => {
      framePath(gg, others, l.x, l.y, l.w, l.h, 0);
      gg.globalAlpha = 0.5;
      gg.fillStyle = col("@panel");
      gg.fill();
      gg.globalAlpha = 1;
      strokeFrameBorder(gg, others, l, col);
      if (piece === "edge") drawCustomDecoration(gg, others, l, col);
    });
  }
  // あとから描かれる部分:角の飾り → 辺の模様と枠線の模様、辺の模様 → 枠線の模様、土台の角 → 飾りぜんぶ
  el("image", make((gg) => {
    if (piece === "edge") drawBorderPattern(gg, others, l, col);
    else drawFrameDecoration(gg, others, l, col);
  }), g);
}

// うすく重ねたパネルの内側の濃さ(renderContext の 塗り 0.5 × 重ね 0.45 と同じ)
const PANEL_TINT = 0.5 * 0.45;
// 土台の角の線の太さ:実際の枠線の太さを、このマスの大きさに直したもの
//   枠線の太さ = w × 短辺 / BORDER_UNIT、マス 100 = 土台の角の大きさ × 2 × 短辺
const baseBorderW = () => ((def.border.w ?? 2) * CORNER_BOX) / (BORDER_UNIT * 2 * (def.baseRadius ?? 0.08));

function pathAttrs(p, extra = {}) {
  // 土台の角は、実際の枠と同じく枠線の太さ・色で描く(枠線なしのときは、形がわかるように細い線)
  if (piece === "base") {
    const bw = def.border.w > 0 ? baseBorderW() : 0;
    return {
      d: pieceD(p),
      fill: "none",
      stroke: bw ? col(def.border.color ?? "@accent") : "#c9b6d6",
      "stroke-width": bw || 0.8 * u(),
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "pointer-events": "none",
      ...extra,
    };
  }
  const filled = isFilledPiece(p);
  return {
    d: pieceD(p),
    fill: filled ? col(p.color ?? "@accent") : "none",
    "fill-rule": "evenodd",
    stroke: filled ? "none" : col(p.color ?? "@accent"),
    "stroke-width": p.w ?? 4,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "pointer-events": "none",
    ...extra,
  };
}

// 部品の線を順に描く。切り抜きの線は、それより前に描いたもの(before:先に描かれるパネル・枠線なども含む)を透明にする
let maskSeq = 0;
function appendPieces(parent, list, before = []) {
  let cur = el("g", {}, parent);
  for (const b of before) cur.append(b);
  for (const p of list) {
    if (!p.pts.length) continue;
    if (!p.cut || piece === "base") {
      el("path", pathAttrs(p), cur);
      continue;
    }
    // 切り抜き:ここまでのまとまりに、白(見える)の中に黒(透明)で形を描いたマスクをかける
    const id = "cut" + ++maskSeq, filled = isFilledPiece(p);
    const m = el("mask", { id, maskUnits: "userSpaceOnUse", x: -5000, y: -5000, width: 10000, height: 10000 }, parent);
    el("rect", { x: -5000, y: -5000, width: 10000, height: 10000, fill: "#fff" }, m);
    el("path", { ...pathAttrs(p), fill: filled ? "#000" : "none", stroke: filled ? "none" : "#000" }, m);
    cur.setAttribute("mask", `url(#${id})`);
    const outer = el("g", {}, parent);
    outer.append(cur);
    cur = outer;
  }
}

function renderShapes() {
  const g = $("shapeLayer");
  g.replaceChildren();
  // 白い紙だと明るい色が見えにくいので、パネルの色をうすく敷く
  const { w, h } = box();
  el("rect", { x: -5000, y: -5000, width: 10000, height: 10000, fill: col("@panel"), opacity: 0.12, "pointer-events": "none" }, g);
  // 先に描かれる部分(切り抜きで一緒に透明になる)
  const before = [];
  if (contextBefore) before.push(el("image", contextBefore));
  // 枠線:角の形どおりの線を、枠線の色・太さで表示する(押すと選べる)
  if (piece === "border") {
    // パネル上の枠線の太さを、このマスの大きさに直す(マス = 図形の大きさ)
    const w = (def.border.w ?? 2) / (BORDER_UNIT * (def.border.size ?? 0.05)) * BORDER_BOX;
    before.push(el("rect", { x: -5000, y: 50, width: 10000, height: 5000, fill: col("@panel"), opacity: PANEL_TINT, "pointer-events": "none" })); // 下がパネルの内側
    if (def.border.w > 0) before.push(el("line", { x1: -5000, y1: 50, x2: 5000, y2: 50, stroke: col(def.border.color ?? "@accent"), "stroke-width": w, "pointer-events": "none" }));
    el("line", { x1: -5000, y1: 50, x2: 5000, y2: 50, stroke: "rgba(0,0,0,0.001)", "stroke-width": Math.max(w, 8 * u()), "data-path": BORDER_ID }, g);
    for (const dx of [-BORDER_BOX, BORDER_BOX]) { // となりの1回分(すき間なし)
      appendPieces(el("g", { transform: `translate(${dx} 0)`, opacity: 0.3 }, g), paths());
    }
  }
  // 土台の角:描いた輪郭の内側(パネルになる所)をうすく塗る
  if (piece === "base") {
    const src = paths().find((p) => p.pts.length >= 2);
    if (src) {
      let Q = samplePiece(src);
      const [sx, sy] = Q[0], [ex, ey] = Q[Q.length - 1];
      if (sx + (100 - sy) > ex + (100 - ey)) Q = Q.slice().reverse();
      el("path", { d: "M" + Q.map((q) => q.join(",")).join("L") + "L118,0L118,118L0,118Z", fill: col("@panel"), opacity: PANEL_TINT, "pointer-events": "none" }, g);
    }
  }
  // 辺の模様は、となりに並ぶ分をうすく見せる
  if (piece === "edge") {
    const step = EDGE_W * (1 + (def.edge.gap ?? 0.4));
    for (const dx of [-step, step]) {
      appendPieces(el("g", { transform: `translate(${dx} 0)`, opacity: 0.3 }, g), paths());
    }
  }
  appendPieces(g, paths(), before);
  // 切り抜きの形は見えなくなるので、点線でふちを示す
  if (piece !== "base") {
    for (const p of paths()) {
      if (p.cut && p.pts.length) el("path", { d: pieceD(p), fill: "none", stroke: "#8a6f9e", "stroke-width": 0.6 * u(), "stroke-dasharray": `${1.5 * u()} ${1.2 * u()}`, "pointer-events": "none" }, g);
    }
  }
}

function renderOverlay() {
  const g = $("overlayLayer");
  g.replaceChildren();
  for (const p of paths()) {
    if (!p.pts.length) continue;
    el("path", { d: pieceD(p), fill: isFilledPiece(p) ? "rgba(0,0,0,0.001)" : "none", stroke: "rgba(0,0,0,0.001)", "stroke-width": Math.max(piece === "base" ? baseBorderW() : p.w ?? 4, 6 * u()), "stroke-linecap": "round", "data-path": p.id }, g);
  }
  if (sel.path === BORDER_ID) {
    const v = viewRect();
    el("line", { x1: v.x, y1: 50, x2: v.x + v.w, y2: 50, stroke: "#ff7fae", "stroke-width": 0.6 * u(), "stroke-dasharray": `${2 * u()} ${1.5 * u()}`, "pointer-events": "none" }, g);
    return;
  }
  const p = findPath(sel.path);
  if (!p) return;
  const s = u();
  el("path", { d: pieceD(p), fill: "none", stroke: "#ff7fae", "stroke-width": 0.6 * s, "stroke-dasharray": `${2 * s} ${1.5 * s}`, "pointer-events": "none" }, g);
  p.pts.forEach((q, i) => {
    const attrs = { "data-path": p.id, "data-point": i, fill: i === sel.point ? "#ff7fae" : "#fff", stroke: "#ff5f9b", "stroke-width": 0.9 * s };
    if (q.corner) el("rect", { ...attrs, x: q.x - 2 * s, y: q.y - 2 * s, width: 4 * s, height: 4 * s, rx: 0.6 * s }, g);
    else el("circle", { ...attrs, cx: q.x, cy: q.y, r: 2.2 * s }, g);
  });
  const q = p.pts[sel.point];
  if (q) {
    const h = pieceHandles(p, sel.point);
    const n = p.pts.length;
    for (const which of ["in", "out"]) {
      let c = h[which];
      if (!c) continue;
      if (q.corner && !q[which === "in" ? "hIn" : "hOut"]) {
        const nb = p.pts[(sel.point + (which === "in" ? -1 : 1) + n) % n];
        c = { x: q.x + (nb.x - q.x) / 3, y: q.y + (nb.y - q.y) / 3 };
      }
      el("line", { x1: q.x, y1: q.y, x2: c.x, y2: c.y, stroke: "#5aa0e6", "stroke-width": 0.6 * s, "pointer-events": "none" }, g);
      el("circle", { cx: c.x, cy: c.y, r: 2 * s, fill: q.hIn || q.hOut ? "#5aa0e6" : "#fff", stroke: "#5aa0e6", "stroke-width": 0.9 * s, "data-handle": which, "data-hpath": p.id, "data-hpoint": sel.point }, g);
    }
  }
  if (drawing === p.id && p.pts.length > 2) {
    el("circle", { cx: p.pts[0].x, cy: p.pts[0].y, r: 4 * s, fill: "none", stroke: "#2f9e6e", "stroke-width": 0.8 * s, "stroke-dasharray": `${1.5 * s} ${s}`, "pointer-events": "none" }, g);
  }
}

// プレビュー:背景の上に、横長・正方形・縦長のパネルを3つ
function renderPreview() {
  const c = $("preview"), g = c.getContext("2d");
  const W = c.width, H = c.height;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, col("@bg1"));
  bg.addColorStop(1, col("@bg2"));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  if (SYMBOL_MODE) {
    // 大きさ違いを3つ(色はアクセント。キャラカでは要素ごとに色を選ぶ)
    const sw = def.w || 100, sh = def.h || 100;
    let x = 24;
    for (const s of [250, 140, 70]) {
      const k = s / Math.max(sw, sh);
      drawSymbol(g, def, x, (H - sh * k) / 2, sw * k, sh * k, col("@accent"));
      x += sw * k + 36;
    }
    return;
  }
  for (const l of [
    { x: 20, y: 30, w: 360, h: 210 },
    { x: 400, y: 30, w: 170, h: 170 },
    { x: 590, y: 20, w: 110, h: 290 },
  ]) {
    Object.assign(l, { radius: 18, borderWidth: 2, borderColor: "@accent" });
    drawFramePanel(g, def, l, col, col("@panel"), 0.55);
  }
}

function renderSettings() {
  $("frameName").value = def.name ?? "";
  const set = (id, v, fmt) => {
    $(id).value = v;
    $(id + "Out").textContent = fmt(v);
  };
  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  if (!SYMBOL_MODE) {
    set("edgeSize", def.edge.size, pct);
    set("edgeGap", def.edge.gap, (v) => `模様 ${Math.round(v * 100)}%`);
    const baseOpt = $("pieceSelect").querySelector('[value="base"]'); // 土台を自分で描くときだけ選べる
    baseOpt.hidden = baseOpt.disabled = def.base !== "custom";
    $("pieceSelect").value = piece;
  } else {
    $("symbolRatio").value = ratioKey();
  }
  $("undo").disabled = !undoStack.length;
  $("redo").disabled = !redoStack.length;
}

function button(text, onClick, cls = "btn btn--small") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function renderPathPanel() {
  const panel = $("pathPanel");
  panel.replaceChildren();
  if (sel.path === BORDER_ID) return renderBorderPanel(panel);
  const p = findPath(sel.path);
  if (!p) {
    panel.innerHTML = `<p class="note" style="margin:0">「動かす」で線を押すと、ここで設定できます。この部品の線の数:${paths().length}</p>`;
    return;
  }
  const row = document.createElement("div");
  row.className = "row";
  const toggle = (label, on, fn, disabled) => {
    const b = button(label, fn);
    b.setAttribute("aria-pressed", String(on));
    b.disabled = !!disabled;
    return b;
  };
  row.append(
    toggle("閉じた形", p.closed, () => { snapshot(); p.closed = !p.closed; if (!p.closed) p.fill = false; renderAll(); }, p.pts.length < 3),
    toggle("塗る", p.fill, () => { snapshot(); p.fill = !p.fill; if (p.fill) p.closed = true; renderAll(); }, p.pts.length < 3),
    ...(piece === "base" ? [] : [toggle("切り抜き", !!p.cut, () => { snapshot(); p.cut = !p.cut; if (!p.cut) delete p.cut; renderAll(); })]),
    button("複製", () => {
      snapshot();
      const copy = { ...structuredClone(p), id: uid() };
      copy.pts.forEach((q) => movePoint(q, structuredClone(q), 6, 6));
      paths().push(copy);
      sel = { path: copy.id, point: -1 };
      renderAll();
    }),
    button("線を消す", () => deleteSelection(true), "btn btn--small btn--danger"),
  );
  panel.append(row);

  if (piece === "base") {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "土台の角の線の太さは、「枠線」で変えます。";
    panel.append(note);
  }
  if (p.cut) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = SYMBOL_MODE
      ? "切り抜き:この形に重なる所が透明になります。レイヤーでこれより下にあるものが消えます。"
      : "切り抜き:この形に重なる所が透明になります。レイヤーでこれより下にあるもの(パネル・枠線も)が消えます。";
    panel.append(note);
  }

  // 線の太さ(塗りの形には無い)
  if (!isFilledPiece(p) && piece !== "base") {
    const wf = document.createElement("label");
    wf.className = "field";
    wf.style.marginTop = "8px";
    const out = document.createElement("output");
    out.textContent = p.w ?? 4;
    const range = document.createElement("input");
    Object.assign(range, { type: "range", min: 0.5, max: 20, step: 0.5, value: p.w ?? 4 });
    range.addEventListener("pointerdown", snapshot);
    range.addEventListener("input", () => { p.w = Number(range.value); out.textContent = p.w; renderLive(); });
    const head = document.createElement("span");
    head.append("線の太さ ", out);
    wf.append(head, range);
    panel.append(wf);
  }

  const q = p.pts[sel.point];
  if (q) {
    const row2 = document.createElement("div");
    row2.className = "row";
    row2.style.marginTop = "10px";
    row2.append(button(q.corner ? "この点:角 → なめらかに" : "この点:なめらか → 角に", () => { snapshot(); q.corner = !q.corner; renderAll(); }));
    if (q.hIn || q.hOut) row2.append(button("曲がり方を自動に戻す", () => { snapshot(); toAuto(q); renderAll(); }));
    // 点を消す(Delete キーと同じ。点が2つしかない線は、線ごと消える)
    // 文字は「消す」だけ。ボタンの大きさは、前の「この点を消す」と同じ幅のまま
    const del = button("消す", () => deleteSelection(), "btn btn--small btn--danger");
    del.style.minWidth = "calc(6em + 24px)";
    del.title = p.pts.length > 2 ? "この点を消す" : "この点を消す(点が2つしかないので、線ごと消えます)";
    row2.append(del);
    panel.append(row2);
  }
}

// 枠線を選んだときの欄:太さ(色はキャラカの配色で決まる)
function renderBorderPanel(panel) {
  const b = def.border;
  const wf = document.createElement("label");
  wf.className = "field";
  const out = document.createElement("output");
  out.textContent = b.w > 0 ? b.w : "なし";
  const range = document.createElement("input");
  Object.assign(range, { type: "range", min: 0, max: 12, step: 0.5, value: b.w ?? 2 });
  range.addEventListener("pointerdown", snapshot);
  range.addEventListener("input", () => { b.w = Number(range.value); out.textContent = b.w > 0 ? b.w : "なし"; renderLive(); });
  const head = document.createElement("span");
  head.append("枠線の太さ ", out);
  wf.append(head, range);
  panel.append(wf);
  const slider = (label, key, min, max, step, fmt) => {
    const f = document.createElement("label");
    f.className = "field";
    const o = document.createElement("output");
    o.textContent = fmt(b[key]);
    const r = document.createElement("input");
    Object.assign(r, { type: "range", min, max, step, value: b[key] });
    r.addEventListener("pointerdown", snapshot);
    r.addEventListener("input", () => { b[key] = Number(r.value); o.textContent = fmt(b[key]); renderGuides(); renderShapes(); renderOverlay(); renderPreview(); });
    const h = document.createElement("span");
    h.append(label + " ", o);
    f.append(h, r);
    return f;
  };
  panel.append(slider("模様の大きさ", "size", 0.01, 0.2, 0.005, (v) => `${Math.round(v * 1000) / 10}%`));
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "点線の四角が模様の1回分です。右の端から出た線は、となりの左の端につながります。真ん中の横線が枠線です。";
  panel.append(note);
}

// サイドバーのレイヤー一覧:上にあるものほど手前(あとから描く)
function renderLayerPanel() {
  const panel = $("layerPanel");
  panel.replaceChildren();
  const list = paths();
  const ul = document.createElement("ul");
  ul.className = "layer-list";
  // 名前の番号は、線や図形ごとに一度決めたら変えない(並べ替えても名前が付いていく)。複製したものは新しい番号に
  let max = Math.max(0, ...list.map((p) => p.no || 0));
  const used = new Set();
  for (const p of list) {
    if (!p.no || used.has(p.no)) p.no = ++max;
    used.add(p.no);
  }
  // 自分で付けた名前(p.name)があればそれを、なければ「線 1」「図形 2」
  const names = list.map((p) => p.name || `${isFilledPiece(p) ? "図形" : "線"} ${p.no}`);
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const li = document.createElement("li");
    if (p.id === sel.path) li.className = "on";
    const dot = document.createElement("span");
    dot.className = "dot";
    if (p.cut && piece !== "base") dot.classList.add("dot--cut");
    else dot.style.background = piece === "base" ? col(def.border.color ?? "@accent") : col(p.color ?? "@accent");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = names[i];
    name.title = "ダブルクリックで名前を変える";
    // ダブルクリックで名前を変える(Enter・ほかを押すと決定、Esc でやめる。空にすると元の名前に戻る)
    name.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.className = "name-input";
      input.value = names[i];
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (ok && v !== names[i]) {
          snapshot();
          if (v) p.name = v;
          else delete p.name;
        }
        renderAll();
      };
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") finish(true);
        else if (ev.key === "Escape") finish(false);
      });
      input.addEventListener("blur", () => finish(true));
      input.addEventListener("click", (ev) => ev.stopPropagation());
      name.replaceWith(input);
      input.focus();
      input.select();
    });
    li.append(dot, name);
    if (p.cut && piece !== "base") li.append(Object.assign(document.createElement("span"), { className: "tag", textContent: "切り抜き" }));
    const move = (to, label, title) => {
      const b = button(label, (e) => {
        e.stopPropagation();
        snapshot();
        list.splice(to, 0, list.splice(i, 1)[0]);
        renderAll();
      });
      b.title = title;
      b.disabled = to < 0 || to >= list.length;
      return b;
    };
    li.append(move(i + 1, "▲", "手前へ"), move(i - 1, "▼", "奥へ"));
    li.dataset.index = i;
    li.addEventListener("pointerdown", (e) => startLayerDrag(e, li, ul, list, i));
    li.addEventListener("contextmenu", (e) => e.preventDefault()); // 長押しでメニューを出さない
    li.addEventListener("click", () => {
      if (layerDragged) return; // ドラッグで並べ替えた直後のクリックでは選ばない
      if (drawing && drawing !== p.id) {
        finishDrawing();
        sel = { path: p.id, point: -1 };
        renderAll();
        return;
      }
      sel = { path: p.id, point: -1 };
      // 一覧は作り直さない(作り直すと、名前のダブルクリックが届かなくなるため)。選んだ印だけ付けかえる
      renderAll({ keepLayers: true });
      ul.querySelectorAll("li").forEach((x) => x.classList.toggle("on", x === li));
    });
    ul.append(li);
  }
  if (list.length) panel.append(ul);
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = list.length
    ? SYMBOL_MODE ? "上にあるものほど手前に描かれます。" : "上にあるものほど手前に描かれます。いちばん下に、パネル・枠線があります。"
    : "この部品には、まだ線や図形がありません。";
  panel.append(note);
}

// レイヤーをドラッグで並べ替える
//   離した所が行の上なら、その行のすぐ下に差し込む(行と行のあいだに離しても同じ)。いちばん上の行より上なら、いちばん上に
//   マウスは、そのままドラッグ。スマホ(指)は、長押しで「並べ替えモード」になってからドラッグ
//   (指でなぞるだけなら、ふつうに一覧がスクロールする。キャラカのレイヤーと同じ)
let layerDragged = false;
const LONG_PRESS = 400; // 長押しと見なす時間(ミリ秒)
function startLayerDrag(e, li, ul, list, from) {
  if (e.button !== 0 || e.target.closest("button, input")) return;
  layerDragged = false;
  const touch = e.pointerType === "touch";
  const sx = e.clientX, sy = e.clientY;
  let armed = !touch; // 並べ替えできる状態か(マウスは最初から、指は長押しのあと)
  let target = null; // 見た目の並び(上から)で、何番目の位置に差し込むか
  const others = () => [...ul.children].filter((x) => x !== li);
  const clearMarks = () => ul.querySelectorAll(".drop-above, .drop-below").forEach((x) => x.classList.remove("drop-above", "drop-below"));
  // 並べ替えモードの間は、指で動かしても一覧やページをスクロールさせない
  const block = (ev) => {
    if (armed && layerDragged) ev.preventDefault();
  };
  const timer = touch
    ? setTimeout(() => {
        armed = true;
        layerDragged = true;
        li.classList.add("dragging", "lifted");
        navigator.vibrate?.(15); // 並べ替えモードになった合図(震えない端末もある)
        try {
          li.setPointerCapture(e.pointerId);
        } catch {}
      }, LONG_PRESS)
    : null;
  const move = (ev) => {
    if (!armed) {
      // 長押しの前に指が動いたら、スクロールなので並べ替えはやめる
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) up();
      return;
    }
    if (!layerDragged) {
      if (Math.abs(ev.clientY - sy) < 4) return;
      layerDragged = true;
      li.classList.add("dragging");
    }
    const rows = others();
    let k = -1; // 指している行(上端より下にある、いちばん下の行)
    rows.forEach((r, n) => { if (ev.clientY >= r.getBoundingClientRect().top) k = n; });
    clearMarks();
    target = k + 1;
    if (k >= 0) rows[k].classList.add("drop-below");
    else if (rows[0]) rows[0].classList.add("drop-above");
  };
  function up() {
    clearTimeout(timer);
    li.removeEventListener("pointermove", move);
    li.removeEventListener("pointerup", up);
    li.removeEventListener("pointercancel", up);
    document.removeEventListener("touchmove", block);
    clearMarks();
    li.classList.remove("dragging", "lifted");
    if (layerDragged && target !== null) {
      // 見た目は配列の逆順。抜いたあとの配列で、見た目の target 番目 = 配列の (長さ - target) 番目
      const rest = list.filter((_, n) => n !== from);
      const to = rest.length - target;
      if (to !== from) {
        snapshot();
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
      }
      renderAll();
    }
    setTimeout(() => (layerDragged = false), 0); // 直後のクリックでは選ばない
  }
  if (!touch) {
    try {
      li.setPointerCapture(e.pointerId);
    } catch {}
  }
  li.addEventListener("pointermove", move);
  li.addEventListener("pointerup", up);
  li.addEventListener("pointercancel", up);
  document.addEventListener("touchmove", block, { passive: false });
}

// サイドバーのタブ(詳細 / レイヤー)。キャラカと同じ付箋のタブで、シートの色もタブの色にする
document.querySelectorAll(".sheet-tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".sheet-tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
  document.querySelectorAll("#sideBody [data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
  $("sideBody").style.setProperty("--tab-c", t.style.getPropertyValue("--c"));
}));

function renderAll(opt = {}) {
  $("zoomFit").textContent = `${Math.round(view.zoom * 100)}%`;
  if (sel.path !== BORDER_ID) {
    const p = findPath(sel.path);
    if (!p) sel = { path: null, point: -1 };
    else if (sel.point >= p.pts.length) sel.point = -1;
  }
  renderGuides();
  renderShapes();
  renderOverlay();
  renderPreview();
  renderSettings();
  renderPathPanel();
  if (!opt.keepLayers) renderLayerPanel();
}
function renderLive() {
  renderShapes();
  renderOverlay();
  renderPreview();
}

// ---------- 点の操作 ----------
function toAuto(q) {
  delete q.hIn;
  delete q.hOut;
  delete q.broken;
}
function swapHandles(q) {
  const a = q.hIn, b = q.hOut;
  delete q.hIn;
  delete q.hOut;
  if (b) q.hIn = b;
  if (a) q.hOut = a;
}
// 線の上の、押した所にいちばん近い位置を探す({ seg: 区間の番号, t: 区間の中の位置, d: 距離 })
function nearestOnPiece(p, at) {
  const P = p.pts, n = P.length, segs = p.closed ? n : n - 1;
  let best = null;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n, p1 = P[i], p2 = P[j];
    const st = isStraight(p1, p2); // まっすぐな区間は、t と位置が比例するように 1/3・2/3 の所を使う
    const c1 = st ? { x: p1.x + (p2.x - p1.x) / 3, y: p1.y + (p2.y - p1.y) / 3 } : pieceHandles(p, i).out;
    const c2 = st ? { x: p1.x + (p2.x - p1.x) * 2 / 3, y: p1.y + (p2.y - p1.y) * 2 / 3 } : pieceHandles(p, j).in;
    for (let k = 0; k <= 64; k++) {
      const t = k / 64, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, e = t ** 3;
      const x = a * p1.x + b * c1.x + c * c2.x + e * p2.x, y = a * p1.y + b * c1.y + c * c2.y + e * p2.y;
      const d = Math.hypot(x - at.x, y - at.y);
      if (!best || d < best.d) best = { seg: i, t, d };
    }
  }
  return best;
}
// 線の形を変えずに、区間 seg の位置 t に点を足す。足した点の番号を返す
function insertPoint(p, seg, t) {
  const P = p.pts, n = P.length, j = (seg + 1) % n, p1 = P[seg], p2 = P[j];
  const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  if (isStraight(p1, p2)) {
    P.splice(seg + 1, 0, { ...lerp(p1, p2), corner: true });
    return seg + 1;
  }
  // 自動の曲がり具合は、となりの点が変わるとずれるので、両端の点のハンドルを今の形で決めておく
  for (const k of [seg, j]) {
    const q = P[k], h = pieceHandles(p, k);
    if (q.corner) continue;
    if (h.in && !q.hIn) q.hIn = { x: h.in.x, y: h.in.y };
    if (h.out && !q.hOut) q.hOut = { x: h.out.x, y: h.out.y };
  }
  const c1 = pieceHandles(p, seg).out, c2 = pieceHandles(p, j).in;
  // 曲線を2つに分ける(ド・カステリョの方法)
  const a = lerp(p1, c1), b = lerp(c1, c2), c = lerp(c2, p2), ab = lerp(a, b), bc = lerp(b, c), m = lerp(ab, bc);
  if (!(p1.corner && !p1.hOut)) p1.hOut = a; // とがった角の点はとがったまま
  if (!(p2.corner && !p2.hIn)) p2.hIn = c;
  P.splice(seg + 1, 0, { x: m.x, y: m.y, corner: false, hIn: ab, hOut: bc });
  return seg + 1;
}

// 点を動かすとき、手で決めたハンドルも一緒に動かす(o は動かす前の点)
function movePoint(q, o, dx, dy) {
  q.x = snapV(o.x + dx);
  q.y = snapV(o.y + dy);
  const mx = q.x - o.x, my = q.y - o.y;
  if (o.hIn) q.hIn = { x: o.hIn.x + mx, y: o.hIn.y + my };
  if (o.hOut) q.hOut = { x: o.hOut.x + mx, y: o.hOut.y + my };
}

let endedByClick = -1; // 端の点を押して描き終えた時刻(続けて来るダブルクリックの2回目を無視するため)
function finishDrawing() {
  const p = findPath(drawing);
  drawing = null;
  if (p && p.pts.length < 2) {
    def[PIECE_KEY[piece]].paths = paths().filter((x) => x !== p);
    sel = { path: null, point: -1 };
  }
  renderAll();
}

function deleteSelection(wholePath = false) {
  const p = findPath(sel.path);
  if (!p) return;
  snapshot();
  if (!wholePath && sel.point >= 0 && p.pts.length > 2) {
    p.pts.splice(sel.point, 1);
    sel.point = -1;
    if (p.pts.length < 3) { p.closed = false; p.fill = false; }
  } else {
    def[PIECE_KEY[piece]].paths = paths().filter((x) => x !== p);
    sel = { path: null, point: -1 };
    if (drawing === p.id) drawing = null;
  }
  renderAll();
}

// 図形を置く(塗りつぶしの閉じた形)。部品のマスの真ん中に
function addShape(kind) {
  if (drawing) finishDrawing();
  const { w, h } = box();
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.22;
  let pts;
  if (kind === "circle") {
    const k = r * 0.5523; // 4つの点で円にするハンドルの長さ
    pts = [
      { x: cx + r, y: cy, hIn: { x: cx + r, y: cy - k }, hOut: { x: cx + r, y: cy + k } },
      { x: cx, y: cy + r, hIn: { x: cx + k, y: cy + r }, hOut: { x: cx - k, y: cy + r } },
      { x: cx - r, y: cy, hIn: { x: cx - r, y: cy + k }, hOut: { x: cx - r, y: cy - k } },
      { x: cx, y: cy - r, hIn: { x: cx - k, y: cy - r }, hOut: { x: cx + k, y: cy - r } },
    ];
  } else if (kind === "rect") {
    pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: cx + a * r, y: cy + b * r, corner: true }));
  } else if (kind === "diamond") {
    pts = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([a, b]) => ({ x: cx + a * r, y: cy + b * r, corner: true }));
  } else if (kind === "heart") {
    pts = [
      { x: cx, y: cy - r * 0.45, corner: true },
      { x: cx + r * 0.55, y: cy - r * 0.95 },
      { x: cx + r, y: cy - r * 0.35 },
      { x: cx, y: cy + r, corner: true },
      { x: cx - r, y: cy - r * 0.35 },
      { x: cx - r * 0.55, y: cy - r * 0.95 },
    ];
  } else {
    pts = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, corner: true };
    });
  }
  pts.forEach((q) => { q.x = snapV(q.x); q.y = snapV(q.y); q.corner = !!q.corner; });
  snapshot();
  const p = { id: uid(), closed: true, fill: true, pts, color: "@accent" };
  paths().push(p);
  sel = { path: p.id, point: -1 };
  setMode("move");
  renderAll();
}

// ---------- 操作 ----------
const HINTS = {
  draw: "クリックで点を置く / 最初の点を押すと閉じる / Enter・Esc・ダブルクリックで描き終わり / 線の端の点を押すと続きから描く",
  move: "点・線をドラッグで移動 / 点を選ぶと青いハンドル:ドラッグで曲がり具合、Alt+ドラッグで片側だけ / 点をダブルクリックで角⇔なめらか / Delete で消す",
};
function setMode(m) {
  if (drawing) finishDrawing();
  mode = m;
  editor.setAttribute("class", "mode-" + m);
  $("modeToggle").textContent = m === "draw" ? "✏️ 描く" : "✋ 動かす"; // 押すと切り替わる
  $("hint").textContent = HINTS[m];
}
// 土台の角の最初の線:ゆるい丸み
function defaultBasePath() {
  return { id: uid(), closed: false, fill: false, w: 2, color: "@accent", pts: [{ x: 0, y: 100, corner: true }, { x: 29, y: 29, corner: false }, { x: 100, y: 0, corner: true }] };
}

function setPiece(pc) {
  if (drawing) finishDrawing();
  piece = pc;
  if (pc === "base" && !def.baseCorner.paths.length) {
    def.baseCorner.paths.push(defaultBasePath());
    setMode("move");
  }
  // 枠線の画面を開いたら、最初から枠線を選んだ状態にする
  sel = pc === "border" ? { path: BORDER_ID, point: -1 } : { path: null, point: -1 };
  Object.assign(view, { zoom: 1, cx: null, cy: null });
  renderAll();
}

function toUnit(e) {
  const pt = editor.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(editor.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}
function capture(e) {
  try {
    editor.setPointerCapture(e.pointerId);
  } catch {}
}

// スペースキーを押している間は「表示を動かす」(入力欄で文字を打っているときは除く)
let spaceHeld = false;
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.target.closest("input, select, textarea, button")) {
    e.preventDefault();
    spaceHeld = true;
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") spaceHeld = false;
});

editor.addEventListener("wheel", (e) => {
  e.preventDefault();
  const d = Math.max(-20, Math.min(20, e.deltaY * (e.deltaMode === 1 ? 16 : 1))); // ホイール1目盛りで約1.2倍
  zoomAt(view.zoom * Math.exp(-d * 0.01), toUnit(e));
}, { passive: false });

// スマホ:2本指でつまんで拡大縮小・2本指で動かして移動
const touches = new Map();
let pinch = null;
// 右ドラッグで表示を動かすので、右クリックのメニューは出さない
editor.addEventListener("contextmenu", (e) => e.preventDefault());

editor.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size !== 2) return;
  // 1本目の指で点を置いたばかりなら取り消す。動かしていた途中ならやめる
  if (drag?.noSnapshot && !drag.moved) undo();
  drag = null;
  const [a, b] = [...touches.values()];
  pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  e.stopImmediatePropagation();
}, { capture: true });
editor.addEventListener("pointermove", (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!pinch || touches.size < 2) return;
  e.stopImmediatePropagation();
  const [a, b] = [...touches.values()];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // 指の真ん中が動いた分だけ表示を動かしてから、つまんだ分だけ拡大縮小する
  if (!editor.clientWidth) return; // 編集マスが見えていない(大きさ0)ときは動かさない
  const v = viewRect(), upp = v.w / editor.clientWidth;
  view.cx = v.x + v.w / 2 - (mid.x - pinch.mid.x) * upp;
  view.cy = v.y + v.h / 2 - (mid.y - pinch.mid.y) * upp;
  pinch.mid = mid;
  zoomAt(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist), toUnit({ clientX: mid.x, clientY: mid.y }));
}, { capture: true });
const releaseTouch = (e) => {
  touches.delete(e.pointerId);
  if (pinch && touches.size < 2) pinch = null;
};
editor.addEventListener("pointerup", releaseTouch, { capture: true });
editor.addEventListener("pointercancel", releaseTouch, { capture: true });

editor.addEventListener("pointerdown", (e) => {
  // スペース+ドラッグ、ホイールボタン・右ボタンのドラッグで表示を動かす
  if (spaceHeld || e.button === 1 || e.button === 2) {
    e.preventDefault();
    const v = viewRect();
    drag = { kind: "view", sx: e.clientX, sy: e.clientY, cx: v.x + v.w / 2, cy: v.y + v.h / 2 };
    capture(e);
    return;
  }
  if (e.button !== 0) return;
  const at = toUnit(e), t = e.target;
  const pid = t.getAttribute?.("data-path");
  const pi = t.hasAttribute?.("data-point") ? Number(t.getAttribute("data-point")) : -1;

  // ハンドル
  if (t.hasAttribute?.("data-handle")) {
    drag = { kind: "handle", path: t.getAttribute("data-hpath"), index: Number(t.getAttribute("data-hpoint")), which: t.getAttribute("data-handle"), start: at };
    capture(e);
    return;
  }

  // Alt+クリック:点の角⇔なめらかを切り替える
  if (e.altKey && pid && pid !== BORDER_ID && pi >= 0) {
    snapshot();
    const q = findPath(pid).pts[pi];
    q.corner = !q.corner;
    sel = { path: pid, point: pi };
    renderAll();
    return;
  }

  if (pid === BORDER_ID && !findPath(drawing)) {
    sel = { path: BORDER_ID, point: -1 };
    renderAll();
    return;
  }

  if (mode === "draw") {
    const p = findPath(drawing);
    // 描いている端の点(さっき置いた点)を押したら、描くのをやめる
    if (p && pid === p.id && pi === p.pts.length - 1) {
      finishDrawing();
      endedByClick = e.timeStamp;
      return;
    }
    if (!p && e.timeStamp - endedByClick < 500) return; // ダブルクリックの2回目
    if (p && pid === p.id && pi === 0 && p.pts.length > 2) {
      snapshot();
      p.closed = true;
      drawing = null;
      sel = { path: p.id, point: -1 };
      renderAll();
      return;
    }
    if (!p && pid && pid !== BORDER_ID && pi < 0) {
      const q = findPath(pid);
      const hit = q && q.pts.length > 1 && nearestOnPiece(q, at);
      if (hit && hit.d <= Math.max((q.w ?? 4) / 2, 3 * u()) + 0.5) {
        snapshot();
        const ni = insertPoint(q, hit.seg, hit.t);
        sel = { path: q.id, point: ni };
        drag = { kind: "point", path: q.id, index: ni, start: at, orig: structuredClone(q.pts[ni]), noSnapshot: true };
        capture(e);
        renderAll();
        return;
      }
    }
    if (!p && pid && pi >= 0) {
      const q = findPath(pid);
      if (q && !q.closed && (pi === 0 || pi === q.pts.length - 1)) {
        if (pi === 0) {
          q.pts.reverse();
          q.pts.forEach(swapHandles);
        }
        drawing = q.id;
        sel = { path: q.id, point: q.pts.length - 1 };
        renderAll();
        return;
      }
    }
    snapshot();
    const pt = { x: snapV(at.x), y: snapV(at.y), corner: false };
    if (p) {
      p.pts.push(pt);
      sel = { path: p.id, point: p.pts.length - 1 };
    } else {
      const np = { id: uid(), closed: false, fill: false, pts: [pt], w: 4, color: "@accent" };
      paths().push(np);
      drawing = np.id;
      sel = { path: np.id, point: 0 };
    }
    drag = { kind: "point", path: sel.path, index: sel.point, start: at, orig: structuredClone(pt), noSnapshot: true };
    capture(e);
    renderAll();
    return;
  }

  if (pid && pi >= 0) {
    sel = { path: pid, point: pi };
    drag = { kind: "point", path: pid, index: pi, start: at, orig: structuredClone(findPath(pid).pts[pi]) };
  } else if (pid) {
    sel = { path: pid, point: -1 };
    drag = { kind: "path", path: pid, start: at, orig: structuredClone(findPath(pid).pts) };
  } else {
    sel = { path: null, point: -1 };
  }
  if (drag) capture(e);
  renderAll();
});

editor.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (drag.kind === "view") {
    if (!editor.clientWidth) return; // 編集マスが見えていない(大きさ0)ときは動かさない
    const upp = viewRect().w / editor.clientWidth; // 画面の1px が、マスの何単位か
    view.cx = drag.cx - (e.clientX - drag.sx) * upp;
    view.cy = drag.cy - (e.clientY - drag.sy) * upp;
    renderView();
    return;
  }
  const at = toUnit(e);
  const dx = at.x - drag.start.x, dy = at.y - drag.start.y;
  if (!drag.moved && Math.hypot(dx, dy) < 0.3) return;
  if (!drag.moved && !drag.noSnapshot) snapshot();
  drag.moved = true;
  const p = findPath(drag.path);
  if (!p) return;
  if (drag.kind === "handle") {
    const q = p.pts[drag.index];
    if (!q.hIn && !q.hOut && !q.corner) {
      const h = pieceHandles(p, drag.index);
      if (h.in) q.hIn = { x: h.in.x, y: h.in.y };
      if (h.out) q.hOut = { x: h.out.x, y: h.out.y };
    }
    const key = drag.which === "in" ? "hIn" : "hOut", other = drag.which === "in" ? "hOut" : "hIn";
    q[key] = { x: snapV(at.x), y: snapV(at.y) };
    if (e.altKey) q.broken = true;
    if (!q.broken && !q.corner && q[other]) { // 角の点は片側ずつ
      const len = Math.hypot(q[other].x - q.x, q[other].y - q.y);
      const vx = q.x - q[key].x, vy = q.y - q[key].y, L = Math.hypot(vx, vy) || 1;
      q[other] = { x: q.x + (vx / L) * len, y: q.y + (vy / L) * len };
    }
  } else if (drag.kind === "point") {
    movePoint(p.pts[drag.index], drag.orig, dx, dy);
  } else {
    p.pts.forEach((q, i) => movePoint(q, drag.orig[i], dx, dy));
  }
  renderLive();
});

const endDrag = () => {
  if (!drag) return;
  drag = null;
  renderAll();
};
editor.addEventListener("pointerup", endDrag);
editor.addEventListener("pointercancel", endDrag);

editor.addEventListener("dblclick", (e) => {
  const t = e.target;
  const pid = t.getAttribute?.("data-path");
  const pi = t.hasAttribute?.("data-point") ? Number(t.getAttribute("data-point")) : -1;
  if (mode === "draw") {
    const p = findPath(drawing);
    if (p && p.pts.length > 2) {
      const a = p.pts[p.pts.length - 1], b = p.pts[p.pts.length - 2];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1.5) p.pts.pop();
    }
    finishDrawing();
    return;
  }
  if (pid && pi >= 0) {
    snapshot();
    const q = findPath(pid).pts[pi];
    q.corner = !q.corner;
    sel = { path: pid, point: pi };
    renderAll();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, select, textarea")) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === "enter" || k === "escape") {
    if (drawing) finishDrawing();
    else if (k === "escape") { sel = { path: null, point: -1 }; renderAll(); }
    return;
  }
  if (k === "delete" || k === "backspace") { e.preventDefault(); deleteSelection(); return; }
  if (k === "tab") { e.preventDefault(); setMode(mode === "draw" ? "move" : "draw"); return; }
  const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
  const p = findPath(sel.path);
  if (arrows && p) {
    e.preventDefault();
    snapshot();
    const step = e.shiftKey ? 5 : 0.5;
    const targets = sel.point >= 0 ? [p.pts[sel.point]] : p.pts;
    targets.forEach((q) => movePoint(q, structuredClone(q), arrows[0] * step, arrows[1] * step));
    renderAll();
  }
});

// ---------- 枠全体の設定 ----------
// 土台の形を変える(FRAME_BASES の id)。画面の選択欄はなくした。あとでプリセット反映で使う
function setBase(base) {
  snapshot();
  def.base = base;
  if (def.base === "custom") setPiece("base");
  else if (piece === "base") setPiece("corner");
  else renderAll();
}
$("frameName").addEventListener("input", (e) => { def.name = e.target.value; });
if (!SYMBOL_MODE) {
  for (const [id, set] of [
    ["edgeSize", (v) => (def.edge.size = v)],
    ["edgeGap", (v) => (def.edge.gap = v)],
  ]) {
    $(id).addEventListener("pointerdown", snapshot);
    $(id).addEventListener("input", () => { set(Number($(id).value)); renderSettings(); renderGuides(); renderShapes(); renderPreview(); });
  }
  $("pieceSelect").addEventListener("change", (e) => setPiece(e.target.value));
}

// ---------- シンボルのマスの形(縦横比) ----------
// 長い辺を 100 にする。形を変えても、描いた線の位置はそのまま
const RATIOS = [["1:1", "正方形 1:1"], ["4:3", "横長 4:3"], ["3:2", "横長 3:2"], ["16:9", "横長 16:9"], ["2:1", "横長 2:1"], ["3:4", "縦長 3:4"], ["2:3", "縦長 2:3"], ["9:16", "縦長 9:16"], ["1:2", "縦長 1:2"]];
function ratioKey() {
  const w = def.w || 100, h = def.h || 100;
  return RATIOS.find(([k]) => {
    const [a, b] = k.split(":").map(Number);
    return Math.abs(a / b - w / h) < 0.01;
  })?.[0] ?? "";
}
if (SYMBOL_MODE) {
  const r = $("symbolRatio");
  for (const [k, name] of RATIOS) r.add(new Option(name, k));
  r.addEventListener("change", () => {
    const [a, b] = r.value.split(":").map(Number);
    snapshot();
    def.w = Math.round((a >= b ? 100 : (100 * a) / b) * 10) / 10;
    def.h = Math.round((b >= a ? 100 : (100 * b) / a) * 10) / 10;
    resetView();
    renderAll();
  });
}
$("modeToggle").addEventListener("click", () => setMode(mode === "draw" ? "move" : "draw"));
$("shapeSelect").addEventListener("change", (e) => {
  if (e.target.value) addShape(e.target.value);
  e.target.value = ""; // 何度でも同じ図形を足せるように戻す
});
$("undo").addEventListener("click", undo);
$("zoomIn").addEventListener("click", () => { const v = viewRect(); zoomAt(view.zoom * 1.25, { x: v.x + v.w / 2, y: v.y + v.h / 2 }); });
$("zoomOut").addEventListener("click", () => { const v = viewRect(); zoomAt(view.zoom / 1.25, { x: v.x + v.w / 2, y: v.y + v.h / 2 }); });
$("zoomFit").addEventListener("click", resetView);
$("redo").addEventListener("click", redo);

// ---------- 保存して戻る / 戻る ----------
const dirty = () => JSON.stringify(def) !== savedJson;
$("save").addEventListener("click", () => {
  if (drawing) finishDrawing();
  def.name = def.name?.trim() || (SYMBOL_MODE ? "オリジナルシンボル" : "オリジナル枠");
  const ok = SYMBOL_MODE
    ? saveSymbols([...loadSymbols().filter((f) => f.id !== def.id), def])
    : saveCustomFrames([...loadCustomFrames().filter((f) => f.id !== def.id), def]);
  if (!ok) {
    alert("保存できませんでした(このブラウザの保存容量がいっぱいの可能性があります)");
    return;
  }
  leaving = true;
  // シンボルを新しく作ったときは、キャラカに戻ったらカードに置く
  location.href = SYMBOL_MODE
    ? "index.html?symbol=" + encodeURIComponent(def.id) + (isNew ? "&add=1" : "")
    : "index.html?frame=" + encodeURIComponent(CUSTOM_PREFIX + def.id);
});
$("back").addEventListener("click", () => {
  if (dirty() && !confirm("保存していない変更があります。保存せずにキャラカに戻りますか?")) return;
  leaving = true;
  location.href = "index.html";
});
let leaving = false;
window.addEventListener("beforeunload", (e) => {
  if (!leaving && dirty()) e.preventDefault();
});

setMode("draw");
renderAll();
