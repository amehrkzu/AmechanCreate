"use strict";
// 枠の形(パネルの輪郭と飾り)。キャラカ(app.js)と枠エディタ(frame-editor.js)の両方で使う
//   描く先の canvas(g)と、色を決める関数(col: "@accent" などを色にする)を受け取って描く

// 最初からある枠
const FRAMES = [
  ["round", "丸い角"],
  ["square", "四角"],
  ["cut", "角を切る"],
  ["double", "二重線"],
  ["corner", "角飾り"],
  ["lace", "レース"],
];

// 土台の形として選べるもの(オリジナル枠用)
const FRAME_BASES = [
  ["round", "丸い角"],
  ["square", "四角"],
  ["cut", "角を切る"],
  ["lace", "レースの波"],
  ["custom", "自分で描く"],
];

// ---------- オリジナル枠の保存 ----------
// 枠エディタで作った枠は、このブラウザに保存する。カードの project.frame には "u:" + id を入れる
const CUSTOM_FRAMES_KEY = "characa:frames";
const CUSTOM_PREFIX = "u:";

function loadCustomFrames() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_FRAMES_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveCustomFrames(list) {
  try {
    localStorage.setItem(CUSTOM_FRAMES_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function findCustomFrame(frame) {
  if (typeof frame !== "string" || !frame.startsWith(CUSTOM_PREFIX)) return null;
  const id = frame.slice(CUSTOM_PREFIX.length);
  return loadCustomFrames().find((f) => f.id === id) ?? null;
}

// frame は "round" などの名前、"u:id"(オリジナル枠)、またはオリジナル枠のデータそのもの
function resolveFrame(frame) {
  if (frame && typeof frame === "object") return { base: frame.base ?? "round", def: frame };
  const def = findCustomFrame(frame);
  if (def) return { base: def.base ?? "round", def };
  return { base: FRAMES.some(([id]) => id === frame) ? frame : "round", def: null };
}

// ---------- 輪郭 ----------
function frameRoundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.max(0, Math.min(r || 0, w / 2, h / 2)));
}

// レースの縁(波形)の、山ひとつ分の大きさ
const laceSize = (w, h) => Math.max(7, Math.min(w, h) * 0.035);

// レースの波形の輪郭を、命令の並び [["M",x,y], ["Q",cx,cy,x,y], ...] で返す(canvas と見本の SVG で共用)
//   枠の内側に少し下げた四角の各辺に、外向きにふくらむ山を並べる
function laceOutline(x, y, w, h, r) {
  const k = r * 0.7, X0 = x + k, Y0 = y + k, X1 = x + w - k, Y1 = y + h - k;
  const cmds = [["M", X0, Y0]];
  const edge = (ax, ay, bx, by, nx, ny) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / (r * 2)));
    for (let i = 0; i < n; i++) {
      const t1 = (i + 1) / n, tm = (i + 0.5) / n;
      const ex = ax + (bx - ax) * t1, ey = ay + (by - ay) * t1;
      const cx = ax + (bx - ax) * tm + nx * k * 2, cy = ay + (by - ay) * tm + ny * k * 2;
      cmds.push(["Q", cx, cy, ex, ey]);
    }
  };
  edge(X0, Y0, X1, Y0, 0, -1); // 上
  edge(X1, Y0, X1, Y1, 1, 0); // 右
  edge(X1, Y1, X0, Y1, 0, 1); // 下
  edge(X0, Y1, X0, Y0, -1, 0); // 左
  return cmds;
}

