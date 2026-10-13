"use strict";

const WORKER = "https://characa.game-rain-0406.workers.dev";
const STORAGE_KEY = "characa:v1";
const HANDLE = 14; // 選択枠の拡大縮小ハンドル(画面上の px)

const FONTS = [
  ["Noto Sans JP", "ゴシック"],
  ["Noto Serif JP", "明朝"],
  ["M PLUS Rounded 1c", "丸ゴシック"],
  ["Zen Maru Gothic", "Zen 丸ゴシック"],
  ["Dela Gothic One", "極太ゴシック"],
  ["Yusei Magic", "手書き風"],
  ["Shippori Mincho", "しっぽり明朝"],
  ["Kaisei Decol", "カイセイ デコール"],
  ["Cinzel", "Cinzel(英字)"],
  ["Cormorant Garamond", "Cormorant(英字)"],
];

// テキスト中で {key} と書くと取得データに置き換わる
const VARS = [
  ["name", "キャラ名"],
  ["title", "称号"],
  ["server", "ワールド"],
  ["dataCenter", "DC"],
  ["race", "種族"],
  ["tribe", "部族"],
  ["gender", "性別"],
  ["birthday", "誕生日"],
  ["guardian", "守護神"],
  ["hometown", "開始都市"],
  ["grandCompany", "GC"],
  ["grandCompanyRank", "GC階級"],
  ["freeCompany", "FC"],
  ["selfIntroduction", "自己紹介"],
];

const BATTLE_JOBS = ["ナイト", "戦士", "暗黒騎士", "ガンブレイカー", "白魔道士", "学者", "占星術師", "賢者", "モンク", "竜騎士", "忍者", "侍", "リーパー", "ヴァイパー", "魔獣使い", "吟遊詩人", "機工士", "踊り子", "黒魔道士", "召喚士", "赤魔道士", "ピクトマンサー", "青魔道士"];
const CRAFT_GATHER = new Set(["木工師", "鍛冶師", "甲冑師", "彫金師", "革細工師", "裁縫師", "錬金術師", "調理師", "採掘師", "園芸師", "漁師"]);
const SPECIAL = new Set(["エレメンタルレベル", "レジスタンスランク", "ナレッジレベル"]);
// ジョブ未取得のキャラは Lodestone にクラス名で出るので、対応するジョブのアイコンを使う
const CLASS_TO_JOB = { 剣術士: "ナイト", 斧術士: "戦士", 幻術士: "白魔道士", 格闘士: "モンク", 槍術士: "竜騎士", 双剣士: "忍者", 弓術士: "吟遊詩人", 呪術士: "黒魔道士", 巴術士: "召喚士" };

const SIZES = [
  [1920, 1080, "横 16:9(1920×1080)"],
  [1200, 675, "横 X向け(1200×675)"],
  [1080, 1080, "正方形(1080×1080)"],
  [1080, 1350, "縦 4:5(1080×1350)"],
  [1080, 1920, "縦 9:16(1080×1920)"],
];

const TYPE_LABEL = { text: "テキスト", image: "画像", rect: "図形", jobs: "ジョブ", symbol: "シンボル" };

// 配色の役割。要素の色に "@accent" のように書くと、選んでいる配色のその色になる
const ROLES = [
  ["accent", "アクセント"],
  ["text", "文字"],
  ["sub", "サブ文字"],
  ["muted", "控えめ"],
  ["panel", "パネル"],
  ["bg1", "背景1"],
  ["bg2", "背景2"],
  ["shadow", "影"],
];
const FALLBACK_PALETTE = { accent: "#e0c27a", text: "#ffffff", sub: "#cfd6e6", muted: "#6b7280", panel: "#000000", bg1: "#1c2333", bg2: "#4a3558", shadow: "#000000" };
// templates/index.js で定義(読み込めなかったときは空)
const TEMPLATE_LIST = window.CHARACA_TEMPLATES ?? [];
const PALETTES = window.CHARACA_PALETTES ?? [];

const DEFAULTS = {
  text: { text: "テキスト", font: "Noto Sans JP", size: 48, color: "@text", bold: false, italic: false, align: "left", lineHeight: 1.4, spacing: 0, width: 0, strokeColor: "#000000", strokeWidth: 0, shadow: true, opacity: 1 },
  image: { src: "", w: 640, h: 360, fit: "cover", zoom: 1, posX: 0, posY: 0, radius: 0, flip: false, opacity: 1, ...FX_DEFAULTS },
  rect: { w: 400, h: 240, color: "@panel", radius: 16, borderColor: "@accent", borderWidth: 0, opacity: 0.4 },
  symbol: { symbol: "", w: 240, h: 240, color: "@accent", opacity: 1 }, // シンボルエディタで作った形(symbol は id)
  jobs: { display: "icon", filter: "battle", hideUnlearned: false, cols: 6, cellW: 155, font: "Noto Sans JP", size: 28, bold: false, iconColor: "@text", color: "@text", levelColor: "@accent", dimColor: "@muted", shadow: true, opacity: 1 },
};

const FIELDS = {
  text: [
    ["text", "テキスト", "textarea"],
    ["font", "フォント", "font"],
    ["size", "サイズ", "number", { min: 4 }],
    ["color", "色", "color"],
    ["align", "揃え(X が基準点)", "select", { options: [["left", "左"], ["center", "中央"], ["right", "右"]] }],
    ["bold", "太字", "checkbox"],
    ["italic", "斜体", "checkbox"],
    ["lineHeight", "行間", "number", { min: 0.5, step: 0.1 }],
    ["spacing", "字間", "number"],
    ["width", "折り返し幅(0=しない)", "number", { min: 0 }],
    ["shadow", "影", "checkbox"],
    ["strokeColor", "縁取りの色", "color"],
    ["strokeWidth", "縁取りの太さ", "number", { min: 0 }],
  ],
  image: [
    ["fit", "収め方", "select", { options: [["cover", "枠いっぱい(はみ出しは切る)"], ["contain", "全体を収める"]] }],
    ["w", "枠の幅", "number", { min: 10 }],
    ["h", "枠の高さ", "number", { min: 10 }],
    ["zoom", "ズーム", "range", { min: 0.2, max: 4, step: 0.01 }],
    ["radius", "角丸", "number", { min: 0 }],
    ["posX", "位置(横)", "range", { min: -100, max: 100, step: 1 }],
    ["posY", "位置(縦)", "range", { min: -100, max: 100, step: 1 }],
    ["flip", "左右反転", "checkbox"],
  ],
  rect: [
    ["w", "幅", "number", { min: 4 }],
    ["h", "高さ", "number", { min: 4 }],
    ["color", "色", "color"],
    ["radius", "角丸", "number", { min: 0 }],
    ["borderColor", "枠線の色", "color"],
    ["borderWidth", "枠線の太さ", "number", { min: 0 }],
  ],
  symbol: [
    ["w", "幅", "number", { min: 4 }],
    ["h", "高さ", "number", { min: 4 }],
    ["color", "色", "color"],
  ],
  jobs: [
    ["display", "表示形式", "select", { options: [["icon", "アイコン+レベル"], ["iconName", "アイコン+名前+レベル"], ["name", "名前+レベル"]] }],
    ["filter", "表示するジョブ", "select", { options: [["battle", "戦闘職"], ["craft", "クラフター・ギャザラー"], ["all", "すべて"]] }],
    ["hideUnlearned", "未習得を隠す", "checkbox"],
    ["cols", "列数", "number", { min: 1 }],
    ["cellW", "列の幅", "number", { min: 20 }],
    ["font", "フォント", "font"],
    ["size", "サイズ", "number", { min: 4 }],
    ["iconColor", "アイコンの色", "color"],
    ["color", "ジョブ名の色", "color"],
    ["levelColor", "レベルの色", "color"],
    ["dimColor", "未習得の色", "color"],
    ["bold", "太字", "checkbox"],
    ["shadow", "影", "checkbox"],
  ],
};
const COMMON_FIELDS = [
  ["x", "X", "number"],
  ["y", "Y", "number"],
  ["opacity", "不透明度", "range", { min: 0, max: 1, step: 0.05 }],
];

// ---------- 状態 ----------

const $ = (id) => document.getElementById(id);
const canvas = $("card");
const mainCtx = canvas.getContext("2d");
// 描画関数はこの ctx / project に描く。サムネイルを描くときだけ一時的に差し替える
let ctx = mainCtx;

let project = load() ?? defaultProject();
let selectedId = null;
let exporting = false;
const boundsById = new Map();

function emptyData() {
  const data = Object.fromEntries(VARS.map(([k, label]) => [k, label]));
  Object.assign(data, { gender: "♂", birthday: "", guardian: "", hometown: "", grandCompany: "", grandCompanyRank: "", selfIntroduction: "" });
  data.levels = BATTLE_JOBS.map((name) => ({ name, level: "--" }));
  return data;
}

function makeLayer(type, props = {}) {
  return { id: uid(), type, hidden: false, x: 0, y: 0, ...structuredClone(DEFAULTS[type]), ...props };
}

function uid() {
  return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function defaultPalette() {
  return { ...FALLBACK_PALETTE, ...structuredClone(PALETTES[0]?.colors ?? {}) };
}

// templates/classic.json と同じ内容
function defaultProject() {
  return {
    card: { w: 1920, h: 1080, bg: { type: "gradient", color1: "@bg1", color2: "@bg2", angle: 135, image: "", dim: 0.3 } },
    palette: defaultPalette(),
    paletteId: PALETTES[0]?.id ?? "",
    frame: "round", // 枠の形
    data: emptyData(),
    layers: [
      // スクショがカード全体の土台。その上に文字やパネルを載せる
      makeLayer("image", { x: 0, y: 0, w: 1920, h: 1080 }),
      makeLayer("rect", { x: 1000, y: 60, w: 860, h: 960, opacity: 0.55, radius: 28, borderWidth: 2 }),
      makeLayer("text", { text: "{title}", x: 1060, y: 110, size: 36, color: "@accent" }),
      makeLayer("text", { text: "{name}", x: 1056, y: 160, size: 96, font: "Cinzel", bold: true }),
      makeLayer("text", { text: "{server} [{dataCenter}]", x: 1060, y: 290, size: 40, color: "@sub" }),
      makeLayer("text", { text: "{race} / {tribe} / {gender}\nFC: {freeCompany}", x: 1060, y: 355, size: 34, lineHeight: 1.5, color: "@sub" }),
      makeLayer("jobs", { x: 1060, y: 500, cols: 5 }),
      makeLayer("text", { text: "ここに好きなテキストを書けます\nクリックで選択して、右のパネルで編集", x: 1060, y: 820, size: 30, width: 760 }),
      makeLayer("text", { text: "(C) SQUARE ENIX", x: 1890, y: 1040, size: 20, align: "right", color: "@sub", opacity: 0.7 }),
    ],
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.card || !Array.isArray(saved.layers)) return null;
    return normalize(saved);
  } catch {
    return null;
  }
}

