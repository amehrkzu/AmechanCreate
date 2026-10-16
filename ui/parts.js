"use strict";
// 自分で作った部品(UIパーツメーカーで作る)。設計データから CSS と HTML を作る
//   UIパーツメーカー(ui-maker.html)と UI見本帳(ui-kit.html)の両方で使う
//   見た目のしくみは ui/kit.css の「自由ボタン」(.ub)。ここでは変数とクラスを決めるだけ

const UI_SHAPES_KEY = "uikit:shapes"; // 保存した形(自分で描いた形)

// 部品の種類。shapes は選べる形、opts はその種類だけの調整欄
const UB_TYPES = [
  { id: "button", name: "ボタン", icon: '<rect x="6" y="11" width="48" height="18" rx="9"/>',
    shapes: ["pill", "round", "square", "leaf", "circle", "bubble", "tag", "heart", "cloud", "custom"] },
  { id: "box", name: "箱", icon: '<rect x="6" y="4" width="48" height="32" rx="6"/><path d="M13 13H33M13 21H47M13 27H40"/>',
    shapes: ["round", "square", "leaf", "bubble", "cloud", "custom"] },
  { id: "chip", name: "チップ", icon: '<rect x="3" y="13" width="17" height="13" rx="6.5"/><rect x="22" y="13" width="17" height="13" rx="6.5"/><rect x="41" y="13" width="16" height="13" rx="6.5"/>',
    shapes: ["pill", "round", "square", "leaf", "tag", "custom"] },
  { id: "tab", name: "タブ", icon: '<path d="M4 30V16Q4 10 10 10H22Q28 10 28 16V30"/><path d="M32 30V18Q32 14 36 14H52Q56 14 56 18V30"/><path d="M2 30H58"/>',
    shapes: ["pill", "round", "square", "leaf", "sticky", "tag", "custom"] },
  { id: "vtab", name: "縦タブ", icon: '<rect x="6" y="3" width="26" height="34" rx="3" stroke-dasharray="3 3"/><path d="M32 6H40Q44 6 44 10V15Q44 19 40 19H32"/><path d="M32 21H37Q41 21 41 25V30Q41 34 37 34H32"/>',
    shapes: ["pill", "round", "square", "custom"] },
  { id: "drawer", name: "サイドバー", icon: '<rect x="3" y="5" width="54" height="30" rx="4" stroke-dasharray="3 3"/><rect x="3" y="5" width="24" height="30" rx="4"/><path d="M27 12H32V24H27"/><path d="M8 12H21M8 18H19M8 24H17"/>',
    shapes: ["round", "square"] },
  { id: "scroll", name: "スクロールバー", icon: '<rect x="5" y="4" width="50" height="32" rx="5"/><path d="M11 12H37M11 19H40M11 26H33"/><rect x="45" y="9" width="5" height="12" rx="2.5"/>',
    shapes: ["pill", "round", "square"] },
];
const ubType = (p) => UB_TYPES.find((t) => t.id === p.type) ?? UB_TYPES[0];

// 形
const UB_SHAPES = [
  { id: "pill", name: "まるいだけ", icon: '<rect x="4" y="9" width="52" height="22" rx="11"/>' },
  { id: "round", name: "角まる", icon: '<rect x="4" y="8" width="52" height="24" rx="6"/>' },
  { id: "square", name: "四角", icon: '<rect x="4" y="8" width="52" height="24"/>' },
  { id: "leaf", name: "葉っぱ", icon: '<path d="M16 8H54V20A12 12 0 0 1 42 32H4V20A12 12 0 0 1 16 8Z"/>' },
  { id: "sticky", name: "付箋", icon: '<path d="M4 34V16Q4 8 12 8H48Q56 8 56 16V34"/>' },
  { id: "circle", name: "まんまる", icon: '<circle cx="30" cy="20" r="15"/>' },
  { id: "bubble", name: "吹き出し", icon: '<path d="M10 5H50Q55 5 55 10V24Q55 29 50 29H24L16 37L17 29H10Q5 29 5 24V10Q5 5 10 5Z"/>' },
  { id: "tag", name: "タグ", icon: '<path d="M16 8H54V32H16L5 20Z"/><circle cx="15" cy="20" r="2"/>' },
  { id: "heart", name: "ハート", icon: '<path d="M30 36C17 28 9 21 9 13C9 7 14 4 19 4C24 4 28 7 30 11C32 7 36 4 41 4C46 4 51 7 51 13C51 21 43 28 30 36Z"/>' },
  { id: "cloud", name: "雲", icon: '<path d="M14 33C7 33 4 28 6 23C2 19 6 12 13 13C15 7 23 5 28 9C32 3 42 3 45 9C51 6 57 10 56 17C60 21 57 33 49 33Z"/>' },
  { id: "custom", name: "自分で描く", icon: '<path d="M8 30C8 16 18 8 30 10S52 14 50 26 34 34 22 32" stroke-dasharray="3 3"/><path d="M40 6L48 14L30 32L22 34L24 26Z" fill="none"/>' },
];