// 枠の形どおりの輪郭を作る(このあと fill / stroke する)
function framePath(g, frame, x, y, w, h, r) {
  const { base, def } = resolveFrame(frame);
  if (def) r = (def.baseRadius ?? 0.08) * Math.min(w, h); // オリジナル枠は角の大きさを枠ごとに決める
  if (base === "custom") {
    const pts = customBaseOutline(def, x, y, w, h);
    if (pts) {
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      return;
    }
    return frameRoundRect(g, x, y, w, h, r); // まだ描いていなければ丸い角
  }
  if (base === "square") return frameRoundRect(g, x, y, w, h, 0);
  if (base === "lace" && Math.min(w, h) >= 60) {
    g.beginPath();
    for (const [c, ...v] of laceOutline(x, y, w, h, laceSize(w, h))) {
      if (c === "M") g.moveTo(v[0], v[1]);
      else g.quadraticCurveTo(v[0], v[1], v[2], v[3]);
    }
    g.closePath();
    return;
  }
  if (base === "cut") {
    const c = Math.min(def ? r : Math.max(r || 0, 16), w / 2, h / 2); // 角を切る大きさ
    g.beginPath();
    g.moveTo(x + c, y);
    g.lineTo(x + w - c, y);
    g.lineTo(x + w, y + c);
    g.lineTo(x + w, y + h - c);
    g.lineTo(x + w - c, y + h);
    g.lineTo(x + c, y + h);
    g.lineTo(x, y + h - c);
    g.lineTo(x, y + c);
    g.closePath();
    return;
  }
  frameRoundRect(g, x, y, w, h, r); // 丸い角(細い帯のレースもこれ)
}

// 部品の線を細かい点の並びにする(曲線を折れ線で近似)
function samplePiece(p, steps = 16) {
  const P = p.pts, n = P.length;
  if (n < 2) return P.map((q) => [q.x, q.y]);
  const out = [[P[0].x, P[0].y]];
  const segs = p.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n, p1 = P[i], p2 = P[j];
    if (isStraight(p1, p2)) {
      out.push([p2.x, p2.y]);
      continue;
    }
    const c1 = pieceHandles(p, i).out, c2 = pieceHandles(p, j).in;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
      out.push([a * p1.x + b * c1.x + c * c2.x + d * p2.x, a * p1.y + b * c1.y + c * c2.y + d * p2.y]);
    }
  }
  return out;
}

// 土台の角を自分で描いたとき:左上の角の輪郭(100×100 のマス、左の辺 → 上の辺)を4つの角に反転して並べ、
// パネル全体の輪郭(時計回りの点の並び)にする。角と角のあいだはまっすぐにつながる
function customBaseOutline(def, x, y, w, h) {
  const src = def?.baseCorner?.paths?.find((p) => p.pts.length >= 2);
  if (!src) return null;
  let Q = samplePiece(src);
  // 左の辺に近いほうから始まり、上の辺に近いほうで終わる向きにそろえる
  const [sx, sy] = Q[0], [ex, ey] = Q[Q.length - 1];
  if (sx + (100 - sy) > ex + (100 - ey)) Q = Q.slice().reverse();
  const s = ((def.baseRadius ?? 0.08) * 2 * Math.min(w, h)) / CORNER_BOX; // 角のマス = 土台の角の大きさの2倍
  const tl = Q.map(([u, v]) => [x + u * s, y + v * s]);
  const tr = Q.map(([u, v]) => [x + w - u * s, y + v * s]).reverse();
  const br = Q.map(([u, v]) => [x + w - u * s, y + h - v * s]);
  const bl = Q.map(([u, v]) => [x + u * s, y + h - v * s]).reverse();
  return [...tl, ...tr, ...br, ...bl];
}

// 枠線を引く(framePath で輪郭を作ったあとに呼ぶ)
//   土台を自分で描いた枠は、その線の色・太さが枠線になる。それ以外は図形の要素の枠線の設定
// 枠線の太さの単位:パネルの短い辺の 1/200(大きいパネルでも小さいパネルでも同じ見た目になるように)
const BORDER_UNIT = 200;

function strokeFrameBorder(g, frame, l, col) {
  const { def } = resolveFrame(frame);
  let width = l.borderWidth, color = l.borderColor;
  if (def?.border) {
    // オリジナル枠は、枠エディタの「枠線」で決めた色・太さ
    width = (def.border.w ?? 2) * (Math.min(l.w, l.h) / BORDER_UNIT);
    color = def.border.color ?? "@accent";
  }
  if (!(width > 0)) return;
  g.save();
  g.lineWidth = width;
  g.lineJoin = "round";
  g.strokeStyle = col(color);
  g.stroke();
  g.restore();
}