// 古い保存データや読み込んだテンプレートに足りない項目を補う
function normalize(p) {
  const base = defaultProject();
  return {
    card: { ...base.card, ...p.card, bg: { ...base.card.bg, ...p.card?.bg } },
    palette: { ...base.palette, ...p.palette },
    paletteId: p.palette ? p.paletteId ?? "" : base.paletteId,
    frame: FRAMES.some(([id]) => id === p.frame) || findCustomFrame(p.frame) ? p.frame : base.frame,
    data: (({ face, image, ...d }) => d)({ ...emptyData(), ...p.data }), // 以前保存した Lodestone の画像URLは捨てる
    layers: p.layers.filter((l) => DEFAULTS[l.type]).map(({ bind, ...l }) => ({ ...makeLayer(l.type), ...l })), // bind は以前の「Lodestone の画像を表示」設定(廃止)
  };
}

// 今すぐ保存する(別のページへ移る前など)
function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {}
}

let saveTimer;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      setStatus("自動保存できませんでした(画像が大きすぎる可能性があります)。PNG保存とテンプレート書き出しは使えます", "error");
    }
  }, 300);
}

function selected() {
  return project.layers.find((l) => l.id === selectedId) ?? null;
}

// ---------- 描画 ----------

let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    draw();
  });
  requestThumbnails();
}

function draw() {
  const { w, h } = project.card;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    Object.assign(view, { zoom: 1, panX: 0, panY: 0 });
    layoutStage();
  }
  boundsById.clear();
  drawScene(mainCtx, project, boundsById);
  if (!exporting) drawSelection();
}

// p のカードを target に描く(scale はサムネイル用の縮小率)
function drawScene(target, p, bounds, scale = 1) {
  const saved = [ctx, project];
  ctx = target;
  project = p;
  try {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, p.card.w, p.card.h);
    drawBackground();
    for (const l of p.layers) {
      if (l.hidden) continue;
      ctx.save();
      ctx.globalAlpha = l.opacity ?? 1;
      bounds.set(l.id, DRAW[l.type](l));
      ctx.restore();
    }
  } finally {
    [ctx, project] = saved;
  }
}

// "@accent" のような役割指定を、選んでいる配色の色にする
function col(v) {
  if (typeof v === "string" && v[0] === "@") return project.palette[v.slice(1)] ?? "#ff00ff";
  return v;
}

function isRole(v) {
  return typeof v === "string" && v[0] === "@";
}

function rgba(hex, alpha) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex) ?? [, "00", "00", "00"];
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

function drawBackground() {
  const { w, h, bg } = project.card;
  if (bg.type === "gradient") {
    const a = (bg.angle * Math.PI) / 180;
    const r = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    const g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    g.addColorStop(0, col(bg.color1));
    g.addColorStop(1, col(bg.color2));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = col(bg.color1);
  }
  ctx.fillRect(0, 0, w, h);

  const img = bg.image && getImage(bg.image);
  if (img) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    if (bg.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${bg.dim})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

const DRAW = {
  text(l) {
    ctx.font = fontString(l);
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${l.spacing || 0}px`;
    ctx.textBaseline = "top";
    ctx.textAlign = l.align;
    const text = resolveText(l.text);
    ensureFont(ctx.font, text);

    const lines = wrapLines(text, l.width);
    const lh = l.size * l.lineHeight;
    const bw = l.width || Math.max(1, ...lines.map((s) => ctx.measureText(s).width));
    const bx = l.align === "center" ? l.x - bw / 2 : l.align === "right" ? l.x - bw : l.x;

    lines.forEach((s, i) => {
      const y = l.y + i * lh;
      if (l.shadow) setShadow(l.size);
      if (l.strokeWidth > 0) {
        ctx.lineJoin = "round";
        ctx.lineWidth = l.strokeWidth * 2;
        ctx.strokeStyle = col(l.strokeColor);
        ctx.strokeText(s, l.x, y);
        clearShadow(); // 影は縁取りにだけ付ける
      }
      ctx.fillStyle = col(l.color);
      ctx.fillText(s, l.x, y);
      clearShadow();
    });
    return { x: bx, y: l.y, w: bw, h: Math.max(lh * (lines.length - 1) + l.size, l.size) };
  },

  // 枠(w×h)の中に画像を収める。posX/posY は -100(左・上端)〜100(右・下端)
  image(l) {
    const img = l.src && getImage(l.src);
    const b = { x: l.x, y: l.y, w: l.w, h: l.h, dw: l.w, dh: l.h, dx: l.x, dy: l.y };
    if (img) {
      drawPhoto(l, img, b);
      return b;
    }
    ctx.save();
    roundRectPath(l.x, l.y, l.w, l.h, l.radius);
    ctx.clip();
    if (!exporting) {
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(l.x + 2, l.y + 2, l.w - 4, l.h - 4);
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.font = `${Math.max(16, Math.min(l.w, l.h) / 18)}px "Noto Sans JP", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const msg = ["スクショをここにドロップ", "またはパネルからアップロード"];
      msg.forEach((s, i) => ctx.fillText(s, l.x + l.w / 2, l.y + l.h / 2 + (i - 0.5) * Math.max(24, Math.min(l.w, l.h) / 12)));
    }
    ctx.restore();
    return b;
  },

  // シンボル(シンボルエディタで作った形)。箱いっぱいに伸び縮みして、要素の色で塗る
  symbol(l) {
    const sym = findSymbol(l.symbol);
    if (sym) drawSymbol(ctx, sym, l.x, l.y, l.w, l.h, col(l.color));
    else if (!exporting) {
      // シンボルが消されているときは、場所だけ点線で示す(書き出しには出さない)
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(l.x, l.y, l.w, l.h);
    }
    return { x: l.x, y: l.y, w: l.w, h: l.h };
  },

  // 図形(パネル)。形は「枠の形」(project.frame)で決まる(描き方は frames.js)
  rect(l) {
    const frame = project.frame ?? "round";
    // 塗り・枠線(土台を自分で描いた枠は、その線の色・太さ)・飾り。切り抜きもここで(frames.js)
    drawFramePanel(ctx, frame, l, col, col(l.color));
    return { x: l.x, y: l.y, w: l.w, h: l.h };
  },

  jobs(l) {
    const list = jobList(l);
    ctx.font = fontString(l);
    ctx.textBaseline = "middle";
    ensureFont(ctx.font, list.map((j) => j.name + j.level).join(""));
    if (l.shadow) setShadow(l.size);

    const withIcon = l.display !== "name";
    const iconSize = l.size * 1.4;
    const lineH = withIcon ? iconSize : l.size;
    const rowH = lineH + l.size * (withIcon ? 0.5 : 0.6);
    const gap = l.size * 0.35;
    const nameX = withIcon ? iconSize + gap : 0;
    // 長いジョブ名はレベルと重ならないよう横に縮める
    const nameMax = Math.max(1, l.cellW - nameX - l.size * 1.1 - ctx.measureText("100").width);

    list.forEach((j, i) => {
      const x = l.x + (i % l.cols) * l.cellW;
      const cy = l.y + Math.floor(i / l.cols) * rowH + lineH / 2;
      const learned = /^\d+$/.test(j.level);
      const dim = learned ? null : col(l.dimColor);

      if (withIcon) {
        const icon = jobIcon(j.name, dim ?? col(l.iconColor));
        if (icon) {
          ctx.drawImage(icon, x, cy - iconSize / 2, iconSize, iconSize);
        } else {
          // アイコンが無いジョブ(クラフター・ギャザラー)は頭文字で代用
          ctx.textAlign = "center";
          ctx.fillStyle = dim ?? col(l.iconColor);
          ctx.fillText(j.name[0], x + iconSize / 2, cy);
        }
      }
      ctx.fillStyle = dim ?? col(l.levelColor);
      if (l.display === "icon") {
        ctx.textAlign = "left";
        ctx.fillText(j.level, x + nameX, cy);
        return;
      }
      ctx.textAlign = "right";
      ctx.fillText(j.level, x + l.cellW - l.size * 0.6, cy);
      ctx.textAlign = "left";
      ctx.fillStyle = dim ?? col(l.color);
      ctx.fillText(j.name, x + nameX, cy, nameMax);
    });
    const rows = Math.max(1, Math.ceil(list.length / l.cols));
    return { x: l.x, y: l.y, w: l.cols * l.cellW, h: (rows - 1) * rowH + lineH };
  },
};

function jobList(l) {
  return project.data.levels.filter((j) => {
    if (SPECIAL.has(j.name)) return false;
    if (l.hideUnlearned && !/^\d+$/.test(j.level)) return false;
    if (l.filter === "battle") return !CRAFT_GATHER.has(j.name);
    if (l.filter === "craft") return CRAFT_GATHER.has(j.name);
    return true;
  });
}

function fontString(l) {
  return `${l.italic ? "italic " : ""}${l.bold ? 700 : 400} ${l.size}px "${l.font}", sans-serif`;
}

function resolveText(text) {
  const d = project.data;
  return text
    .replace(/\{lv:([^}]+)\}/g, (_, name) => d.levels.find((j) => j.name === name)?.level ?? "-")
    .replace(/\{(\w+)\}/g, (m, k) => (typeof d[k] === "string" ? d[k] : m));
}

// 日本語向けに1文字単位で折り返す
function wrapLines(text, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    if (!maxW) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const ch of para) {
      if (line && ctx.measureText(line + ch).width > maxW) {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    out.push(line);
  }
  return out;
}

function setShadow(size) {
  // 影の大きさは拡大縮小の影響を受けないので、サムネイルでは縮小率を掛ける
  const s = ctx.getTransform().a;
  ctx.shadowColor = rgba(col("@shadow"), 0.65);
  ctx.shadowBlur = size * 0.2 * s;
  ctx.shadowOffsetY = size * 0.06 * s;
}

function clearShadow() {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function roundRectPath(x, y, w, h, r, g = ctx) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.max(0, Math.min(r || 0, w / 2, h / 2)));
}

// ---------- スクショのエフェクト(計算は effects.js) ----------