// ---------- 自分で描く形 ----------
// { w, h(描くマスの大きさ), pts: [{ x, y, corner, hIn, hOut }](hIn・hOut はなめらかな点のハンドル。点からのずれ), mirror(左半分を描いて右へ反転), keep(縦横比を保つ), width(縦横比を保つときの幅 px), pad(文字のまわりの余白 px) }
const UB_CUSTOM_GRIDS = { wide: [200, 100], long: [300, 100], square: [100, 100], tall: [100, 140] };
function newCustomShape(grid = "wide") {
  const [w, h] = UB_CUSTOM_GRIDS[grid];
  // 初めは左右対称の、ぷっくりした豆の形(左半分の点)
  return {
    grid, w, h, mirror: true, keep: false, width: 120, pad: 6,
    pts: [{ x: w / 2, y: h * 0.1 }, { x: w * 0.12, y: h * 0.12 }, { x: w * 0.03, y: h * 0.5 }, { x: w * 0.12, y: h * 0.88 }, { x: w / 2, y: h * 0.9 }],
  };
}
// 左右対称のときは、左半分の点を右へ反転して1周の点にする(真ん中の線の上の点は重ねない)
function customOutline(c) {
  const pts = c.pts ?? [];
  if (!c.mirror) return pts;
  const axis = c.w / 2;
  // 反転すると並びが逆になるので、ハンドルの入りと出も入れかえる
  const flip = (h) => (h ? { x: -h.x, y: h.y } : undefined);
  const right = pts.slice().reverse().filter((p) => Math.abs(p.x - axis) > 0.5)
    .map((p) => ({ x: c.w - p.x, y: p.y, corner: p.corner, hIn: flip(p.hOut), hOut: flip(p.hIn) }));
  return [...pts, ...right];
}
// なめらかな点のハンドル(点からのずれ)。dir = 1 で次の点へ向かう側、-1 で前の点から来る側
//   自分で動かしていなければ、となりの点から自動で決める
function customHandle(P, i, dir) {
  const q = P[i], own = dir > 0 ? q.hOut : q.hIn;
  if (own) return own;
  const n = P.length, a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
  return { x: (dir * (b.x - a.x)) / 6, y: (dir * (b.y - a.y)) / 6 };
}
// 1周の線を、区間(点と次の点のあいだ)ごとに分ける。まっすぐな区間は c1・c2 なし
function customSegments(c) {
  const P = customOutline(c), n = P.length;
  if (n < 2) return [];
  const handle = (i, dir) => {
    const q = P[i];
    if (q.corner) return q;
    const h = customHandle(P, i, dir);
    return { x: q.x + h.x, y: q.y + h.y };
  };
  return P.map((p1, i) => {
    const j = (i + 1) % n, p2 = P[j];
    return p1.corner && p2.corner ? { i, p1, p2 } : { i, p1, p2, c1: handle(i, 1), c2: handle(j, -1) };
  });
}
// 点をなめらかにつないだパス(角の点は、とがらせる)
function customD(c) {
  const segs = customSegments(c), f = (v) => Math.round(v * 10) / 10;
  if (!segs.length) return "";
  let d = `M${f(segs[0].p1.x)},${f(segs[0].p1.y)}`;
  for (const s of segs) {
    d += s.c1 ? `C${f(s.c1.x)},${f(s.c1.y)} ${f(s.c2.x)},${f(s.c2.y)} ${f(s.p2.x)},${f(s.p2.y)}` : `L${f(s.p2.x)},${f(s.p2.y)}`;
  }
  return d + "Z";
}
// (x, y) にいちばん近い線の上の位置。{ seg(区間の番号), x, y, dist }。only で調べる区間をしぼれる
function customNearest(c, x, y, only = () => true) {
  let best = null;
  for (const s of customSegments(c)) {
    if (!only(s.i)) continue;
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, u = 1 - t;
      const q = s.c1
        ? { x: u * u * u * s.p1.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p2.x, y: u * u * u * s.p1.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p2.y }
        : { x: s.p1.x + (s.p2.x - s.p1.x) * t, y: s.p1.y + (s.p2.y - s.p1.y) * t };
      const dist = Math.hypot(q.x - x, q.y - y);
      if (!best || dist < best.dist) best = { seg: s.i, x: q.x, y: q.y, dist };
    }
  }
  return best;
}
// SVG で描く形のパス(部品の大きさに合わせて伸び縮みする)
const UB_SVG = {
  tag: { box: "0 0 100 40", d: "M14 1.5H97Q98.5 1.5 98.5 3V37Q98.5 38.5 97 38.5H14L1.5 20Z" },
  heart: { box: "0 0 100 90", d: "M50 87C20 67 3 49 3 28C3 13 15 3 28 3C38 3 46 9 50 18C54 9 62 3 72 3C85 3 97 13 97 28C97 49 80 67 50 87Z" },
  cloud: { box: "0 0 200 100", d: "M44 96C18 96 4 80 10 62C-2 50 10 26 32 30C36 10 60 2 76 14C88 -2 118 -2 128 16C144 4 172 10 172 32C194 30 204 54 190 68C198 84 182 98 160 96Z" },
};
const UB_RADIUS_SHAPES = ["round"]; // 角の丸みを変えられる形
const UB_CLASS_SHAPES = ["circle", "leaf", "sticky", "bubble", "tag", "heart", "cloud", "custom"]; // クラスで形を決めるもの