// パネルの輪郭を、時計回りの点の並びにする(左上の角のあたりから始まる)
function framePolyline(frame, x, y, w, h, r) {
  const { base, def } = resolveFrame(frame);
  if (def) r = (def.baseRadius ?? 0.08) * Math.min(w, h);
  if (base === "custom") {
    const pts = customBaseOutline(def, x, y, w, h);
    if (pts) return pts;
  }
  if (base === "square") return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (base === "cut") {
    const c = Math.min(def ? r : Math.max(r || 0, 16), w / 2, h / 2);
    return [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
  }
  // 丸い角(レースの波もこの形で並べる)
  r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  const out = [];
  for (const [cx, cy, a0] of [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]]) {
    for (let k = 0; k <= 8; k++) {
      const a = ((a0 + (k / 8) * 90) * Math.PI) / 180;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return out;
}

// 枠線の模様:枠線の画面で描いた「模様の1回分」を、輪郭に沿ってすき間なく一周並べる(向きは輪郭に合わせて回す)
//   1回分の右の端は、となりの左の端につながる。一周の長さに合わせて横だけ少し伸び縮みさせ、継ぎ目を出さない
const BORDER_BOX = 100; // 模様の1回分のマス(真ん中の横線 y=50 が枠線)
function drawBorderPattern(g, frame, l, col) {
  const { def } = resolveFrame(frame);
  const paths = def?.border?.paths;
  if (!paths?.length || Math.min(l.w, l.h) < 60) return;
  const size = (def.border.size ?? 0.08) * Math.min(l.w, l.h); // 模様の1回分の大きさ
  const pts = framePolyline(frame, l.x, l.y, l.w, l.h, l.radius);
  // 輪郭の長さを測って、等間隔に置く位置を決める
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0) seg.push({ a, b, len, start: total });
    total += len;
  }
  const n = Math.max(1, Math.round(total / size));
  const step = total / n; // 1回分の長さ(一周にぴったり収まるように少し伸び縮み)
  const kx = step / BORDER_BOX, ky = size / BORDER_BOX;
  g.save();
  let j = 0;
  for (let i = 0; i < n; i++) {
    const at = i * step + step / 2;
    while (j < seg.length - 1 && seg[j].start + seg[j].len < at) j++;
    const { a, b, len, start } = seg[j];
    const t = (at - start) / len;
    const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(ang), s = Math.sin(ang);
    g.save();
    // 位置 → 輪郭の向きに回す → マスの大きさ(横は1回分の長さ) → マスの真ん中(50,50)を枠線の上に合わせる
    g.transform(c * kx, s * kx, -s * ky, c * ky, px - (c * 50 * kx - s * 50 * ky), py - (s * 50 * kx + c * 50 * ky));
    drawPieces(g, paths, col);
    g.restore();
  }
  g.restore();
}