// 画像を枠に収めて描く。端をぼかすときは、いったん別の canvas に描いて端を透明にしてから重ねる
function drawPhoto(l, img, b) {
  const fit = l.fit === "contain" ? Math.min : Math.max;
  const s = fit(l.w / img.naturalWidth, l.h / img.naturalHeight) * l.zoom;
  b.dw = img.naturalWidth * s;
  b.dh = img.naturalHeight * s;
  b.dx = l.x + ((l.w - b.dw) / 2) * (1 + l.posX / 100);
  b.dy = l.y + ((l.h - b.dh) / 2) * (1 + l.posY / 100);
  const pic = effectImage(l, img);

  const fade = l.fxFade > 0;
  const scale = ctx.getTransform().a;
  const g = fade ? scratchContext(Math.ceil(l.w * scale), Math.ceil(l.h * scale)) : ctx;
  g.save();
  if (fade) g.setTransform(scale, 0, 0, scale, -l.x * scale, -l.y * scale); // 別 canvas にもカード座標で描く
  roundRectPath(l.x, l.y, l.w, l.h, l.radius, g);
  g.clip();
  g.save();
  if (l.flip) {
    g.translate(2 * l.x + l.w, 0);
    g.scale(-1, 1);
  }
  g.drawImage(pic, b.dx, b.dy, b.dw, b.dh);
  g.restore();

  if (l.fxVignette > 0) {
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    const r = Math.hypot(l.w, l.h) / 2;
    const v = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${Math.min(1, l.fxVignette * 0.9)})`);
    g.fillStyle = v;
    g.fillRect(l.x, l.y, l.w, l.h);
  }

  if (fade) {
    fadeEdges(g, l);
    g.restore();
    ctx.drawImage(g.canvas, 0, 0, Math.ceil(l.w * scale), Math.ceil(l.h * scale), l.x, l.y, Math.ceil(l.w * scale) / scale, Math.ceil(l.h * scale) / scale);
  } else {
    g.restore();
  }
}

// 端を透明にする。横と縦のグラデーションを destination-in で掛け合わせる
function fadeEdges(g, l) {
  const side = l.fxFadeSide;
  const mask = (horizontal, startFade, endFade) => {
    const len = horizontal ? l.w : l.h;
    const grad = horizontal ? g.createLinearGradient(l.x, 0, l.x + l.w, 0) : g.createLinearGradient(0, l.y, 0, l.y + l.h);
    const a = Math.min(0.5, startFade / len), z = Math.min(0.5, endFade / len);
    grad.addColorStop(0, a > 0 ? "rgba(0,0,0,0)" : "#000");
    grad.addColorStop(a, "#000");
    grad.addColorStop(1 - z, "#000");
    grad.addColorStop(1, z > 0 ? "rgba(0,0,0,0)" : "#000");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = grad;
    g.fillRect(l.x, l.y, l.w, l.h);
    g.globalCompositeOperation = "source-over";
  };
  const both = (l.fxFade * Math.min(l.w, l.h)) / 2;
  const oneW = l.fxFade * l.w * 0.6, oneH = l.fxFade * l.h * 0.6;
  if (side === "all" || side === "x") mask(true, both, both);
  if (side === "all" || side === "y") mask(false, both, both);
  if (side === "left") mask(true, oneW, 0);
  if (side === "right") mask(true, 0, oneW);
  if (side === "top") mask(false, oneH, 0);
  if (side === "bottom") mask(false, 0, oneH);
}

let scratch = null;
function scratchContext(w, h) {
  scratch ??= document.createElement("canvas").getContext("2d");
  if (scratch.canvas.width < w || scratch.canvas.height < h) {
    scratch.canvas.width = Math.max(w, scratch.canvas.width);
    scratch.canvas.height = Math.max(h, scratch.canvas.height);
  }
  scratch.setTransform(1, 0, 0, 1, 0, 0);
  scratch.clearRect(0, 0, w, h);
  return scratch;
}

// エフェクトをかけた画像は、元画像ごと・設定ごとに覚えておく。
// まず小さい版(480px)をすぐ作り、操作が止まってから本番の版(1600px)を作る
// スマホは計算が遅いので、操作中の小さい版をさらに小さくする
const FX_LOW = matchMedia("(pointer: coarse)").matches ? 360 : 480, FX_FULL = 1600;
const fxCache = new WeakMap(); // 元の img → Map(設定 → { low, full, fx })
const fxPending = new Map(); // 本番の版を作る予定のもの
let fxTimer;

function resolvedFx(l) {
  const fx = {};
  for (const k of FX_KEYS) fx[k] = l[k] ?? FX_DEFAULTS[k];
  fx.fxDuoDark = col(fx.fxDuoDark);
  fx.fxDuoLight = col(fx.fxDuoLight);
  fx.fxTint = col(fx.fxTint);
  return fx;
}

function effectImage(l, img) {
  if (!hasPixelFx(l)) return img;
  const fx = resolvedFx(l);
  const key = JSON.stringify(fx);
  let per = fxCache.get(img);
  if (!per) fxCache.set(img, (per = new Map()));
  let e = per.get(key);
  if (!e) {
    e = { low: processPixels(img, fx, FX_LOW), full: null, fx, img };
    per.set(key, e);
    if (per.size > 8) per.delete(per.keys().next().value); // 古いものから捨てる
  }
  // サムネイルは小さい版で十分。カード本体のときだけ本番の版を作る
  if (!e.full && ctx === mainCtx) {
    fxPending.set(key, e);
    clearTimeout(fxTimer);
    fxTimer = setTimeout(() => {
      flushFx();
      requestDraw();
    }, 250);
  }
  return e.full ?? e.low;
}

function flushFx() {
  clearTimeout(fxTimer);
  for (const e of fxPending.values()) e.full ??= processPixels(e.img, e.fx, FX_FULL);
  fxPending.clear();
}

// カード上の点から、元画像のその位置の色相を取る(パートカラーの色選び用)
function sampleHue(l, p) {
  const b = boundsById.get(l.id);
  const img = l.src && getImage(l.src);
  if (!b || !img || !inside(p, b)) return null;
  const x = l.flip ? 2 * l.x + l.w - p.x : p.x;
  const u = (x - b.dx) / b.dw, v = (p.y - b.dy) / b.dh;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d", { willReadFrequently: true });
  const r = Math.max(2, img.naturalWidth / 200); // まわりの数ピクセルの平均を取る
  g.drawImage(img, u * img.naturalWidth - r, v * img.naturalHeight - r, r * 2, r * 2, 0, 0, 1, 1);
  const [cr, cg, cb] = g.getImageData(0, 0, 1, 1).data;
  const [hue, sat] = hueSat(cr, cg, cb);
  return { hue: Math.round(hue), sat };
}

// Google Fonts は使う文字ごとに読み込まれるので、描く文字列を渡して読み込み後に再描画する
const fontRequests = new Set();
function ensureFont(font, text) {
  const key = font + "\n" + text;
  if (fontRequests.has(key)) return;
  fontRequests.add(key);
  document.fonts.load(font, text || "あA").then(requestDraw, () => {});
}

const images = new Map();
function getImage(src) {
  let entry = images.get(src);
  if (!entry) {
    const img = new Image();
    entry = { img, ok: false };
    entry.ready = new Promise((resolve) => {
      img.onload = () => {
        entry.ok = true;
        requestDraw();
        resolve();
      };
      img.onerror = resolve;
    });
    img.src = src;
    images.set(src, entry);
  }
  return entry.ok ? entry.img : null;
}

// job-icons.js の単色 SVG を指定色の画像にする(色ごとに getImage でキャッシュされる)
function jobIcon(name, color) {
  const svg = JOB_ICONS[CLASS_TO_JOB[name] ?? name];
  if (!svg) return null;
  const colored = svg.replace("<svg ", `<svg width="128" height="128" color="${color}" `);
  return getImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(colored));
}

function viewScale() {
  return canvas.getBoundingClientRect().width / canvas.width || 1;
}

function drawSelection() {
  const b = boundsById.get(selectedId);
  if (!b) return;
  const s = viewScale();
  // 選択枠はピンクの点線。4つの角と4つの辺の真ん中に、白ふちのまるいつまみ(どの辺・角をドラッグしても大きさが変わる)
  ctx.save();
  ctx.strokeStyle = "#ff6fa5";
  ctx.lineWidth = 2.5 / s;
  ctx.setLineDash([7 / s, 5 / s]);
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  const hs = HANDLE / s;
  ctx.setLineDash([]);
  const knob = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ff8fb7";
    ctx.fill();
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  };
  const xs = [b.x, b.x + b.w / 2, b.x + b.w], ys = [b.y, b.y + b.h / 2, b.y + b.h];
  for (const [i, x] of xs.entries()) {
    for (const [j, y] of ys.entries()) {
      if (i === 1 && j === 1) continue;
      knob(x, y, i === 1 || j === 1 ? hs * 0.4 : hs * 0.55);
    }
  }
  ctx.restore();
}

// ---------- キャンバス操作 ----------

let drag = null;

function toCard(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
}

function inside(p, b) {
  return b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

// 辺・角をつかめる幅(画面上の px)。指で操作する端末は広めにする
const EDGE_GRAB = matchMedia("(pointer: coarse)").matches ? 16 : 8;
const EDGE_CURSOR = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };

// 点 p が枠 b のどの辺・角の上か("n" "se" など。どこでもなければ null)
function edgeAt(p, b) {
  if (!b) return null;
  const t = EDGE_GRAB / viewScale();
  if (p.x < b.x - t || p.x > b.x + b.w + t || p.y < b.y - t || p.y > b.y + b.h + t) return null;
  const near = (a, v) => Math.abs(a - v) <= t;
  // 小さい要素で上下(左右)の辺が近いときは、近いほうを取る
  const ns = near(p.y, b.y) && (!near(p.y, b.y + b.h) || p.y - b.y < b.y + b.h - p.y) ? "n" : near(p.y, b.y + b.h) ? "s" : "";
  const ew = near(p.x, b.x) && (!near(p.x, b.x + b.w) || p.x - b.x < b.x + b.w - p.x) ? "w" : near(p.x, b.x + b.w) ? "e" : "";
  return ns + ew || null;
}

// つかめる辺:まず選んでいる要素。無ければ、その場所でいちばん前にある要素(土台のスクショは除く。カードの端と重なるため)
function edgeTarget(p) {
  const sel = selected();
  const se = sel && !sel.hidden && edgeAt(p, boundsById.get(sel.id));
  if (se) return { layer: sel, edge: se };
  for (const l of [...project.layers].reverse()) {
    if (l.hidden) continue;
    const b = boundsById.get(l.id);
    const e = !coversCard(l) && edgeAt(p, b);
    if (e) return { layer: l, edge: e };
    if (inside(p, b)) break; // 前にある要素の中を押しているなら、その後ろの要素の辺はつかまない
  }
  return null;
}

// カード全体を覆う画像枠か(土台のスクショ)
function coversCard(l, w = project.card.w, h = project.card.h) {
  return l.type === "image" && l.x <= 0 && l.y <= 0 && l.x + l.w >= w && l.y + l.h >= h;
}

// カードの大きさを変えたとき、土台のスクショの枠も新しい大きさに合わせる
let cardDims = null;
function fitBaseImages() {
  const { w, h } = project.card;
  if (cardDims && (cardDims.w !== w || cardDims.h !== h)) {
    for (const l of project.layers) {
      if (coversCard(l, cardDims.w, cardDims.h)) Object.assign(l, { x: 0, y: 0, w, h });
    }
  }
  cardDims = { w, h };
}

function hitTest(p) {
  return [...project.layers].reverse().find((l) => !l.hidden && inside(p, boundsById.get(l.id))) ?? null;
}

// スペースキーを押している間は「表示を動かす」モード(入力欄で文字を打っているときは除く)
let spaceHeld = false;
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.target.closest?.("input, textarea, select, button")) return;
  e.preventDefault(); // ページのスクロールを止める
  if (!spaceHeld) {
    spaceHeld = true;
    $("artboard").classList.add("space-pan");
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;
  spaceHeld = false;
  $("artboard").classList.remove("space-pan");
});

canvas.addEventListener("pointerdown", (e) => {
  const p = toCard(e);
  if (spaceHeld || e.button === 1) {
    e.preventDefault(); // ホイールボタンの自動スクロールを出さない
    startViewDrag(e);
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (pickHueFor) {
    pickHue(p); // 色を拾うモードの間は、選択や移動をしない
    return;
  }
  const grab = edgeTarget(p);
  if (grab) {
    select(grab.layer.id);
    openTab("layers");
    drag = { mode: "resize", edge: grab.edge, start: p, layer: grab.layer, orig: { ...grab.layer }, b: { ...boundsById.get(grab.layer.id) } };
  } else {
    const hit = hitTest(p);
    select(hit?.id ?? null);
    if (hit) openTab("layers");
    // Alt+ドラッグで画像を枠の中で動かす
    const mode = hit?.type === "image" && e.altKey ? "pan" : "move";
    if (hit) drag = { mode, start: p, layer: hit, orig: { ...hit }, b: { ...boundsById.get(hit.id) } };
    else startViewDrag(e);
  }
  if (drag || viewDrag) canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const p = toCard(e);
  if (!drag) {
    const grab = !viewDrag && edgeTarget(p);
    canvas.style.cursor = viewDrag ? "grabbing" : grab ? EDGE_CURSOR[grab.edge] : hitTest(p) ? "move" : "grab";
    return;
  }
  const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (drag.mode === "move") {
    drag.layer.x = Math.round(drag.orig.x + dx);
    drag.layer.y = Math.round(drag.orig.y + dy);
  } else if (drag.mode === "pan") {
    pan(drag, dx, dy);
  } else {
    resize(drag, dx, dy, e.shiftKey);
  }
  requestDraw();
});

const endDrag = () => {
  if (!drag) return;
  drag = null;
  renderProps();
  renderLayers();
  saveSoon();
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

// 辺・角のドラッグで大きさを変える。つかんだ辺の反対側は動かさない
//   図形・画像:枠の幅・高さ(角を Shift+ドラッグで縦横比を保つ)
//   テキスト・ジョブ一覧:文字の大きさを比率で変える
function resize({ layer: l, orig: o, b, edge }, dx, dy, keepRatio) {
  const W = edge.includes("e") ? b.w + dx : edge.includes("w") ? b.w - dx : b.w;
  const H = edge.includes("s") ? b.h + dy : edge.includes("n") ? b.h - dy : b.h;
  if (l.type === "rect" || l.type === "image" || l.type === "symbol") {
    let w = Math.max(10, o.w + (W - b.w)), h = Math.max(10, o.h + (H - b.h));
    if (keepRatio && edge.length === 2) {
      const f = Math.max(w / o.w, h / o.h);
      w = Math.max(10, o.w * f);
      h = Math.max(10, o.h * f);
    }
    l.w = Math.round(w);
    l.h = Math.round(h);
    l.x = edge.includes("w") ? Math.round(o.x + o.w - l.w) : o.x;
    l.y = edge.includes("n") ? Math.round(o.y + o.h - l.h) : o.y;
    return;
  }
  // 左右の辺(と角)は幅の比率、上下の辺は高さの比率
  const f = Math.max(0.05, /[ew]/.test(edge) ? W / b.w : H / b.h);
  l.size = Math.max(4, Math.round(o.size * f));
  if (l.type === "text" && o.width) l.width = Math.round(o.width * f);
  if (l.type === "jobs") l.cellW = Math.max(20, Math.round(o.cellW * f));
  const k = l.size / o.size; // 丸めたあとの実際の比率
  const bw = b.w * k, bh = b.h * k;
  const bx = edge.includes("w") ? b.x + b.w - bw : b.x;
  const by = edge.includes("n") ? b.y + b.h - bh : b.y;
  if (l.type === "text") l.x = Math.round(l.align === "center" ? bx + bw / 2 : l.align === "right" ? bx + bw : bx);
  else l.x = Math.round(bx);
  l.y = Math.round(by);
}

// 描画位置は (枠 - 画像) / 2 × (1 + pos/100) なので、マウス移動量を pos の変化量に換算する
function pan({ layer: l, orig: o, b }, dx, dy) {
  const clamp = (v) => Math.max(-100, Math.min(100, Math.round(v)));
  const sx = l.flip ? -1 : 1;
  if (Math.abs(b.w - b.dw) > 1) l.posX = clamp(o.posX + (sx * dx * 200) / (b.w - b.dw));
  if (Math.abs(b.h - b.dh) > 1) l.posY = clamp(o.posY + (dy * 200) / (b.h - b.dh));
}

// 選択中の画像の上でホイール → ズーム
canvas.addEventListener("wheel", (e) => {
  const l = selected();
  if (l?.type !== "image" || !inside(toCard(e), boundsById.get(l.id))) return;
  e.preventDefault();
  l.zoom = Math.max(0.2, Math.min(4, Math.round(l.zoom * (e.deltaY < 0 ? 1.05 : 1 / 1.05) * 100) / 100));
  requestDraw();
  renderProps();
  saveSoon();
}, { passive: false });

// 画像ファイルのドロップ: 画像枠の上ならその枠に、それ以外は新しい画像として追加
canvas.addEventListener("dragover", (e) => e.preventDefault());
canvas.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
  if (!file) return;
  const p = toCard(e);
  const hit = hitTest(p);
  const src = await readImage(file);
  if (hit?.type === "image") {
    setImage(hit, src);
  } else {
    const { width, height } = await imageSize(src);
    const w = Math.min(800, project.card.w / 2);
    const l = makeLayer("image", { src, w, h: Math.round((w * height) / width), x: Math.round(p.x - w / 2), y: Math.round(p.y - (w * height) / width / 2) });
    project.layers.push(l);
    changed();
    select(l.id);
  }
});

function setImage(l, src) {
  Object.assign(l, { src, zoom: 1, posX: 0, posY: 0 });
  changed();
  if (l.id === selectedId) renderProps();
  else select(l.id);
}

function imageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 16, height: 9 });
    img.src = src;
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pickHueFor) {
    pickHueFor = null;
    canvas.classList.remove("picking");
    renderProps();
    return;
  }
  if (e.target.closest?.("input, textarea, select")) return;
  const l = selected();
  if (!l) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    removeLayer(l.id);
    return;
  }
  const step = e.shiftKey ? 10 : 1;
  const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!move) return;
  e.preventDefault();
  l.x += move[0];
  l.y += move[1];
  requestDraw();
  renderProps();
  saveSoon();
});

// ---------- 要素の操作 ----------

function select(id) {
  if (selectedId === id) return;
  if (pickHueFor && pickHueFor !== id) {
    pickHueFor = null;
    canvas.classList.remove("picking");
  }
  selectedId = id;
  renderLayers();
  renderProps();
  requestDraw();
}

function addLayer(type, symbolId) {
  const { w, h } = project.card;
  // シンボルは、作ったときの縦横比のまま置く(長い辺 240)
  const sym = type === "symbol" ? findSymbol(symbolId) : null;
  const sw = sym ? Math.round(240 * Math.min(1, (sym.w || 100) / (sym.h || 100))) : 240;
  const sh = sym ? Math.round(240 * Math.min(1, (sym.h || 100) / (sym.w || 100))) : 240;
  const props = {
    text: { x: Math.round(w / 2 - 150), y: Math.round(h / 2 - 30), text: "テキスト" },
    image: { x: Math.round(w / 2 - 200), y: Math.round(h / 2 - 270) },
    rect: { x: Math.round(w / 2 - 200), y: Math.round(h / 2 - 120) },
    jobs: { x: Math.round(w / 2 - 470), y: Math.round(h / 2 - 120) },
    symbol: { x: Math.round(w / 2 - sw / 2), y: Math.round(h / 2 - sh / 2), w: sw, h: sh, symbol: symbolId },
  }[type];
  const l = makeLayer(type, props);
  project.layers.push(l);
  changed();
  select(l.id);
}

function removeLayer(id) {
  project.layers = project.layers.filter((l) => l.id !== id);
  if (selectedId === id) selectedId = null;
  changed();
  renderProps();
}

function duplicateLayer(id) {
  const i = project.layers.findIndex((l) => l.id === id);
  const copy = { ...structuredClone(project.layers[i]), id: uid(), x: project.layers[i].x + 30, y: project.layers[i].y + 30 };
  project.layers.splice(i + 1, 0, copy);
  changed();
  select(copy.id);
}

function moveLayer(id, dir) {
  const i = project.layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (j < 0 || j >= project.layers.length) return;
  [project.layers[i], project.layers[j]] = [project.layers[j], project.layers[i]];
  changed();
}

function changed() {
  requestDraw();
  renderLayers();
  saveSoon();
}

// ---------- パネル ----------

function field(obj, key, label, type, opt = {}, onChange = changed) {
  if (type === "color" && !opt.plain) return colorField(obj, key, label, onChange);
  const wrap = document.createElement("label");
  wrap.className = `field field--${type}${opt.wide ? " field--wide" : ""}`;
  const span = document.createElement("span");
  span.textContent = label;

  let input;
  if (type === "textarea") {
    input = document.createElement("textarea");
    input.rows = opt.rows ?? 3;
  } else if (type === "select" || type === "font") {
    input = document.createElement("select");
    for (const [value, text] of type === "font" ? FONTS : opt.options) {
      const o = new Option(text, value);
      if (type === "font") o.style.fontFamily = `"${value}"`;
      input.add(o);
    }
  } else {
    input = document.createElement("input");
    input.type = type;
    if (opt.min != null) input.min = opt.min;
    if (opt.max != null) input.max = opt.max;
    if (opt.step != null) input.step = opt.step;
    if (opt.cls) input.classList.add(opt.cls);
  }
  if (type === "checkbox") input.checked = !!obj[key];
  else input.value = obj[key] ?? "";

  const instant = type === "checkbox" || type === "select" || type === "font";
  input.addEventListener(instant ? "change" : "input", () => {
    if (type === "checkbox") obj[key] = input.checked;
    else if (type === "number" || type === "range") {
      if (input.value === "") return;
      obj[key] = Number(input.value);
    } else obj[key] = input.value;
    onChange(key);
  });

  wrap.append(span, input);
  return wrap;
}

// 色: 「配色の色」を選ぶと配色を変えたときに一緒に変わる。「自由に選ぶ」ならその色に固定
function colorField(obj, key, label, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "field field--color";
  const span = document.createElement("span");
  span.textContent = label;

  const sel = document.createElement("select");
  const group = document.createElement("optgroup");
  group.label = "配色の色";
  for (const [k, text] of ROLES) group.append(new Option(text, k));
  sel.append(new Option("自由に選ぶ", ""), group);
  const input = document.createElement("input");
  input.type = "color";

  const sync = () => {
    sel.value = isRole(obj[key]) ? obj[key].slice(1) : "";
    input.value = col(obj[key]);
  };
  sel.addEventListener("change", () => {
    obj[key] = sel.value ? "@" + sel.value : input.value;
    sync();
    onChange(key);
  });
  input.addEventListener("input", () => {
    obj[key] = input.value;
    sel.value = "";
    onChange(key);
  });
  sync();

  const row = document.createElement("div");
  row.className = "color-row";
  row.append(sel, input);
  wrap.append(span, row);
  return wrap;
}

function button(text, onClick, cls = "btn btn--small") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function uploadButton(text, onLoad) {
  const label = document.createElement("label");
  label.className = "btn btn--small";
  label.textContent = text;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (file) onLoad(await readImage(file));
  });
  label.append(input);
  return label;
}

// 大きすぎる画像は縮小して保存容量を抑える
function readImage(file, max = 2400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(file.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.9) : c.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function layerLabel(l) {
  if (l.type === "text") return resolveText(l.text).replace(/\n/g, " ").slice(0, 30) || "(空)";
  if (l.type === "image") return l.src ? "スクショ" : "(未設定)";
  if (l.type === "rect") return `${l.w}×${l.h}`;
  if (l.type === "symbol") return findSymbol(l.symbol)?.name || "(消されたシンボル)";
  return { battle: "戦闘職", craft: "クラフター・ギャザラー", all: "すべて" }[l.filter];
}

function renderLayers() {
  const ul = $("layers");
  ul.replaceChildren();
  // 上にあるほど前面
  for (const l of [...project.layers].reverse()) {
    const li = document.createElement("li");
    li.className = (l.id === selectedId ? "selected " : "") + (l.hidden ? "hidden" : "");
    const type = document.createElement("span");
    type.className = "layer-type";
    type.textContent = TYPE_LABEL[l.type];
    const label = document.createElement("span");
    label.className = "layer-label";
    label.textContent = layerLabel(l);
    const eye = document.createElement("button");
    eye.className = "layer-eye";
    eye.title = l.hidden ? "表示する" : "隠す";
    eye.textContent = l.hidden ? "表示" : "隠す";
    eye.addEventListener("click", (e) => {
      e.stopPropagation();
      l.hidden = !l.hidden;
      changed();
    });
    li.append(type, label, eye);
    li.addEventListener("pointerdown", (e) => startLayerDrag(e, li, ul, l));
    li.addEventListener("contextmenu", (e) => e.preventDefault()); // 長押しでメニューを出さない
    li.addEventListener("click", () => {
      if (layerDragged) return; // ドラッグで並べ替えた直後のクリックでは選ばない
      select(l.id);
    });
    ul.append(li);
  }
}

// レイヤーをドラッグで並べ替える(枠エディタのレイヤーと同じ決まり)
//   離した所が行の上なら、その行のすぐ下に差し込む(行と行のあいだも同じ)。いちばん上の行より上なら、いちばん上に
//   マウスは、そのままドラッグ。スマホ(指)は、長押しで「並べ替えモード」になってからドラッグ
//   (指でなぞるだけなら、ふつうに一覧がスクロールする)
let layerDragged = false;
const LONG_PRESS = 400; // 長押しと見なす時間(ミリ秒)
function startLayerDrag(e, li, ul, layer) {
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
      // 見た目は配列の逆順(上ほど前面)。抜いたあとの配列で、見た目の target 番目 = 配列の (長さ - target) 番目
      const rest = project.layers.filter((x) => x !== layer);
      rest.splice(rest.length - target, 0, layer);
      project.layers = rest;
      changed();
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

function renderProps() {
  const box = $("props");
  box.replaceChildren();
  const l = selected();
  if (!l) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = "カード上の要素をクリックすると、ここで編集できます。";
    box.append(p);
    return;
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    button("前面へ", () => moveLayer(l.id, 1)),
    button("背面へ", () => moveLayer(l.id, -1)),
    button("複製", () => duplicateLayer(l.id)),
    button("削除", () => removeLayer(l.id), "btn btn--small btn--danger"),
  );
  box.append(actions);

  for (const [key, label, type, opt] of FIELDS[l.type]) {
    // 表示形式を変えたら列の幅もそれに合う幅にする
    const onChange = key === "display" ? () => {
      l.cellW = Math.round(l.size * { icon: 5.5, iconName: 10, name: 9 }[l.display]);
      changed();
      renderProps();
    } : changed;
    const f = field(l, key, label, type, opt, onChange);
    box.append(f);
    if (key === "text") box.append(varChips(f.querySelector("textarea"), l));
  }
  if (l.type === "image") {
    const row = document.createElement("div");
    row.className = "actions";
    row.append(uploadButton("スクショをアップロード", (src) => setImage(l, src)));
    box.append(row);
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "画像の上でホイール → ズーム / Alt+ドラッグ → 枠の中で位置調整";
    box.append(note);
    renderFxFields(box, l);
  }
  if (l.type === "symbol") {
    const sym = findSymbol(l.symbol);
    const row = document.createElement("div");
    row.className = "actions";
    if (sym) {
      row.append(
        button("このシンボルを編集", () => openSymbolEditor(sym.id)),
        button("このシンボルを削除", () => deleteSymbol(sym), "btn btn--small btn--danger"),
      );
    } else {
      row.append(Object.assign(document.createElement("p"), { className: "note", textContent: "このシンボルは消されています。" }));
    }
    box.append(row);
  }
  for (const [key, label, type, opt] of COMMON_FIELDS) box.append(field(l, key, label, type, opt));
}

const TONES = [["none", "そのまま"], ["gray", "モノクロ"], ["sepia", "セピア"], ["duotone", "デュオトーン"], ["part", "パートカラー"]];
const TINT_MODES = [["multiply", "乗算(暗く色づく)"], ["screen", "スクリーン(明るく色づく)"], ["overlay", "オーバーレイ"], ["normal", "そのまま重ねる"]];
const FADE_SIDES = [["all", "まわり全部"], ["x", "左右"], ["y", "上下"], ["left", "左だけ"], ["right", "右だけ"], ["top", "上だけ"], ["bottom", "下だけ"]];

let pickHueFor = null; // パートカラーの色をカードから拾うモードのときの要素ID

// 画像の「エフェクト」欄
function renderFxFields(box, l) {
  const head = document.createElement("h3");
  head.className = "sub fields-head";
  head.textContent = "エフェクト";
  box.append(head);

  // プリセット。中身を手で変えたら「カスタム」になる
  const presetOptions = FX_PRESETS.map(([id, name]) => [id, name]);
  if (l.fxPreset === "custom") presetOptions.push(["custom", "カスタム"]);
  const presetField = field(l, "fxPreset", "おまかせ", "select", { options: presetOptions, wide: true }, () => {
    const preset = FX_PRESETS.find(([id]) => id === l.fxPreset);
    if (!preset) return;
    for (const k of FX_KEYS) l[k] = FX_DEFAULTS[k];
    Object.assign(l, preset[2]);
    changed();
    renderProps();
  });
  box.append(presetField);
  const presetSelect = presetField.querySelector("select");

  // スライダーを動かしている最中に欄を作り直すとドラッグが切れるので、作り直すのは rerender のときだけ
  const custom = (rerender = false) => () => {
    if (l.fxPreset !== "custom") {
      l.fxPreset = "custom";
      if (![...presetSelect.options].some((o) => o.value === "custom")) presetSelect.add(new Option("カスタム", "custom"));
      presetSelect.value = "custom";
    }
    changed();
    if (rerender) renderProps();
  };
  const add = (key, label, type, opt, rerender) => box.append(field(l, key, label, type, opt, custom(rerender)));

  add("fxBrightness", "明るさ", "range", { min: -100, max: 100, step: 1 });
  add("fxContrast", "コントラスト", "range", { min: -100, max: 100, step: 1 });
  add("fxSaturation", "彩度", "range", { min: -100, max: 100, step: 1 });
  add("fxTone", "色味", "select", { options: TONES }, true);

  if (l.fxTone === "duotone") {
    add("fxDuoDark", "暗い部分の色", "color");
    add("fxDuoLight", "明るい部分の色", "color");
  }
  if (l.fxTone === "part") {
    const swatch = document.createElement("div");
    swatch.className = "hue-row";
    const chip = document.createElement("span");
    chip.className = "hue-chip";
    chip.style.background = `hsl(${l.fxPartHue} 85% 55%)`;
    const pick = button(pickHueFor === l.id ? "カード上のスクショを押してください…" : "スクショから色を拾う", () => {
      pickHueFor = pickHueFor === l.id ? null : l.id;
      canvas.classList.toggle("picking", !!pickHueFor);
      renderProps();
    }, "btn btn--small" + (pickHueFor === l.id ? " btn--primary" : ""));
    swatch.append(chip, document.createTextNode("残す色"), pick);
    box.append(swatch);
    box.append(field(l, "fxPartHue", "残す色(色相)", "range", { min: 0, max: 360, step: 1, wide: true, cls: "hue-range" }, () => {
      chip.style.background = `hsl(${l.fxPartHue} 85% 55%)`;
      custom()();
    }));
    add("fxPartRange", "残す色の幅", "range", { min: 5, max: 90, step: 1 });
  }

  add("fxTint", "かぶせる色", "color");
  add("fxTintAmount", "かぶせる強さ", "range", { min: 0, max: 1, step: 0.01 });
  add("fxTintMode", "かぶせ方", "select", { options: TINT_MODES, wide: true });
  add("fxVignette", "周辺を暗く", "range", { min: 0, max: 1, step: 0.01 });
  add("fxFade", "端をぼかす", "range", { min: 0, max: 1, step: 0.01 });
  add("fxFadeSide", "ぼかす場所", "select", { options: FADE_SIDES });
}

function pickHue(p) {
  const l = project.layers.find((x) => x.id === pickHueFor);
  const res = l && sampleHue(l, p);
  if (!res) return false;
  if (res.sat < 0.15) {
    alert("色がうすい所でした。もう少し色のはっきりした所を押してください");
    return true;
  }
  l.fxPartHue = res.hue;
  if (l.fxPreset !== "part") l.fxPreset = "custom";
  pickHueFor = null;
  canvas.classList.remove("picking");
  changed();
  renderProps();
  return true;
}

function varChips(textarea, layer) {
  const wrap = document.createElement("div");
  wrap.className = "chips";
  for (const [key, label] of VARS) {
    const chip = button(label, () => {
      const { selectionStart: s, selectionEnd: e, value } = textarea;
      textarea.value = value.slice(0, s) + `{${key}}` + value.slice(e);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = s + key.length + 2;
      layer.text = textarea.value;
      changed();
    }, "chip");
    chip.title = `{${key}} を挿入`;
    wrap.append(chip);
  }
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "ボタンで差し込み項目を挿入できます。{lv:ナイト} のように書くとそのジョブのレベルになります。";
  wrap.append(note);
  return wrap;
}

function renderData() {
  const box = $("dataForm");
  box.replaceChildren();
  for (const [key, label] of VARS) {
    const type = key === "selfIntroduction" ? "textarea" : "text";
    box.append(field(project.data, key, label, type, {}, changed));
  }
}

function renderCard() {
  const box = $("cardForm");
  box.replaceChildren();
  const card = project.card;
  cardDims = { w: card.w, h: card.h }; // 大きさを変えたときに土台のスクショを合わせるための元の大きさ

  const size = document.createElement("select");
  for (const [w, h, label] of SIZES) size.add(new Option(label, `${w}x${h}`));
  size.add(new Option("カスタム", "custom"));
  size.value = SIZES.some(([w, h]) => w === card.w && h === card.h) ? `${card.w}x${card.h}` : "custom";
  size.addEventListener("change", () => {
    if (size.value === "custom") return;
    [card.w, card.h] = size.value.split("x").map(Number);
    fitBaseImages();
    changed();
    renderCard();
  });
  const sizeField = document.createElement("label");
  sizeField.className = "field field--wide";
  sizeField.append(Object.assign(document.createElement("span"), { textContent: "サイズ" }), size);

  const onSize = () => {
    card.w = Math.max(100, Math.min(4000, card.w));
    card.h = Math.max(100, Math.min(4000, card.h));
    fitBaseImages();
    changed();
  };
  box.append(
    sizeField,
    field(card, "w", "幅", "number", { min: 100, max: 4000 }, onSize),
    field(card, "h", "高さ", "number", { min: 100, max: 4000 }, onSize),
    field(card.bg, "type", "背景", "select", { options: [["gradient", "グラデーション"], ["solid", "単色"]] }),
    field(card.bg, "angle", "グラデーションの角度", "number"),
    field(card.bg, "color1", "色1", "color"),
    field(card.bg, "color2", "色2", "color"),
  );

  const row = document.createElement("div");
  row.className = "actions";
  row.append(uploadButton("背景画像をアップロード", (src) => {
    card.bg.image = src;
    changed();
    renderCard();
  }));
  if (card.bg.image) {
    row.append(button("背景画像を外す", () => {
      card.bg.image = "";
      changed();
      renderCard();
    }));
  }
  box.append(row, field(card.bg, "dim", "背景画像を暗く", "range", { min: 0, max: 1, step: 0.05, wide: true }));
}

function renderAll() {
  renderData();
  renderLayers();
  renderProps();
  renderCard();
  renderSwatches();
  renderFrames();
  renderAddTiles();
  renderPaletteForm();
  requestDraw();
}

// ---------- デザイン(テンプレート・配色) ----------

const THUMB_W = 330, THUMB_H = 240; // サムネイルの最大サイズ(実ピクセル)
const templates = []; // { name, file, data, canvas }
let designFilter = "all";
let beforeApply = null; // 「元に戻す」用

function orientation(card) {
  return card.w > card.h ? "landscape" : card.w < card.h ? "portrait" : "square";
}

async function loadTemplates() {
  const loaded = await Promise.all(TEMPLATE_LIST.map(async (t) => {
    try {
      const res = await fetch(`templates/${t.file}`);
      if (!res.ok) return null;
      const data = await res.json();
      return { ...t, name: t.name ?? data.name ?? t.file, data };
    } catch {
      return null;
    }
  }));
  templates.push(...loaded.filter(Boolean));
  if (TEMPLATE_LIST.length && !templates.length) {
    setDesignNote("デザインを読み込めませんでした(file:// ではなく http://localhost:8000 で開いてください)");
  }
  renderGallery();
}

// テンプレートに、今のキャラ情報・配色・スクショ・背景画像を入れたものを作る
function fromTemplate(t) {
  const p = normalize({ ...structuredClone(t.data), data: project.data, palette: project.palette, paletteId: project.paletteId, frame: project.frame });
  p.layers.forEach((l) => (l.id = uid()));
  const shot = project.layers.find((l) => l.type === "image" && l.src);
  const target = p.layers.find((l) => l.type === "image");
  if (shot && target && !target.src) {
    Object.assign(target, { src: shot.src, flip: shot.flip });
    // デザイン側の画像にエフェクトが付いていなければ、今のエフェクトを引き継ぐ
    if (FX_KEYS.every((k) => target[k] === FX_DEFAULTS[k])) {
      for (const k of [...FX_KEYS, "fxPreset"]) target[k] = shot[k];
    }
  }
  if (!p.card.bg.image && project.card.bg.image) Object.assign(p.card.bg, { image: project.card.bg.image, dim: project.card.bg.dim });
  return p;
}

function applyTemplate(t) {
  beforeApply = structuredClone(project);
  project = fromTemplate(t);
  selectedId = null;
  renderAll();
  saveSoon();
  setDesignNote(`「${t.name}」にしました`, true);
}

function setDesignNote(text, undo = false) {
  const el = $("designNote");
  el.replaceChildren(text);
  if (!undo) return;
  el.append(" ", button("元に戻す", () => {
    project = beforeApply;
    beforeApply = null;
    selectedId = null;
    renderAll();
    saveSoon();
    setDesignNote("");
  }));
}

function renderGallery() {
  const box = $("gallery");
  box.replaceChildren();
  const list = templates.filter((t) => designFilter === "all" || orientation(t.data.card) === designFilter);
  for (const t of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "design";
    b.title = `${t.name}(${t.data.card.w}×${t.data.card.h})`;
    t.canvas = document.createElement("canvas");
    const name = document.createElement("span");
    name.textContent = t.name;
    b.append(t.canvas, name);
    b.addEventListener("click", () => applyTemplate(t));
    box.append(b);
  }
  if (templates.length && !list.length) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = "このサイズのデザインはまだありません";
    box.append(p);
  }
  drawThumbnails();
}

// サムネイルは今のキャラ情報・配色で描く。操作中に何度も描かないよう少し待ってから描く
let thumbTimer;
function requestThumbnails() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(drawThumbnails, 250);
}

function drawThumbnails() {
  for (const t of templates) {
    if (!t.canvas?.isConnected) continue;
    const p = fromTemplate(t);
    const scale = Math.min(THUMB_W / p.card.w, THUMB_H / p.card.h);
    t.canvas.width = Math.round(p.card.w * scale);
    t.canvas.height = Math.round(p.card.h * scale);
    drawScene(t.canvas.getContext("2d"), p, new Map(), scale);
  }
}

function setPalette(pal) {
  project.palette = { ...FALLBACK_PALETTE, ...structuredClone(pal.colors) };
  project.paletteId = pal.id;
  paletteChanged();
  renderPaletteForm();
}

// 配色が変わると、色欄に表示している色も変わる
function paletteChanged() {
  changed();
  renderSwatches();
  renderFrames(); // オリジナル枠の見本は配色の色で描いている
  renderAddTiles(); // シンボルの見本も
  renderProps();
  renderCard();
}

// 枠の形の一覧。最初からある枠は SVG の見本、オリジナル枠は canvas に描いた見本
function renderFrames() {
  const box = $("frames");
  box.replaceChildren();
  const current = project.frame ?? "round";
  const pick = (id) => {
    project.frame = id;
    changed();
    renderFrames();
  };
  const frameButton = (id, name, preview) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "frame-btn";
    b.setAttribute("aria-pressed", String(current === id));
    b.append(preview, Object.assign(document.createElement("span"), { textContent: name }));
    b.addEventListener("click", () => pick(id));
    box.append(b);
  };
  for (const [id, name] of FRAMES) {
    const svg = document.createElement("span");
    svg.innerHTML = `<svg viewBox="0 0 60 40" aria-hidden="true">${FRAME_PREVIEW[id]}</svg>`;
    frameButton(id, name, svg.firstChild);
  }
  for (const def of loadCustomFrames()) {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 80;
    c.className = "frame-canvas";
    drawFramePreview(c, def, col, { pad: 8, radius: 10, alpha: 0.85, borderWidth: 2 });
    frameButton(CUSTOM_PREFIX + def.id, def.name || "オリジナル枠", c);
  }

  // 作る・直す・消す
  const row = $("frameActions");
  row.replaceChildren(button("＋ オリジナル枠を作成する", () => openFrameEditor(), "btn btn--small btn--primary"));
  const def = findCustomFrame(current);
  if (def) {
    row.append(
      button("この枠を編集", () => openFrameEditor(def.id)),
      button("この枠を削除", () => {
        if (!confirm(`「${def.name || "オリジナル枠"}」を削除します。よろしいですか?`)) return;
        saveCustomFrames(loadCustomFrames().filter((f) => f.id !== def.id));
        pick("round");
      }, "btn btn--small btn--danger"),
    );
  }
}

// 要素を追加の一覧。「枠の形」と同じように、見本付きのボタンを並べる(押すとカードの真ん中に追加)
const ADD_PREVIEW = {
  text: '<path d="M16 9H44M30 9V33" fill="none"/>',
  image: '<rect x="7" y="6" width="46" height="28" rx="4"/><path d="M11 31L24 18L32 26L38 20L49 31" fill="none"/><circle cx="41" cy="13" r="3"/>',
  rect: '<rect x="7" y="8" width="46" height="24" rx="7"/>',
  jobs: '<rect x="8" y="9" width="10" height="10" rx="2"/><rect x="25" y="9" width="10" height="10" rx="2"/><rect x="42" y="9" width="10" height="10" rx="2"/><rect x="8" y="23" width="10" height="10" rx="2"/><rect x="25" y="23" width="10" height="10" rx="2"/><rect x="42" y="23" width="10" height="10" rx="2"/>',
};
function renderAddTiles() {
  const box = $("addTiles");
  box.replaceChildren();
  const tile = (name, preview, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "frame-btn";
    b.append(preview, Object.assign(document.createElement("span"), { textContent: name }));
    b.addEventListener("click", onClick);
    box.append(b);
  };
  for (const type of ["text", "image", "rect", "jobs"]) {
    const svg = document.createElement("span");
    svg.innerHTML = `<svg viewBox="0 0 60 40" aria-hidden="true">${ADD_PREVIEW[type]}</svg>`;
    tile(type === "jobs" ? "ジョブ一覧" : TYPE_LABEL[type], svg.firstChild, () => addLayer(type));
  }
  // 自分で作ったシンボル(アクセント色で見本を描く)
  for (const sym of loadSymbols()) {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 80;
    c.className = "frame-canvas";
    drawSymbolPreview(c, sym, col("@accent"), 6);
    tile(sym.name || "オリジナルシンボル", c, () => addLayer("symbol", sym.id));
  }
  $("symbolActions").replaceChildren(button("＋ オリジナルシンボルを作成する", () => openSymbolEditor(), "btn btn--small btn--primary"));
}

// シンボルエディタへ移る(枠エディタと同じく、今のカードはすぐ保存しておく)
function openSymbolEditor(id) {
  saveNow();
  location.href = "symbol-editor.html" + (id ? "?id=" + encodeURIComponent(id) : "");
}
// シンボルを消す。カードに置いてある、そのシンボルの要素も一緒に消す
function deleteSymbol(sym) {
  const used = project.layers.filter((l) => l.type === "symbol" && l.symbol === sym.id).length;
  if (!confirm(`「${sym.name || "オリジナルシンボル"}」を削除します。${used ? `カードに置いてある ${used} 個も消えます。` : ""}よろしいですか?`)) return;
  saveSymbols(loadSymbols().filter((s) => s.id !== sym.id));
  project.layers = project.layers.filter((l) => !(l.type === "symbol" && l.symbol === sym.id));
  if (!project.layers.some((l) => l.id === selectedId)) selectedId = null;
  changed();
  renderProps();
  renderAddTiles();
}

// 枠エディタへ移る。今のカードはすぐ保存しておく(戻ってきたら、そのまま続けられる)
function openFrameEditor(id) {
  saveNow();
  location.href = "frame-editor.html" + (id ? "?id=" + encodeURIComponent(id) : "");
}

function renderSwatches() {
  const box = $("palettes");
  box.replaceChildren();
  for (const pal of PALETTES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.setAttribute("aria-pressed", String(project.paletteId === pal.id));
    const colors = document.createElement("span");
    colors.className = "swatch-colors";
    for (const k of ["bg1", "bg2", "panel", "accent", "text"]) {
      const dot = document.createElement("i");
      dot.style.background = pal.colors[k] ?? FALLBACK_PALETTE[k];
      colors.append(dot);
    }
    const name = document.createElement("span");
    name.textContent = pal.name;
    b.append(colors, name);
    b.addEventListener("click", () => setPalette(pal));
    box.append(b);
  }
}

function renderPaletteForm() {
  const box = $("paletteForm");
  box.replaceChildren();
  for (const [k, label] of ROLES) {
    box.append(field(project.palette, k, label, "color", { plain: true }, () => {
      project.paletteId = ""; // 手で変えたら「自分の配色」扱い
      paletteChanged();
    }));
  }
}

document.querySelectorAll("[data-orient]").forEach((b) => b.addEventListener("click", () => {
  designFilter = b.dataset.orient;
  document.querySelectorAll("[data-orient]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderGallery();
}));

// ---------- 取得・保存 ----------

function setStatus(text, kind = "") {
  const el = $("fetchStatus");
  el.textContent = text;
  el.className = "status" + (kind ? ` status--${kind}` : "");
}

$("fetchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = $("lodestoneId").value.trim();
  const id = raw.match(/character\/(\d+)/)?.[1] ?? raw.match(/^\d+$/)?.[0];
  if (!id) {
    setStatus("ID(数字)か、キャラページの URL を入れてください", "error");
    return;
  }

  const btn = $("fetchBtn");
  btn.disabled = true;
  setStatus("取得中…");
  try {
    const res = await fetch(`${WORKER}/?id=${id}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(res.status === 404 ? "キャラクターが見つかりませんでした" : `取得に失敗しました(${body.error ?? res.status})`);
    }
    const { face, image, ...info } = body; // Lodestone の画像は使わない
    project.data = { ...emptyData(), ...info };
    setStatus(`${body.name} を取得しました`, "ok");
    renderAll();
    saveSoon();
  } catch (err) {
    setStatus(err instanceof TypeError ? "通信に失敗しました。時間をおいて試してください" : err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function safeName(s) {
  return (s || "card").replace(/[\\/:*?"<>|\s]+/g, "_");
}

// 読み込み途中の画像(配色を変えた直後のジョブアイコンなど)を待つ。最大3秒
function imagesReady() {
  const pending = [...images.values()].filter((e) => !e.ok).map((e) => e.ready);
  return Promise.race([Promise.all([...pending, document.fonts.ready]), new Promise((r) => setTimeout(r, 3000))]);
}

$("exportPng").addEventListener("click", async () => {
  draw(); // 未読み込みの画像・フォントの読み込みを始める
  await imagesReady();
  flushFx(); // エフェクトは本番の解像度で描く
  exporting = true;
  draw();
  try {
    canvas.toBlob((blob) => {
      if (blob) download(blob, `characa_${safeName(project.data.name)}.png`);
    }, "image/png");
  } catch (err) {
    alert("PNG の書き出しに失敗しました: " + err.message);
  } finally {
    exporting = false;
    draw();
  }
});

// カードに置いてあるシンボル(書き出しに入れる)
function usedSymbols() {
  const ids = new Set(project.layers.filter((l) => l.type === "symbol").map((l) => l.symbol));
  const list = loadSymbols().filter((s) => ids.has(s.id));
  return list.length ? list : undefined;
}

$("exportJson").addEventListener("click", () => {
  const json = JSON.stringify({ version: 2, card: project.card, palette: project.palette, paletteId: project.paletteId, frame: project.frame, customFrames: findCustomFrame(project.frame) ? [findCustomFrame(project.frame)] : undefined, customSymbols: usedSymbols(), layers: project.layers }, null, 1);
  download(new Blob([json], { type: "application/json" }), "characa_template.json");
});

$("importJson").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const t = JSON.parse(await file.text());
    if (!t.card || !Array.isArray(t.layers)) throw new Error("形式が違います");
    // テンプレートに入っていたオリジナル枠を、このブラウザの枠に足す(同じ id があれば上書き)
    if (Array.isArray(t.customFrames) && t.customFrames.length) {
      const ids = new Set(t.customFrames.map((f) => f.id));
      saveCustomFrames([...loadCustomFrames().filter((f) => !ids.has(f.id)), ...t.customFrames]);
    }
    // シンボルも同じく、このブラウザのシンボルに足す
    if (Array.isArray(t.customSymbols) && t.customSymbols.length) {
      const ids = new Set(t.customSymbols.map((s) => s.id));
      saveSymbols([...loadSymbols().filter((s) => !ids.has(s.id)), ...t.customSymbols]);
    }
    project = normalize({ palette: project.palette, paletteId: project.paletteId, frame: project.frame, ...t, data: project.data });
    selectedId = null;
    renderAll();
    saveSoon();
  } catch (err) {
    alert("テンプレートを読み込めませんでした: " + err.message);
  }
});

$("reset").addEventListener("click", () => {
  if (!confirm("レイアウトを初期状態に戻します(キャラ情報はそのまま)。よろしいですか?")) return;
  project = { ...defaultProject(), data: project.data, palette: project.palette, paletteId: project.paletteId, frame: project.frame };
  selectedId = null;
  renderAll();
  saveSoon();
});

// メインのスクショ: いちばん背面側の画像枠に入れる(無ければカード全体の枠を作る)
$("mainShot").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const src = await readImage(file);
  let l = project.layers.find((x) => x.type === "image");
  if (!l) {
    l = makeLayer("image", { x: 0, y: 0, w: project.card.w, h: project.card.h });
    project.layers.unshift(l);
  }
  setImage(l, src);
});