// 色:テーマの色(テーマを変えると一緒に変わる)。"#xxxxxx" は自由な色
const UB_COLORS = [
  ["box", "白"],
  ["tint", "うす色"],
  ["primary", "主役"],
  ["accent", "アクセント"],
  ["ink", "枠線"],
  ["ink-soft", "影"],
  ["line", "細線"],
  ["text", "文字"],
  ["muted", "ひかえめ"],
  ["dot", "模様"],
  ["pink", "付箋・ピンク"],
  ["orange", "付箋・オレンジ"],
  ["lemon", "付箋・レモン"],
  ["mint", "付箋・ミント"],
  ["sky", "付箋・水色"],
  ["lilac", "付箋・ラベンダー"],
  ["danger", "警告"],
  ["danger-bg", "警告(うすい)"],
];
const ubColor = (v) => (v && v[0] === "#" ? v : `var(--${v || "box"})`);

// 文字の大きさ, 横の余白, 縦の余白
const UB_SIZES = { s: [12, 10, 3], m: [14, 14, 6], l: [17, 20, 9] };
const UB_BOX_SIZES = { s: [13, 12, 10], m: [14, 16, 14], l: [16, 22, 20] };
const UB_DASH = { solid: "none", dashed: "6 4", dotted: "1 4" };

const ubId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// 種類ごとの初めの値
function newPart(type = "button") {
  const base = {
    id: ubId(),
    type,
    name: "",
    desc: "",
    label: "ボタン",
    labels: "すべて、新着、人気", // チップ・タブの文字(「、」か「,」で区切る)
    title: "見出し",
    body: "ここに文章が入ります。",
    shape: "pill",
    radius: 10,
    size: "m",
    block: false,
    bg: "box",
    fg: "text",
    bd: "ink",
    sh: "ink-soft",
    pat: "dot",
    tc: "accent", // 箱の見出しの色
    onBg: "sky", // 選んだとき(チップ・タブ)
    onFg: "text",
    onBd: "ink",
    bw: 2,
    bs: "solid",
    shadow: "puffy",
    pattern: "none",
    hover: "none",
    press: "sink",
    deco: "",
    decoPos: "before",
    custom: null, // 自分で描く形(形が「自分で描く」のとき)
    // スクロールバーだけで使う:溝の色・溝のふちの色・のせたときのつまみの色・つまみと溝のすき間(px)
    track: "tint",
    trackBd: "line",
    thumbHover: "accent",
    gap: 2,
    // サイドバーだけで使う:つまみの色・開いているときのつまみの色・出てくる向き・出かた
    handleBg: "sky",
    handleOn: "box",
    side: "left",
    anim: "slide",
  };
  if (type === "box") Object.assign(base, { shape: "round", radius: 16, bw: 2.5, press: "none", deco: "✿" });
  if (type === "chip") Object.assign(base, { size: "s", bg: "lemon", onBg: "accent", onFg: "box", labels: "#FF14、#ミラプリ、#スクショ" });
  if (type === "tab") Object.assign(base, { size: "s", block: true, bd: "line", fg: "muted", shadow: "none", press: "none" });
  if (type === "scroll") Object.assign(base, { bg: "primary", bd: "ink", bw: 2, shadow: "none", press: "none" });
  if (type === "vtab") Object.assign(base, { size: "s", shape: "round", radius: 12, fg: "muted", onBg: "sky", onFg: "text", press: "none", side: "right", labels: "レイヤー、色、設定" });
  if (type === "drawer") Object.assign(base, { shape: "round", radius: 16, bw: 2.5, press: "none", label: "レイヤー", title: "レイヤー", body: "ここに中身が入ります。" });
  return base;
}