// ---------- 飾り ----------
// l は図形の要素 { x, y, w, h, radius, borderWidth, borderColor }
function drawFrameDecoration(g, frame, l, col) {
  if (Math.min(l.w, l.h) < 60) return; // 細い帯・線には飾りを付けない
  const { def } = resolveFrame(frame);
  if (def) {
    drawCustomDecoration(g, def, l, col);
    drawBorderPattern(g, frame, l, col);
    return;
  }
  if (frame !== "double" && frame !== "corner" && frame !== "lace") return;
  const color = col(l.borderWidth > 0 ? l.borderColor : "@accent");
  const lw = Math.max(2, (l.borderWidth || 2) * 0.75);
  const inset = Math.max(8, Math.min(l.w, l.h) * 0.025);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  if (frame === "lace") {
    // 縁の山ひとつに穴ひとつ。山の少し内側に並べる
    const r = laceSize(l.w, l.h), k = r * 0.7, inset2 = k + r * 1.1;
    const X0 = l.x + inset2, Y0 = l.y + inset2, X1 = l.x + l.w - inset2, Y1 = l.y + l.h - inset2;
    g.fillStyle = color;
    g.lineWidth = Math.max(1.5, lw * 0.6);
    const dots = (ax, ay, bx, by) => {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (r * 2)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        g.beginPath();
        g.arc(ax + (bx - ax) * t, ay + (by - ay) * t, r * 0.28, 0, Math.PI * 2);
        g.fill();
      }
    };
    dots(X0, Y0, X1, Y0);
    dots(X1, Y0, X1, Y1);
    dots(X1, Y1, X0, Y1);
    dots(X0, Y1, X0, Y0);
    // 穴の内側に細い線
    frameRoundRect(g, X0 + r * 0.8, Y0 + r * 0.8, X1 - X0 - r * 1.6, Y1 - Y0 - r * 1.6, Math.max(0, (l.radius || 0) - inset2));
    g.stroke();
  } else if (frame === "double") {
    frameRoundRect(g, l.x + inset, l.y + inset, l.w - inset * 2, l.h - inset * 2, Math.max(0, (l.radius || 0) - inset));
    g.stroke();
  } else {
    // 四隅にカギ型の飾り
    const len = Math.min(l.w, l.h) * 0.12 + 12;
    const x0 = l.x + inset, y0 = l.y + inset, x1 = l.x + l.w - inset, y1 = l.y + l.h - inset;
    g.lineCap = "round";
    g.lineWidth = lw * 1.4;
    g.beginPath();
    for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) {
      g.moveTo(cx + dx * len, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + dy * len);
    }
    g.stroke();
  }
  g.restore();
}

// ---------- オリジナル枠の部品 ----------
// 部品の線:点を並べて、なめらかにつなぐ(アイコンメーカーと同じ計算)
//   点 { x, y, corner, hIn, hOut }。hIn / hOut(曲がり具合のハンドル)が無い点は自動でなめらかにする
function pieceHandles(p, i) {
  const P = p.pts, n = P.length, q = P[i];
  const at = (k) => (p.closed ? P[(k + n) % n] : P[Math.max(0, Math.min(n - 1, k))]);
  const hasIn = p.closed || i > 0, hasOut = p.closed || i < n - 1;
  if (q.corner) return { in: hasIn ? q.hIn ?? q : null, out: hasOut ? q.hOut ?? q : null };
  const a = at(i - 1), b = at(i + 1);
  return {
    in: hasIn ? q.hIn ?? { x: q.x - (b.x - a.x) / 6, y: q.y - (b.y - a.y) / 6 } : null,
    out: hasOut ? q.hOut ?? { x: q.x + (b.x - a.x) / 6, y: q.y + (b.y - a.y) / 6 } : null,
  };
}

// 区間がまっすぐな線か(両端が角の点で、その区間側のハンドルを動かしていない)
const isStraight = (p1, p2) => p1.corner && p2.corner && !p1.hOut && !p2.hIn;