// ---------- 画面のレイアウト ----------

// style.css の「横に広い画面」と同じ条件
const SIDE_BY_SIDE = matchMedia("(min-width: 900px), (orientation: landscape) and (min-width: 560px)");
const MIN_SHEET = 230; // 縦に並べるとき、下のシートに最低限残す高さ
const STAGE_REF = 1920; // この長さが制作エリアに収まる倍率で表示する(縦横どちらのカードでも同じ倍率になる)
const GRID_STEP = 120; // グリッド1マスのカード上の大きさ(px)

const ZOOM_MIN = 0.5, ZOOM_MAX = 6; // 「全体表示」を 1 とした表示倍率

// 表示の拡大縮小とスクロール(カードの中身は変えない。見え方だけ)
const view = { zoom: 1, panX: 0, panY: 0 };
const stage = { w: 0, h: 0, base: 1 }; // 制作エリアの内側の大きさと、全体表示のときの倍率

// 制作エリアの大きさと、全体表示のときのカードの倍率を決める
//   PC・横向き(横に並べるとき):空いている所いっぱいの横長
//   スマホ縦向き:横幅いっぱい。高さは横幅まで(下のシートが狭くならないように)
function layoutStage() {
  document.documentElement.style.setProperty("--top-h", `${document.querySelector(".top").offsetHeight}px`);
  const ws = $("workspace");
  const cs = getComputedStyle(ws);
  const bar = $("stageBar").offsetHeight + (parseFloat(cs.rowGap) || 0); // 下のボタンのバーの分
  const availW = ws.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availH = (SIDE_BY_SIDE.matches ? ws.clientHeight - padY : $("app").clientHeight - padY - MIN_SHEET) - bar;
  // 横幅はいつも空いている所いっぱい(左右に余白を作らない)。
  // 縦に並べるときの高さは、横幅までにとどめる(下のシートを狭くしないため)。高さが足りなければ横長になる
  const bw = Math.max(120, Math.floor(availW));
  const bh = Math.max(120, Math.floor(SIDE_BY_SIDE.matches ? availH : Math.min(availW, availH)));

  const board = $("artboard");
  board.style.width = `${bw}px`;
  board.style.height = `${bh}px`;
  $("stageBar").style.width = `${bw}px`;
  stage.w = board.clientWidth; // 枠線を除いた大きさ
  stage.h = board.clientHeight;
  // 基本は「横長カード(1920×1080)がちょうど収まる倍率」。横長・正方形のカードはこの同じ倍率で表示する。
  // それだと はみ出すカード(縦長など)だけ、収まる大きさまで縮める
  const ref = Math.min(stage.w / STAGE_REF, stage.h / ((STAGE_REF * 9) / 16));
  const fit = Math.min(stage.w / project.card.w, stage.h / project.card.h);
  stage.base = Math.min(ref, fit) * 0.94;
  applyView();
}