const ubIsSvg = (p) => !!UB_SVG[p.shape] || p.shape === "custom";
const ubClassName = (p) => "ub-" + p.id;
const ubLabels = (p) => String(p.labels || "").split(/[、,]/).map((s) => s.trim()).filter(Boolean);

// スクロールバーの太さ(px)
const UB_SCROLL_SIZES = { s: 8, m: 12, l: 16 };

// サイドバーの幅(px)
const UB_DRAWER_SIZES = { s: 240, m: 320, l: 400 };

// その部品だけの CSS(変数を決める)
function partCSS(p) {
  if (p.type === "drawer") {
    const vars = [
      `--ud-w: ${UB_DRAWER_SIZES[p.size] ?? 320}px;`,
      `--ud-r: ${p.shape === "square" ? 0 : p.radius}px;`,
      `--ud-bg: ${ubColor(p.bg)};`,
      `--ud-fg: ${ubColor(p.fg)};`,
      `--ud-bd: ${ubColor(p.bd)};`,
      `--ud-bw: ${p.bs === "none" ? 0 : p.bw}px;`,
      p.bs !== "solid" && p.bs !== "none" ? `--ud-bs: ${p.bs};` : "",
      `--ud-sh: ${ubColor(p.sh)};`,
      `--ud-hbg: ${ubColor(p.handleBg)};`,
      `--ud-hon: ${ubColor(p.handleOn)};`,
    ].filter(Boolean);
    return `/* ${p.name || "自分で作った部品"}(サイドバー)${p.desc ? ":" + p.desc : ""} */\n.${ubClassName(p)} {\n  ${vars.join("\n  ")}\n}`;
  }
  if (p.type === "scroll") {
    const r = p.shape === "square" ? "0" : p.shape === "round" ? `${p.radius}px` : "999px";
    const vars = [
      `--us-w: ${UB_SCROLL_SIZES[p.size] ?? 12}px;`,
      `--us-r: ${r};`,
      `--us-thumb: ${ubColor(p.bg)};`,
      `--us-hover: ${ubColor(p.thumbHover)};`,
      `--us-ring: ${ubColor(p.bd)};`,
      `--us-ringw: ${p.bs === "none" ? 0 : p.bw}px;`,
      `--us-gap: ${p.gap}px;`,
      `--us-track: ${ubColor(p.track)};`,
      `--us-tring: ${ubColor(p.trackBd)};`,
    ];
    return `/* ${p.name || "自分で作った部品"}(スクロールバー)${p.desc ? ":" + p.desc : ""} */\n.${ubClassName(p)} {\n  ${vars.join("\n  ")}\n}`;
  }
  const [fs, px, py] = (p.type === "box" ? UB_BOX_SIZES : UB_SIZES)[p.size] ?? UB_SIZES.m;
  const svg = ubIsSvg(p);
  const vars = [
    `--ub-bg: ${ubColor(p.bg)};`,
    `--ub-fg: ${ubColor(p.fg)};`,
    `--ub-bd: ${ubColor(p.bd)};`,
    `--ub-sh: ${ubColor(p.sh)};`,
    p.pattern !== "none" && !svg ? `--ub-pat: ${ubColor(p.pat)};` : "",
    p.type === "box" ? `--ub-title: ${ubColor(p.tc)};` : "",
    // 二重線は、線・すき間・線の3つ分の太さにする(CSS の double は太さが足りないと1本に見えるため)
    `--ub-bw: ${p.bs === "none" ? 0 : p.bs === "double" && !svg ? p.bw * 3 : p.bw}px;`,
    p.bs === "double" && p.shape === "bubble" ? `--ub-lw: ${p.bw}px;` : "", // 吹き出しのしっぽは1本の線の太さで描く
    !svg && p.bs !== "solid" ? `--ub-bs: ${p.bs === "none" ? "solid" : p.bs};` : "",
    svg && p.bs !== "solid" && p.bs !== "none" ? `--ub-dash: ${UB_DASH[p.bs] ?? "none"};` : "",
    p.shape === "round" ? `--ub-r: ${p.radius}px;` : p.shape === "square" ? "--ub-r: 0;" : "",
    p.size !== "m" || p.type === "box" ? `--ub-fs: ${fs}px; --ub-px: ${px}px; --ub-py: ${py}px;` : "",
    p.shape === "custom" && p.custom ? `--ub-xp: ${p.custom.pad}px;` : "",
    p.shape === "custom" && p.custom?.keep ? `--ub-ar: ${p.custom.w} / ${p.custom.h}; --ub-w: ${p.custom.width}px;` : "",
  ].filter(Boolean);
  let css = `/* ${p.name || "自分で作った部品"}(${ubType(p).name})${p.desc ? ":" + p.desc : ""} */\n.${ubClassName(p)} {\n  ${vars.join("\n  ")}\n}`;
  // 選んでいるとき(チップ・タブ・縦タブ)
  if (p.type === "chip" || p.type === "tab" || p.type === "vtab") {
    css += `\n.${ubClassName(p)}[aria-pressed="true"] {\n  --ub-bg: ${ubColor(p.onBg)};\n  --ub-fg: ${ubColor(p.onFg)};\n  --ub-bd: ${ubColor(p.onBd)};\n}`;
  }
  return css;
}