function pieceD(p) {
  const P = p.pts, n = P.length, f = (v) => Math.round(v * 100) / 100;
  if (!n) return "";
  if (n === 1) return `M${f(P[0].x)},${f(P[0].y)}l0.01,0`;
  let d = `M${f(P[0].x)},${f(P[0].y)}`;
  const segs = p.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n, p1 = P[i], p2 = P[j];
    if (isStraight(p1, p2)) {
      d += `L${f(p2.x)},${f(p2.y)}`;
      continue;
    }
    const c1 = pieceHandles(p, i).out, c2 = pieceHandles(p, j).in;
    d += `C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return p.closed ? d + "Z" : d;
}

const isFilledPiece = (p) => p.fill && p.closed && p.pts.length > 2;

// 同じ線を何度も描くので、Path2D は作ったものを覚えておく
const piecePathCache = new Map();
function piecePath2D(p) {
  const d = pieceD(p);
  let path = piecePathCache.get(d);
  if (!path) {
    path = new Path2D(d);
    piecePathCache.set(d, path);
    if (piecePathCache.size > 500) piecePathCache.delete(piecePathCache.keys().next().value);
  }
  return path;
}

// 部品の線をまとめて描く(g には位置・向き・大きさの変換をかけておく)
function drawPieces(g, paths, col, color0) {
  for (const p of paths) {
    if (!p.pts.length) continue;
    const path = piecePath2D(p), color = p.cut ? "#000" : color0 ?? col(p.color ?? "@accent");
    if (p.cut) {
      g.save();
      g.globalCompositeOperation = "destination-out";
    }
    if (isFilledPiece(p)) {
      g.fillStyle = color;
      g.fill(path, "evenodd");
    } else {
      g.strokeStyle = color;
      g.lineWidth = p.w ?? 4;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.stroke(path);
    }
    if (p.cut) g.restore();
  }
}

// 部品を描くマスの大きさ:角の飾りは 100×100、辺の模様は 100×50(上の辺がパネルの縁)
const CORNER_BOX = 100, EDGE_W = 100, EDGE_H = 50;

// オリジナル枠の飾り:角の飾りを四隅に(反転して)置き、辺の模様を各辺に繰り返し並べる
function drawCustomDecoration(g, def, l, col) {
  const m = Math.min(l.w, l.h);
  const inset = (def.inset ?? 0.02) * m;
  const x0 = l.x + inset, y0 = l.y + inset, x1 = l.x + l.w - inset, y1 = l.y + l.h - inset;
  const corner = def.corner?.paths?.length ? def.corner : null;
  const edge = def.edge?.paths?.length ? def.edge : null;
  const cs = corner ? (corner.size ?? 0.2) * m : 0; // 角の飾りの一辺の長さ
  g.save();
  if (corner) {
    const s = cs / CORNER_BOX;
    // 左上はそのまま、右上は左右反転、左下は上下反転、右下は両方
    for (const [a, d, e, f] of [[s, s, x0, y0], [-s, s, x1, y0], [s, -s, x0, y1], [-s, -s, x1, y1]]) {
      g.save();
      g.transform(a, 0, 0, d, e, f);
      drawPieces(g, corner.paths, col);
      g.restore();
    }
  }
  if (edge) {
    const eh = (edge.size ?? 0.07) * m, s = eh / EDGE_H, pw = EDGE_W * s, gap = (edge.gap ?? 0.4) * pw;
    // 角の飾りがある所には並べない
    const runs = [
      // [始まり, 終わり, 変換を作る関数(位置)]  ※ 縦の辺は、模様の横方向が辺に沿って下向きになるように回す
      [x0 + cs, x1 - cs, (u) => [s, 0, 0, s, u, y0]], // 上
      [x0 + cs, x1 - cs, (u) => [s, 0, 0, -s, u, y1]], // 下
      [y0 + cs, y1 - cs, (v) => [0, s, s, 0, x0, v]], // 左
      [y0 + cs, y1 - cs, (v) => [0, s, -s, 0, x1, v]], // 右
    ];
    for (const [from, to, tf] of runs) {
      const L = to - from;
      const n = Math.max(0, Math.floor((L + gap) / (pw + gap)));
      if (!n) continue;
      const start = from + (L - (n * pw + (n - 1) * gap)) / 2; // 両端の余りを同じにして真ん中にそろえる
      for (let i = 0; i < n; i++) {
        g.save();
        g.transform(...tf(start + i * (pw + gap)));
        drawPieces(g, edge.paths, col);
        g.restore();
      }
    }
  }
  g.restore();
}

// 切り抜きがあるときは、別の canvas に描いてから重ねる(切り抜きで、その下にある絵まで消さないように)
//   needed が false なら、そのまま g に描く
let cutLayer = null;
function drawIsolated(g, needed, draw) {
  if (!needed) return draw(g);
  cutLayer ??= document.createElement("canvas");
  if (cutLayer.width !== g.canvas.width) cutLayer.width = g.canvas.width;
  if (cutLayer.height !== g.canvas.height) cutLayer.height = g.canvas.height;
  const t = cutLayer.getContext("2d");
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, cutLayer.width, cutLayer.height);
  t.setTransform(g.getTransform());
  draw(t);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(cutLayer, 0, 0);
  g.restore();
}
const hasCut = (paths) => !!paths?.some((p) => p.cut && p.pts.length);

// パネル1枚(土台の塗り・枠線・飾り)を描く。切り抜きのある枠は、パネルだけを別に描いてから重ねる
function drawFramePanel(g, frame, l, col, fill, alpha = 1) {
  const { def } = resolveFrame(frame);
  const cut = !!def && [def.corner, def.edge, def.border].some((part) => hasCut(part?.paths));
  drawIsolated(g, cut, (t) => {
    framePath(t, frame, l.x, l.y, l.w, l.h, l.radius);
    t.save();
    t.globalAlpha *= alpha;
    t.fillStyle = fill;
    t.fill();
    t.restore();
    strokeFrameBorder(t, frame, l, col);
    drawFrameDecoration(t, frame, l, col);
  });
}

// ---------- オリジナルシンボル ----------
// シンボルエディタで作る、図形の要素。{ id, name, w, h(描くマスの大きさ。長い辺が 100), symbol: { paths } }
//   保存先はこのブラウザ(characa:symbols)。キャラカの要素「シンボル」は { symbol: id, x, y, w, h, color }
const SYMBOLS_KEY = "characa:symbols";
function loadSymbols() {
  try {
    const list = JSON.parse(localStorage.getItem(SYMBOLS_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function saveSymbols(list) {
  try {
    localStorage.setItem(SYMBOLS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
const findSymbol = (id) => (id ? loadSymbols().find((s) => s.id === id) ?? null : null);

// シンボルを箱(x, y, w, h)いっぱいに描く。縦横は箱に合わせて伸び縮みする。color は全部の線・図形の色
//   切り抜きは、そのシンボルの中だけを透明にする
function drawSymbol(g, sym, x, y, w, h, color) {
  const paths = sym?.symbol?.paths ?? [];
  if (!paths.length) return;
  drawIsolated(g, hasCut(paths), (t) => {
    t.save();
    t.transform(w / (sym.w || 100), 0, 0, h / (sym.h || 100), x, y);
    drawPieces(t, paths, (v) => v, color);
    t.restore();
  });
}

// シンボルの見本(一覧のボタン用):縦横比を保って canvas の真ん中に
function drawSymbolPreview(canvas, sym, color, pad = 4) {
  const g = canvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const sw = sym.w || 100, sh = sym.h || 100;
  const k = Math.min((canvas.width - pad * 2) / sw, (canvas.height - pad * 2) / sh);
  drawSymbol(g, sym, (canvas.width - sw * k) / 2, (canvas.height - sh * k) / 2, sw * k, sh * k, color);
}

// ---------- 見本 ----------
// 最初からある枠の見本(小さな SVG)
const FRAME_PREVIEW = {
  round: '<rect x="4" y="4" width="52" height="32" rx="9"/>',
  square: '<rect x="4" y="4" width="52" height="32"/>',
  cut: '<path d="M14 4H46L56 14V26L46 36H14L4 26V14Z"/>',
  double: '<rect x="4" y="4" width="52" height="32" rx="9"/><rect x="10" y="10" width="40" height="20" rx="4"/>',
  corner: '<rect x="4" y="4" width="52" height="32" rx="9"/><path d="M10 17V10H17M43 10H50V17M50 23V30H43M17 30H10V23"/>',
  lace: '<path d="' + laceOutline(3, 3, 54, 34, 4).map(([c, ...v]) => c + v.map((n) => Math.round(n * 10) / 10).join(" ")).join("") + 'Z"/><rect x="13" y="13" width="34" height="14" rx="3" fill="none"/>',
};

// オリジナル枠の見本を canvas に描く(パネル1枚)
function drawFramePreview(canvas, frame, col, opt = {}) {
  const g = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, pad = opt.pad ?? Math.round(Math.min(W, H) * 0.08);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const l = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2, radius: opt.radius ?? Math.min(W, H) * 0.1, borderWidth: opt.borderWidth ?? 2, borderColor: "@accent" };
  drawFramePanel(g, frame, l, col, opt.fill ?? col("@panel"), opt.alpha ?? 1);
}