// 今の拡大率・スクロール位置でカードを置く
function applyView() {
  const { w: iw, h: ih, base } = stage;
  const s = base * view.zoom;
  const cw = project.card.w * s, ch = project.card.h * s;
  // カードが見えなくならないよう、動かせる範囲を決める(カードが制作エリアに収まっているときも動かせる)
  const limit = (size, inner) => Math.abs(size - inner) / 2 + inner * 0.3;
  view.panX = Math.max(-limit(cw, iw), Math.min(limit(cw, iw), view.panX));
  view.panY = Math.max(-limit(ch, ih), Math.min(limit(ch, ih), view.panY));
  const left = (iw - cw) / 2 + view.panX, top = (ih - ch) / 2 + view.panY;
  Object.assign(canvas.style, { width: `${cw}px`, height: `${ch}px`, left: `${left}px`, top: `${top}px` });

  const g = GRID_STEP * s;
  const grid = $("grid").style;
  grid.setProperty("--g", `${g}px`);
  grid.setProperty("--gx", `${((left % g) + g) % g}px`);
  grid.setProperty("--gy", `${((top % g) + g) % g}px`);
  $("zoomFit").textContent = `${Math.round(view.zoom * 100)}%`;
  $("artboard").classList.toggle("zoomed", view.zoom > 1);
  requestDraw(); // 選択枠の太さを表示倍率に合わせる
}