function partClasses(p) {
  const svg = ubIsSvg(p);
  return [
    "ub",
    p.type === "box" ? "ub--box" : "",
    p.type === "vtab" ? "ub--vtab" : "",
    UB_CLASS_SHAPES.includes(p.shape) ? "ub--" + p.shape : "",
    svg ? "ub--svg" : "",
    svg && p.bs === "double" ? "ub--dbl" : "",
    p.shape === "custom" && p.custom?.keep ? "ub--keep" : "",
    p.shadow !== "none" ? "ub--sh-" + p.shadow : "",
    p.hover !== "none" ? "ub--hover-" + p.hover : "",
    p.press !== "none" && p.type !== "box" ? "ub--press-" + p.press : "",
    p.pattern !== "none" && !svg ? "ub--pat-" + p.pattern : "",
    p.block && p.type === "button" ? "ub--block" : "",
    ubClassName(p),
  ].filter(Boolean).join(" ");
}

const escapeHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function withDeco(p, text) {
  const t = escapeHTML(text);
  if (!p.deco) return t;
  if (p.decoPos === "after") return `${t} ${p.deco}`;
  if (p.decoPos === "both") return `${p.deco} ${t} ${p.deco}`;
  return `${p.deco} ${t}`;
}

function ubShapeSVG(p) {
  const s = p.shape === "custom" ? (p.custom ? { box: `0 0 ${p.custom.w} ${p.custom.h}`, d: customD(p.custom) } : null) : UB_SVG[p.shape];
  // 二重線:太い線の上に、中の色の細い線を重ねて、2本に見せる
  const gap = s && p.bs === "double" ? `<path class="ub-gap" d="${s.d}"/>` : "";
  return s ? `<svg class="ub-shape" viewBox="${s.box}" preserveAspectRatio="none" aria-hidden="true"><path d="${s.d}"/>${gap}</svg>` : "";
}