// 制作エリアの点 (sx, sy) を中心に拡大縮小する(省略したら真ん中)
function zoomTo(zoom, sx = stage.w / 2, sy = stage.h / 2) {
  const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  const { w: iw, h: ih, base } = stage;
  const before = base * view.zoom, after = base * z;
  const left = (iw - project.card.w * before) / 2 + view.panX;
  const top = (ih - project.card.h * before) / 2 + view.panY;
  // その点にあるカード上の位置が、拡大縮小のあとも同じ点に来るようにする
  const u = (sx - left) / before, v = (sy - top) / before;
  view.zoom = z;
  view.panX = sx - u * after - (iw - project.card.w * after) / 2;
  view.panY = sy - v * after - (ih - project.card.h * after) / 2;
  applyView();
}

let viewDrag = null;
function startViewDrag(e) {
  viewDrag = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY };
  $("artboard").classList.add("panning");
  return true;
}

function resetView() {
  Object.assign(view, { zoom: 1, panX: 0, panY: 0 });
  applyView();
}

// 制作エリアの中の座標(枠線の内側の左上が 0,0)
function boardPoint(e) {
  const r = $("artboard").getBoundingClientRect();
  const b = parseFloat(getComputedStyle($("artboard")).borderLeftWidth) || 0;
  return { x: e.clientX - r.left - b, y: e.clientY - r.top - b };
}

new ResizeObserver(layoutStage).observe($("app"));
SIDE_BY_SIDE.addEventListener("change", layoutStage);

$("zoomIn").addEventListener("click", () => zoomTo(view.zoom * 1.25));
$("zoomOut").addEventListener("click", () => zoomTo(view.zoom / 1.25));
$("zoomFit").addEventListener("click", resetView);

// PC: 素材に触れていない所のホイール・Ctrl(Mac は ⌘)+ホイール・トラックパッドのピンチで拡大縮小、素材の上のホイールはスクロール
// (選択中の画像の上のホイールは、画像のズームが先に使う)
$("artboard").addEventListener("wheel", (e) => {
  if (e.defaultPrevented) return;
  e.preventDefault();
  // 素材(要素)に触れていない所でのホイールは拡大縮小。素材の上ではスクロール(Ctrl・⌘ を押していれば拡大縮小)
  const onItem = e.target === canvas && !!hitTest(toCard(e));
  if (e.ctrlKey || e.metaKey || !onItem) {
    const p = boardPoint(e);
    // マウスのホイール1目盛り(100前後)で約1.2倍。トラックパッドの細かい動きはそのまま滑らかに
    const d = Math.max(-20, Math.min(20, e.deltaY * (e.deltaMode === 1 ? 16 : 1)));
    zoomTo(view.zoom * Math.exp(-d * 0.01), p.x, p.y);
  } else {
    view.panX -= e.deltaX;
    view.panY -= e.deltaY;
    applyView();
  }
}, { passive: false });