// その部品の HTML(inside:見本用。画面全体ではなく、囲んだ箱の中で出し入れする。最初から開いておく)
function partHTML(p, { inside = false } = {}) {
  if (p.type === "drawer") {
    const cls = ["ub-drawer", p.side === "right" && "ub-drawer--right", p.anim !== "slide" && "ub-drawer--" + p.anim,
      p.shadow !== "none" && "ub-drawer--sh-" + p.shadow, inside && "ub-drawer--inside open", ubClassName(p)].filter(Boolean).join(" ");
    const title = p.title ? `<h2 style="margin: 0 0 8px; font-size: 15px;">${escapeHTML(p.title)}</h2>` : "";
    const body = p.body ? `<p style="margin: 0;">${escapeHTML(p.body).replace(/\n/g, "<br>")}</p>` : "";
    return `<aside class="${cls}"><div class="ub-drawer-panel">${title}${body}</div><button type="button" class="ub-drawer-handle" aria-expanded="${inside}">${withDeco(p, p.label || "メニュー")}</button></aside>`;
  }
  if (p.type === "scroll") {
    // 見本:スクロールする箱。使うときは、スクロールさせたい入れ物に class を付けるだけ
    const lines = ["スクロールしてみてね", "つまみをドラッグしても動きます", "マウスをのせると色が変わります", "ここは見本の文章です", "なんでも入れられます", "いちばん下まで来たかな?", "おしまい"];
    return `<div class="ub-scroll${p.size === "s" ? " ub-scroll--thin" : ""} ${ubClassName(p)}" tabindex="0" style="max-height: 120px; padding: 8px 12px; background: var(--box); border: 2px solid var(--line); border-radius: 12px; color: var(--text);">${lines.map((l) => `<p style="margin: 0 0 10px;">${l}</p>`).join("")}</div>`;
  }
  const cls = partClasses(p), shape = ubShapeSVG(p);
  if (p.type === "box") {
    const title = p.title ? `<h2>${withDeco(p, p.title)}</h2>` : "";
    const body = p.body ? `<p>${escapeHTML(p.body).replace(/\n/g, "<br>")}</p>` : "";
    return `<section class="${cls}">${shape}${title}${body}</section>`;
  }
  if (p.type === "chip" || p.type === "tab" || p.type === "vtab") {
    const labels = ubLabels(p);
    const items = (labels.length ? labels : ["A"]).map((l, i) => `<button type="button" class="${cls}" aria-pressed="${i === 0}">${shape}${withDeco(p, l)}</button>`).join("");
    if (p.type === "vtab") return `<div class="ub-vtabs${p.side === "left" ? " ub-vtabs--left" : ""}" role="group">${items}</div>`;
    return p.type === "chip"
      ? `<div class="ub-chips">${items}</div>`
      : `<div class="ub-tabs${p.block ? " ub-tabs--fill" : ""}${p.shape === "sticky" ? " ub-tabs--sticky" : ""}" role="group">${items}</div>`;
  }
  return `<button type="button" class="${cls}">${shape}${withDeco(p, p.label || "ボタン")}</button>`;
}

// 見本を触れるように(チップは押すたびにオン・オフ、タブは押したものだけオン)
function bindPartDemo(root) {
  root.addEventListener("click", (e) => {
    const h = e.target.closest(".ub-drawer-handle");
    if (h) {
      const open = h.closest(".ub-drawer").classList.toggle("open");
      h.setAttribute("aria-expanded", String(open));
      return;
    }
    const b = e.target.closest(".ub-chips > .ub, .ub-tabs > .ub, .ub-vtabs > .ub");
    if (!b) return;
    if (b.parentElement.classList.contains("ub-chips")) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    else for (const x of b.parentElement.children) x.setAttribute("aria-pressed", x === b ? "true" : "false");
  });
}

// AI に渡す文章(これを貼ると、この見た目の部品を使ってもらえる)
function partForAI(p) {
  return [
    "この見た目の部品を使ってください(UIパーツメーカーで作りました)。",
    `種類:${ubType(p).name}`,
    p.name ? `名前:${p.name}` : null,
    p.shape === "custom" && p.custom?.name ? `形:${p.custom.name}(自分で描いた形)` : null,
    p.desc ? `使いどころ:${p.desc}` : null,
    p.type === "vtab" ? "サイドバーのふちに縦に並べるタブ。押したタブだけ aria-pressed=\"true\" にして、そのタブの中身を出す。.ub-vtabs はサイドバーのふちにくっつけて置く(右に出るときはサイドバーの右はし、.ub-vtabs--left のときは左はし)" : null,
    p.type === "drawer" ? "つまみ(.ub-drawer-handle)を押したら、.ub-drawer に open を付け外しして出し入れする(しくみは ui/kit.css の「自由サイドバー」)" : null,
    "",
    "CSS:",
    partCSS(p),
    "",
    "HTML:",
    partHTML(p),
    "",
    "設計データ:",
    JSON.stringify(p),
  ].filter((l) => l !== null).join("\n");
}