// スマホ: 2本指でつまんで拡大縮小・2本指で動かしてスクロール
const touches = new Map();
let pinch = null;
$("artboard").addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  touches.set(e.pointerId, boardPoint(e));
  if (touches.size !== 2) return;
  // 1本目の指で要素を動かし始めていたら、元の位置に戻してやめる
  if (drag && drag.layer) Object.assign(drag.layer, drag.orig);
  drag = null;
  endViewDrag();
  const [a, b] = [...touches.values()];
  pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  e.stopPropagation();
}, { capture: true });
$("artboard").addEventListener("pointermove", (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, boardPoint(e));
  if (!pinch || touches.size < 2) return;
  e.stopPropagation();
  const [a, b] = [...touches.values()];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  view.panX += mid.x - pinch.mid.x;
  view.panY += mid.y - pinch.mid.y;
  pinch.mid = mid;
  zoomTo(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist), mid.x, mid.y);
}, { capture: true });
const releaseTouch = (e) => {
  touches.delete(e.pointerId);
  if (pinch && touches.size < 2) {
    pinch = null;
    requestDraw();
  }
};
$("artboard").addEventListener("pointerup", releaseTouch, { capture: true });
$("artboard").addEventListener("pointercancel", releaseTouch, { capture: true });

// グリッドの表示・非表示(このブラウザに覚えておく)
const GRID_KEY = "characa:grid";
function setGrid(on) {
  $("artboard").classList.toggle("no-grid", !on);
  $("gridToggle").setAttribute("aria-pressed", String(on));
  try {
    localStorage.setItem(GRID_KEY, on ? "1" : "0");
  } catch {}
}
$("gridToggle").addEventListener("click", () => setGrid($("artboard").classList.contains("no-grid")));
// カードの外側(制作エリアの余白)を押したら選択を外す。拡大中ならそのままドラッグでスクロール
$("artboard").addEventListener("pointerdown", (e) => {
  if (e.target !== e.currentTarget) return;
  select(null);
  if (startViewDrag(e)) e.currentTarget.setPointerCapture(e.pointerId);
});
$("artboard").addEventListener("pointermove", (e) => {
  if (!viewDrag || pinch) return;
  view.panX = viewDrag.panX + e.clientX - viewDrag.x;
  view.panY = viewDrag.panY + e.clientY - viewDrag.y;
  applyView();
});
const endViewDrag = () => {
  viewDrag = null;
  $("artboard").classList.remove("panning");
};
$("artboard").addEventListener("pointerup", endViewDrag);
$("artboard").addEventListener("pointercancel", endViewDrag);
try {
  setGrid(localStorage.getItem(GRID_KEY) !== "0");
} catch {
  setGrid(true);
}

// 付箋タブ
const TAB_KEY = "characa:tab";
function openTab(name) {
  // すでに開いているタブなら何もしない(スクロール位置を先頭に戻さない)
  if (document.querySelector(`.sheet-tab[data-tab="${name}"]`)?.getAttribute("aria-selected") === "true") return;
  let color = "";
  document.querySelectorAll(".sheet-tab").forEach((t) => {
    const on = t.dataset.tab === name;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    if (on) color = t.style.getPropertyValue("--c");
  });
  document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== name));
  const body = $("sheetBody");
  body.style.setProperty("--tab-c", color);
  body.scrollTop = 0;
  try {
    localStorage.setItem(TAB_KEY, name);
  } catch {}
}
document.querySelectorAll(".sheet-tab").forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));
let savedTab = null;
try {
  savedTab = localStorage.getItem(TAB_KEY);
} catch {}
if (savedTab === "edit") savedTab = "layers"; // 「編集」タブは「要素」タブにまとめた
openTab(document.querySelector(`.sheet-tab[data-tab="${savedTab}"]`) ? savedTab : "design");

if (matchMedia("(pointer: coarse)").matches) {
  $("hint").textContent = "タップで選択 / ドラッグで移動 / 辺・角(ピンクの●)をドラッグで大きさを変える / 2本指でつまむと表示を拡大縮小、2本指で動かすとスクロール";
}

// 枠エディタで保存して戻ってきたときは、その枠を選んだ状態にする
{
  const params = new URLSearchParams(location.search);
  const back = params.get("frame");
  if (back && findCustomFrame(back)) {
    project.frame = back;
    saveNow();
    openTab("design");
  }
  // シンボルエディタで保存して戻ってきたとき:新しく作ったシンボルはカードに置く
  const sym = params.get("symbol");
  if (sym && findSymbol(sym)) {
    if (params.get("add")) addLayer("symbol", sym);
    saveNow();
    openTab("layers");
  }
  if (params.toString()) history.replaceState(null, "", location.pathname);
}

renderAll();
loadTemplates();