// どこでも使える版の AI に渡す文章。ui/kit.css の中身(kitCss)から、テーマの色と自由ボタンのしくみを取り出して一緒に渡す
//   テーマの色は .ub などの部品の中だけで決める(貼る先のページの CSS 変数とぶつからないように)
function partForAnywhere(p, kitCss) {
  const UBS = ".ub, .ub-chips, .ub-tabs, .ub-vtabs, .ub-scroll, .ub-drawer";
  const theme = kitCss.slice(kitCss.indexOf("/* ---------- テーマ"), kitCss.indexOf("* { box-sizing"))
    .replace(':root, [data-theme="sora"] {', `${UBS}, [data-theme="sora"] :is(${UBS}) {`)
    .replace(/^\[data-theme="(\w+)"\] \{/gm, (_, id) => `[data-theme="${id}"] :is(${UBS}) {`) // sora 以外のテーマ(ichigo・mikan・remon・mori・budo…)をぜんぶ
    .replace(":root {", `${UBS} {`)
    .replace(/\n\s*color-scheme: light;/, "")
    .trim();
  const machine = kitCss.slice(kitCss.indexOf("/* ---------- 自由ボタン")).trim();
  const js = p.type === "drawer"
    ? [
        "",
        "JavaScript(つまみを押すと出し入れ。.ub-drawer に open が付くと出る):",
        'document.addEventListener("click", (e) => {',
        '  const h = e.target.closest(".ub-drawer-handle");',
        "  if (!h) return;",
        '  const open = h.closest(".ub-drawer").classList.toggle("open");',
        '  h.setAttribute("aria-expanded", String(open));',
        "});",
      ]
    : p.type === "chip" || p.type === "tab" || p.type === "vtab"
    ? [
        "",
        "JavaScript(押したときの切り替え。チップは押すたびにオン・オフ、タブは押したものだけオン):",
        'document.addEventListener("click", (e) => {',
        '  const b = e.target.closest(".ub-chips > .ub, .ub-tabs > .ub, .ub-vtabs > .ub");',
        "  if (!b) return;",
        '  if (b.parentElement.classList.contains("ub-chips")) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");',
        '  else for (const x of b.parentElement.children) x.setAttribute("aria-pressed", x === b ? "true" : "false");',
        "});",
      ]
    : [];
  return [
    "次の CSS と HTML で、この見た目の部品を作ってください。CSS はそのまま使えば、同じ見た目になります(ほかのファイルは要りません)。",
    `種類:${ubType(p).name}`,
    p.shape === "custom" && p.custom?.name ? `形:${p.custom.name}(自分で描いた形)` : null,
    p.desc ? `使いどころ:${p.desc}` : null,
    "色の組み合わせ(テーマ)は6つ。部品を囲む要素に data-theme=\"sora\"(水色)/\"ichigo\"(ピンク)/\"mikan\"(オレンジ)/\"remon\"(黄色)/\"mori\"(緑)/\"budo\"(むらさき)を付けて選ぶ。付けないときは sora。",
    "フォントは M PLUS Rounded 1c(Google Fonts)を使うとそろう。",
    "",
    "CSS:",
    "/* テーマの色 */",
    theme,
    "",
    ".ub, .ub *, .ub-shape { box-sizing: border-box; }",
    machine,
    "",
    "/* この部品 */",
    partCSS(p),
    "",
    "HTML:",
    partHTML(p),
    ...js,
  ].filter((l) => l !== null).join("\n");
}

// ---------- 保存した形(このブラウザ) ----------
// 自分で描いた形に名前を付けて覚えておく。{ sid, name, ...形のデータ }
function loadShapes() {
  try {
    const list = JSON.parse(localStorage.getItem(UI_SHAPES_KEY));
    return Array.isArray(list) ? list.filter((x) => x?.sid && Array.isArray(x.pts)) : [];
  } catch {
    return [];
  }
}
function saveShapes(list) {
  try {
    localStorage.setItem(UI_SHAPES_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// 作った部品の CSS を、ページの <style id="ub-parts"> にまとめて入れる
function injectPartsCSS(list) {
  let el = document.getElementById("ub-parts");
  if (!el) {
    el = document.createElement("style");
    el.id = "ub-parts";
    document.head.append(el);
  }
  el.textContent = list.map(partCSS).join("\n");
}
