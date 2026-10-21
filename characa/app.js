"use strict";

const WORKER = "https://characa.game-rain-0406.workers.dev";
// 作りかけのカードは、このタブを開いているあいだだけ覚えておく(sessionStorage)
// 枠・シンボルエディタとの行き来や再読み込みでは残り、タブを閉じて開きなおすと最初の状態に戻る
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

const TYPE_LABEL = { text: "テキスト", image: "画像", rect: "枠", jobs: "ジョブ", activities: "コンテンツ", playtime: "時間帯", mainjob: "メインジョブ", symbol: "シンボル", jobicon: "ジョブアイコン", folder: "フォルダー" };
// カードに1つあれば十分な要素。「追加」では、置くかどうか(表示・非表示)だけを切り替える
const SINGLE_TYPES = ["mainjob", "jobs", "playtime", "activities"];

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

// 「背景の板」(ジョブ一覧・時間帯・コンテンツ・メインジョブのうしろに敷く板)
const PANEL_DEFAULTS = { panelFrame: "none", panelColor: "@panel", panelOpacity: 0.4, panelBorderWidth: 2, panelBorderColor: "@accent" };
const DEFAULTS = {
  // テキストは箱(x, y, w, h)の中に書く。w が 0 なら文字に合わせた幅(そのときは x が揃えの基準点)、h が 0 なら行に合わせた高さ
  //   wrap なら箱の幅で折り返す。箱からはみ出した所は描かない
  text: { text: "テキスト", font: "Noto Sans JP", size: 48, color: "@text", bold: false, italic: false, align: "left", lineHeight: 1.4, spacing: 0, w: 0, h: 0, wrap: true, strokeColor: "#000000", strokeWidth: 0, shadow: true, opacity: 1 },
  image: { src: "", w: 640, h: 360, fit: "cover", zoom: 1, posX: 0, posY: 0, radius: 0, flip: false, borderColor: "@accent", borderWidth: 0, opacity: 1, ...FX_DEFAULTS },
  rect: { frame: "round", w: 400, h: 240, color: "@panel", radius: 16, borderColor: "@accent", borderWidth: 0, opacity: 0.4 },
  symbol: { symbol: "", w: 240, h: 240, color: "@accent", opacity: 1 }, // シンボルエディタで作った形(symbol は id)
  jobicon: { job: "ナイト", w: 160, h: 160, color: "@accent", opacity: 1 }, // ジョブアイコンを1つ、シンボルのように置く
  jobs: { display: "icon", filter: "battle", hideUnlearned: false, cols: 6, h: 0, cellW: 155, font: "Noto Sans JP", size: 28, bold: false, iconColor: "@text", color: "@text", levelColor: "@accent", dimColor: "@muted", mainColor: "@accent", subColor: "@accent", boardShow: true, boardFrame: "pill", mainLine: 2, subLine: 0, ...PANEL_DEFAULTS, shadow: true, opacity: 1 },
  // やっているコンテンツ(タグを並べる)。どれをやっているかは、キャラ情報の data.activities に入る
  activities: { w: 800, h: 0, font: "Noto Sans JP", size: 24, bold: true, color: "@text", chipColor: "@accent", chipFill: "soft", chipLine: 2, chipLineColor: "@accent", chipFrame: "pill", ...PANEL_DEFAULTS, opacity: 1 },
  // 時間帯(エオ住/不定期 + 朝〜深夜をタグで並べる)。data.playStyle / data.playTimes。朝〜深夜はアイコンで出せる
  playtime: { w: 800, h: 0, font: "Noto Sans JP", size: 24, bold: true, color: "@text", timeDisplay: "icon", chipColor: "@sub", chipFill: "soft", chipLine: 2, chipLineColor: "@sub", chipFrame: "pill", ...PANEL_DEFAULTS, opacity: 1 },
  // メインジョブ(アイコン+ジョブ名+レベル)。data.mainJob
  mainjob: { font: "Noto Sans JP", size: 34, bold: true, color: "@text", iconColor: "@accent", levelColor: "@accent", showName: true, showLevel: true, ...PANEL_DEFAULTS, shadow: true, opacity: 1 },
  folder: { name: "フォルダー", open: true, opacity: 1 }, // レイヤーをまとめる入れ物(それ自体は描かない)
};

// 背景の板の調整欄(形・色・不透明度・線)
const PANEL_FIELDS = [
  ["panelFrame", "背景の板(形)", "frame", { first: [["none", "なし"]] }],
  ["panelColor", "背景の板の色", "color"],
  ["panelOpacity", "背景の板の不透明度", "range", { min: 0, max: 1, step: 0.05 }],
  ["panelBorderWidth", "背景の板の線の太さ(0 = なし)", "number", { min: 0, step: 0.5 }],
  ["panelBorderColor", "背景の板の線の色", "color"],
];
// タグの調整欄(コンテンツ・時間帯)
const CHIP_FIELDS = [
  ["chipFrame", "タグの形", "frame", { first: [["pill", "標準(まるいタグ)"]] }],
  ["chipFill", "タグの塗り", "select", { options: [["soft", "うす塗り"], ["fill", "しっかり塗り"], ["none", "塗りなし"]] }],
  ["chipColor", "タグの塗りの色", "color"],
  ["chipLine", "タグの線の太さ(0 = なし)", "number", { min: 0, step: 0.5 }],
  ["chipLineColor", "タグの線の色", "color"],
  ["color", "文字の色", "color"],
  ["font", "フォント", "font"],
  ["size", "サイズ", "number", { min: 4 }],
  ["bold", "太字", "checkbox"],
];

const FIELDS = {
  text: [
    ["text", "テキスト", "textarea"],
    ["font", "フォント", "font"],
    ["size", "サイズ", "number", { min: 4 }],
    ["color", "色", "color"],
    ["align", "揃え", "align"],
    ["wrap", "箱の幅で自動改行する(しないときは、はみ出した所を切る)", "checkbox", { wide: true }],
    ["w", "箱の幅(0 = 文字に合わせる)", "number", { min: 0 }],
    ["h", "箱の高さ(0 = 文字に合わせる)", "number", { min: 0 }],
    ["bold", "太字", "checkbox"],
    ["italic", "斜体", "checkbox"],
    ["lineHeight", "行間", "number", { min: 0.5, step: 0.1 }],
    ["spacing", "字間", "number"],
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
    ["borderWidth", "枠線の太さ(0 = なし)", "number", { min: 0, step: 0.5 }],
    ["borderColor", "枠線の色", "color"],
  ],
  rect: [
    ["frame", "枠の形", "frame"],
    ["w", "幅", "number", { min: 4 }],
    ["h", "高さ", "number", { min: 4 }],
    ["color", "色", "color"],
    ["radius", "角丸", "number", { min: 0 }],
    ["borderWidth", "枠線の太さ(0 = なし)", "number", { min: 0, step: 0.5 }],
    ["borderColor", "枠線の色", "color"],
  ],
  symbol: [
    ["w", "幅", "number", { min: 4 }],
    ["h", "高さ", "number", { min: 4 }],
    ["color", "色", "color"],
  ],
  jobicon: [
    ["job", "ジョブ", "select", { options: BATTLE_JOBS.filter((j) => JOB_ICONS[j]).map((j) => [j, j]) }],
    ["w", "幅", "number", { min: 4 }],
    ["h", "高さ", "number", { min: 4 }],
    ["color", "色", "color"],
  ],
  jobs: [
    ["display", "表示形式", "select", { options: [["icon", "アイコン+レベル"], ["iconName", "アイコン+名前+レベル"], ["name", "名前+レベル"]] }],
    ["filter", "表示するジョブ", "select", { options: [["battle", "戦闘職"], ["craft", "クラフター・ギャザラー"], ["all", "すべて"]] }],
    ["hideUnlearned", "未習得を隠す", "checkbox"],
    ["w", "幅", "number", { min: 20 }],
    ["h", "高さ(0 = 中身に合わせる)", "number", { min: 0 }],
    ["cellW", "1つぶんの幅", "number", { min: 20 }],
    ["font", "フォント", "font"],
    ["size", "サイズ", "number", { min: 4 }],
    ["iconColor", "アイコンの色", "color"],
    ["color", "ジョブ名の色", "color"],
    ["levelColor", "レベルの色", "color"],
    ["dimColor", "未習得の色", "color"],
    ["mainColor", "メインジョブの強調の色", "color"],
    ["subColor", "サブジョブの色", "color"],
    ["boardShow", "メイン・サブの板を出す", "checkbox", { wide: true }],
    ["boardFrame", "メイン・サブの板の形", "frame", { first: [["pill", "標準(角丸)"]] }],
    ["mainLine", "メインの板の線の太さ(0 = なし)", "number", { min: 0, step: 0.5 }],
    ["subLine", "サブの板の線の太さ(0 = なし)", "number", { min: 0, step: 0.5 }],
    ...PANEL_FIELDS,
    ["bold", "太字", "checkbox"],
    ["shadow", "影", "checkbox"],
  ],
  activities: [
    ["w", "幅", "number", { min: 20 }],
    ["h", "高さ(0 = 中身に合わせる)", "number", { min: 0 }],
    ...CHIP_FIELDS,
    ...PANEL_FIELDS,
  ],
  playtime: [
    ["timeDisplay", "朝〜深夜の出し方", "select", { options: [["icon", "アイコン"], ["iconText", "アイコン+文字"], ["text", "文字"]] }],
    ["w", "幅", "number", { min: 20 }],
    ["h", "高さ(0 = 中身に合わせる)", "number", { min: 0 }],
    ...CHIP_FIELDS,
    ...PANEL_FIELDS,
  ],
  mainjob: [
    ["font", "フォント", "font"],
    ["size", "サイズ", "number", { min: 4 }],
    ["bold", "太字", "checkbox"],
    ["color", "ジョブ名の色", "color"],
    ["iconColor", "アイコンの色", "color"],
    ["levelColor", "レベルの色", "color"],
    ["showName", "ジョブ名を出す", "checkbox"],
    ["showLevel", "レベルを出す", "checkbox"],
    ["shadow", "影", "checkbox"],
    ...PANEL_FIELDS,
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

// 以前は localStorage に保存していたので、残っているデータは消しておく
try {
  localStorage.removeItem(STORAGE_KEY);
} catch {}
let project = load() ?? defaultProject();
let selectedId = null;
let exporting = false;
const boundsById = new Map();

// やっているコンテンツの選択肢(グループ → タグ)。増やすときはここに足す。自由に足したタグは data.activities にそのまま入る
const ACTIVITY_GROUPS = [
  ["戦う", ["ルーレット", "レイド", "極", "零式", "絶", "PvP", "モブハント", "DD"]],
  ["作る・集める", ["クラフター", "ギャザラー", "金策", "ゴールドソーサー", "マウント収集", "ミニオン収集", "アチブ収集"]],
  ["その他", ["ミラプリ", "グルポ", "ハウジング", "FC活動", "雑談", "ロールプレイ", "配信"]],
];
const PLAY_TIMES = ["朝", "昼", "夕方", "夜", "深夜"];
const PLAY_STYLES = ["不定期", "エオ住"];
const ACTIVITY_KNOWN = ACTIVITY_GROUPS.flatMap(([, tags]) => tags);
// チェックしたタグを、選択肢の順に(自分で足したものは、そのあとに入れた順で)
function activityList() {
  const sel = project.data.activities ?? [];
  return [...ACTIVITY_KNOWN.filter((t) => sel.includes(t)), ...sel.filter((t) => !ACTIVITY_KNOWN.includes(t))];
}

function emptyData() {
  const data = Object.fromEntries(VARS.map(([k, label]) => [k, label]));
  Object.assign(data, { gender: "♂", birthday: "", guardian: "", hometown: "", grandCompany: "", grandCompanyRank: "", selfIntroduction: "" });
  data.levels = BATTLE_JOBS.map((name) => ({ name, level: "--" }));
  data.activities = []; // やっているコンテンツ(チェックしたタグ)
  data.playTimes = []; // プレイする時間帯
  data.playStyle = ""; // "" / "不定期" / "エオ住"
  data.mainJob = ""; // メインジョブ(1つ)
  data.subJobs = []; // サブジョブ(複数)
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
  // 最初から入っているフォルダー:「名前」(称号・キャラ名・ワールドと、そのうしろの枠)と「ジョブ」。時間帯・コンテンツ・表記はフォルダーの外
  const name = makeLayer("folder", { name: "名前" });
  const job = makeLayer("folder", { name: "ジョブ" });
  const inName = (type, props) => makeLayer(type, { ...props, folder: name.id });
  const inJob = (type, props) => makeLayer(type, { ...props, folder: job.id });
  return {
    card: { w: 1920, h: 1080, bg: { type: "gradient", color1: "@bg1", color2: "@bg2", angle: 135, image: "", dim: 0.3 } },
    palette: defaultPalette(),
    paletteId: PALETTES[0]?.id ?? "",
    data: emptyData(),
    layers: [
      // スクショがカード全体の土台。その上に文字やパネルを載せる
      makeLayer("image", { x: 0, y: 0, w: 1920, h: 1080 }),
      inName("rect", { name: "プロフィール枠", x: 1000, y: 60, w: 860, h: 960, opacity: 0.55, radius: 28, borderWidth: 2 }),
      inName("text", { text: "{title}", x: 1060, y: 110, w: 780, size: 36, color: "@accent", wrap: false }),
      inName("text", { text: "{name}", x: 1056, y: 160, w: 784, size: 96, font: "Cinzel", bold: true, wrap: false }),
      inName("text", { text: "{server} [{dataCenter}]", x: 1060, y: 290, w: 780, size: 40, color: "@sub", wrap: false }),
      name,
      inJob("mainjob", { x: 1060, y: 380, size: 30 }),
      inJob("jobs", { x: 1060, y: 450, w: 780, cellW: 145, size: 26 }),
      job,
      makeLayer("playtime", { x: 1060, y: 720, w: 780, size: 22 }),
      makeLayer("activities", { x: 1060, y: 790, w: 780, size: 22 }),
      makeLayer("text", { text: "(C) SQUARE ENIX", x: 1590, y: 1040, w: 300, size: 20, align: "right", color: "@sub", opacity: 0.7, wrap: false }),
    ],
  };
}

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (!saved?.card || !Array.isArray(saved.layers)) return null;
    return normalize(saved);
  } catch {
    return null;
  }
}

function numbered(layers) {
  assignShapeNumbers(layers);
  return layers;
}

// 古い保存データや読み込んだテンプレートに足りない項目を補う
// 以前のデータの「カード全体の枠の形」。使えない値なら丸い角
function oldFrame(frame) {
  return FRAMES.some(([id]) => id === frame) || findCustomFrame(frame) ? frame : "round";
}

function normalize(p) {
  const base = defaultProject();
  return {
    card: { ...base.card, ...p.card, bg: { ...base.card.bg, ...p.card?.bg } },
    palette: { ...base.palette, ...p.palette },
    paletteId: p.palette ? p.paletteId ?? "" : base.paletteId,
    data: (({ face, image, ...d }) => d)({ ...emptyData(), ...p.data }), // 以前保存した Lodestone の画像URLは捨てる
    // bind は以前の「Lodestone の画像を表示」設定(廃止)。p.frame は以前の「カード全体の枠の形」(今は枠ごと)
    layers: numbered(tidyFolders(p.layers.filter((l) => DEFAULTS[l.type]).map(({ bind, ...l }) => ({ ...makeLayer(l.type), ...upgradeLayer(l), ...(l.type === "rect" && !l.frame ? { frame: oldFrame(p.frame) } : {}) })))),
  };
}

// 前の形の保存データ(デザインの JSON も)を、今の形にする。初期値を足す前の、保存されていた中身だけを見る
function upgradeLayer(raw) {
  const l = { ...raw };
  // テキスト:前は x が揃えの基準点で、width(0 = 折り返さない)だった → 箱(x が左端、w、wrap)
  if (l.type === "text" && l.w === undefined) {
    const width = l.width ?? 0;
    if (width > 0) {
      l.w = width;
      l.wrap = true;
      if (l.align === "center") l.x = Math.round(l.x - width / 2);
      else if (l.align === "right") l.x = Math.round(l.x - width);
    } else {
      l.w = 0; // 文字に合わせた幅。x は今までどおり揃えの基準点
    }
    delete l.width;
  }
  // タグ:前は chipStyle(うす塗り+線 / しっかり塗り / 線だけ)と chipLine(0 = 自動) → 塗り(chipFill)と線(chipLine。0 = なし)を別に
  if ("chipStyle" in l) {
    const auto = Math.max(1.5, (l.size ?? DEFAULTS[l.type]?.size ?? 24) * 0.08);
    l.chipFill = { soft: "soft", fill: "fill", line: "none" }[l.chipStyle] ?? "soft";
    l.chipLine = l.chipStyle === "fill" ? 0 : l.chipLine > 0 ? l.chipLine : auto;
    delete l.chipStyle;
  }
  if (l.chipColor && !l.chipLineColor) l.chipLineColor = l.chipColor; // 前は、線もタグの色だった
  return l;
}

// 今すぐ保存する(別のページへ移る前など)
function saveNow() {
  clearTimeout(saveTimer);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {}
}

let saveTimer;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      setStatus("自動保存できませんでした(画像が大きすぎる可能性があります)。PNG保存とテンプレート書き出しは使えます", "error");
    }
  }, 300);
}

function selected() {
  return project.layers.find((l) => l.id === selectedId) ?? null;
}

// ---------- フォルダー ----------
// フォルダーもレイヤーの1つ(type: "folder"。それ自体は何も描かない)。中のレイヤーは folder にフォルダーの id を持つ
//   並びの決まり:中のレイヤーは、フォルダーのすぐ後ろにまとめて置く(配列ではフォルダーの直前。一覧ではフォルダーの行のすぐ下)
//   フォルダーの中にフォルダーも入れられる(何段でも)。中のフォルダーも、その中身ごとまとめて置く
//   (保存データを読むときにも使うので、const ではなく function で書く)
function isFolder(l) {
  return l?.type === "folder";
}
function folderOf(l) {
  return l?.folder ? project.layers.find((x) => x.id === l.folder) ?? null : null;
}
// すぐ中に入っているもの(中のフォルダーの、さらに中身は含まない)
function childrenOf(f, layers = project.layers) {
  return layers.filter((l) => l.folder === f.id);
}
// 入っているフォルダーを、内側から外側へ順に(いちばん外のフォルダーが最後)
function ancestorsOf(l, layers = project.layers) {
  const out = [];
  let p = l?.folder ? layers.find((x) => x.id === l.folder) : null;
  while (p && !out.includes(p)) {
    out.push(p);
    p = p.folder ? layers.find((x) => x.id === p.folder) : null;
  }
  return out;
}
// フォルダーの中身をぜんぶ(中のフォルダーとその中身も。並びは配列の順)
function subtreeOf(f, layers = project.layers) {
  return layers.filter((l) => ancestorsOf(l, layers).includes(f));
}
// フォルダーの中の、描かれる要素だけ(中のフォルダーの中身も含む)
function contentsOf(f, layers = project.layers) {
  return subtreeOf(f, layers).filter((l) => !isFolder(l));
}
// 自分が隠れているか、入っているフォルダー(外側のどれか)が隠れているか
function isHidden(l) {
  return l.hidden || ancestorsOf(l).some((f) => f.hidden);
}
// 不透明度は、入っているフォルダーぜんぶの分を掛ける
function folderOpacity(l) {
  return ancestorsOf(l).reduce((a, f) => a * (f.opacity ?? 1), 1);
}

// 並びの決まりに合わせて並べ直す(なくなったフォルダーの印や、自分の中に自分が入るような印も消す)
function tidyFolders(layers) {
  const byId = new Map(layers.map((l) => [l.id, l]));
  for (const l of layers) if (l.folder && !isFolder(byId.get(l.folder))) delete l.folder;
  for (const l of layers) {
    // たどっていって自分に戻ってくる(輪になっている)ときは、フォルダーから出す
    const seen = new Set([l.id]);
    for (let p = l.folder && byId.get(l.folder); p; p = p.folder && byId.get(p.folder)) {
      if (seen.has(p.id)) {
        delete l.folder;
        break;
      }
      seen.add(p.id);
    }
  }
  const out = [];
  const put = (l) => {
    if (isFolder(l)) for (const c of layers) if (c.folder === l.id) put(c);
    out.push(l);
  };
  for (const l of layers) if (!l.folder) put(l);
  return out;
}

// フォルダーを作る。いつも空のフォルダーを、いちばん外の階層のいちばん上(前面)に作る(選んでいるものは入れない)
//   中身は、一覧でドラッグして入れる
function createFolder() {
  const n = project.layers.filter(isFolder).length + 1;
  const f = makeLayer("folder", { name: `フォルダー ${n}` });
  project.layers.push(f);
  changed();
  select(f.id);
}

$("addFolder").addEventListener("click", createFolder);

// フォルダーをなくす。withChildren なら中身も消す。そうでなければ中身はその場に残す(フォルダーから出すだけ)
//   (フォルダーの中のフォルダーを解除したときは、中身は1つ外のフォルダーに入る)
function removeFolder(f, withChildren) {
  const kids = withChildren ? subtreeOf(f) : childrenOf(f);
  if (withChildren) project.layers = project.layers.filter((l) => l !== f && !kids.includes(l));
  else {
    for (const k of kids) {
      if (f.folder) k.folder = f.folder;
      else delete k.folder;
    }
    project.layers = tidyFolders(project.layers.filter((l) => l !== f));
  }
  if (selectedId === f.id || (withChildren && kids.some((k) => k.id === selectedId))) selectedId = null;
  changed();
  renderProps();
}

// フォルダーの中身をまとめて動かす
function moveFolderBy(f, dx, dy) {
  for (const k of contentsOf(f)) {
    k.x = Math.round(k.x + dx);
    k.y = Math.round(k.y + dy);
  }
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
      if (isFolder(l) || isHidden(l)) continue;
      ctx.save();
      ctx.globalAlpha = (l.opacity ?? 1) * folderOpacity(l);
      bounds.set(l.id, DRAW[l.type](l));
      ctx.restore();
    }
    // フォルダーの枠 = 中の見えている要素の枠をぜんぶ囲む枠
    for (const f of p.layers.filter(isFolder)) {
      const bs = contentsOf(f).map((c) => bounds.get(c.id)).filter(Boolean);
      if (!bs.length) continue;
      const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
      bounds.set(f.id, { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y });
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
  // テキストの箱。w があれば箱の中で揃え、wrap なら箱の幅で折り返す。箱からはみ出した所は切る
  //   w が 0 なら文字に合わせた幅(x が揃えの基準点)、h が 0 なら行に合わせた高さ
  text(l) {
    ctx.font = fontString(l);
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${l.spacing || 0}px`;
    ctx.textBaseline = "top";
    ctx.textAlign = l.align;
    const text = resolveText(l.text);
    ensureFont(ctx.font, text);

    const boxed = l.w > 0;
    const lines = wrapLines(text, boxed && l.wrap ? l.w : 0);
    const lh = l.size * l.lineHeight;
    const contentH = Math.max(lh * (lines.length - 1) + l.size, l.size);
    const bw = boxed ? l.w : Math.max(1, ...lines.map((s) => ctx.measureText(s).width));
    const bh = l.h > 0 ? l.h : contentH;
    const bx = boxed ? l.x : l.align === "center" ? l.x - bw / 2 : l.align === "right" ? l.x - bw : l.x;
    const tx = l.align === "center" ? bx + bw / 2 : l.align === "right" ? bx + bw : bx; // 揃えの基準点

    if (boxed || l.h > 0) {
      // 縁取りの太さと、上下は影・文字の下の出っぱりのぶんだけ残す
      const mx = l.strokeWidth || 0, my = mx + l.size * 0.2;
      ctx.beginPath();
      ctx.rect(bx - mx, l.y - my, bw + mx * 2, bh + my * 2);
      ctx.clip();
    }
    lines.forEach((s, i) => {
      const y = l.y + i * lh;
      if (y > l.y + bh) return; // 箱の下に出る行は描かない
      if (l.shadow) setShadow(l.size);
      if (l.strokeWidth > 0) {
        ctx.lineJoin = "round";
        ctx.lineWidth = l.strokeWidth * 2;
        ctx.strokeStyle = col(l.strokeColor);
        ctx.strokeText(s, tx, y);
        clearShadow(); // 影は縁取りにだけ付ける
      }
      ctx.fillStyle = col(l.color);
      ctx.fillText(s, tx, y);
      clearShadow();
    });
    return { x: bx, y: l.y, w: bw, h: bh };
  },

  // ジョブアイコンを1つ、箱いっぱいに(シンボルと同じように)
  jobicon(l) {
    const icon = jobIcon(l.job, col(l.color));
    if (icon) ctx.drawImage(icon, l.x, l.y, l.w, l.h);
    return { x: l.x, y: l.y, w: l.w, h: l.h };
  },

  // 枠(w×h)の中に画像を収める。posX/posY は -100(左・上端)〜100(右・下端)
  image(l) {
    const img = l.src && getImage(l.src);
    const b = { x: l.x, y: l.y, w: l.w, h: l.h, dw: l.w, dh: l.h, dx: l.x, dy: l.y };
    if (img) {
      drawPhoto(l, img, b);
      if (l.borderWidth > 0) {
        roundRectPath(l.x, l.y, l.w, l.h, l.radius);
        ctx.lineWidth = l.borderWidth;
        ctx.strokeStyle = col(l.borderColor);
        ctx.stroke();
      }
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

  // 枠(パネル)。形は枠ごとに選ぶ(l.frame)。塗り・枠線(オリジナル枠は、その線の色・太さ)・飾り・切り抜きは frames.js
  rect(l) {
    drawFramePanel(ctx, l.frame || "round", l, col, col(l.color));
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
    // 最後の1つは「1つぶんの幅」まるごとではなく、実際に見える幅(アイコン+レベルなど)が入ればよい
    const itemW = Math.min(l.cellW, l.display === "icon" ? nameX + ctx.measureText("100").width : l.cellW - l.size * 0.6);
    const cols = jobCols(l, itemW);
    const maxRows = l.h > 0 ? Math.max(1, Math.floor((l.h - lineH) / rowH) + 1) : Infinity; // 高さに入らない行は出さない
    // 長いジョブ名はレベルと重ならないよう横に縮める
    const nameMax = Math.max(1, l.cellW - nameX - l.size * 1.1 - ctx.measureText("100").width);

    {
      const rows = Math.min(maxRows, Math.max(1, Math.ceil(list.length / cols)));
      drawElementPanel(l, l.x, l.y, jobWidth(l), l.h > 0 ? l.h : (rows - 1) * rowH + lineH);
    }
    list.slice(0, cols * maxRows).forEach((j, i) => {
      const x = l.x + (i % cols) * l.cellW;
      const cy = l.y + Math.floor(i / cols) * rowH + lineH / 2;
      const learned = /^\d+$/.test(j.level);
      const isMain = j.name === project.data.mainJob;
      const isSub = !isMain && (project.data.subJobs ?? []).includes(j.name);
      // サブジョブは、アイコン・名前・レベルをサブジョブの色にする(レベルが未取得でも、未習得の色より優先)
      const tone = isSub ? col(l.subColor ?? "@accent") : null;
      const dim = learned || tone ? null : col(l.dimColor);
      if ((isMain || tone) && l.boardShow !== false) {
        // うしろに板を敷く。メインジョブ=濃い板、サブジョブ=うすい板。線の太さはそれぞれ決める(0 = 線なし)
        const pad = l.size * 0.28;
        ctx.save();
        clearShadow();
        shapePath(l.boardFrame, x - pad, cy - lineH / 2 - pad, itemW + pad * 2, lineH + pad * 2, (lineH + pad * 2) / 3);
        const mc = tone ?? col(l.mainColor ?? "@accent");
        ctx.fillStyle = rgba(mc, isMain ? 0.28 : 0.14);
        ctx.fill();
        const line = isMain ? l.mainLine ?? 2 : l.subLine ?? 0;
        if (line > 0) {
          ctx.strokeStyle = mc;
          ctx.lineWidth = line;
          ctx.stroke();
        }
        ctx.restore();
      }

      if (withIcon) {
        const icon = jobIcon(j.name, dim ?? tone ?? (isMain ? col(l.mainColor ?? "@accent") : col(l.iconColor)));
        if (icon) {
          ctx.drawImage(icon, x, cy - iconSize / 2, iconSize, iconSize);
        } else {
          // アイコンが無いジョブ(クラフター・ギャザラー)は頭文字で代用
          ctx.textAlign = "center";
          ctx.fillStyle = dim ?? tone ?? col(l.iconColor);
          ctx.fillText(j.name[0], x + iconSize / 2, cy);
        }
      }
      ctx.fillStyle = dim ?? tone ?? col(l.levelColor);
      if (l.display === "icon") {
        ctx.textAlign = "left";
        ctx.fillText(j.level, x + nameX, cy);
        return;
      }
      ctx.textAlign = "right";
      ctx.fillText(j.level, x + l.cellW - l.size * 0.6, cy);
      ctx.textAlign = "left";
      ctx.fillStyle = dim ?? tone ?? col(l.color);
      ctx.fillText(j.name, x + nameX, cy, nameMax);
    });
    const rows = Math.min(maxRows, Math.max(1, Math.ceil(list.length / cols)));
    return { x: l.x, y: l.y, w: jobWidth(l), h: l.h > 0 ? l.h : (rows - 1) * rowH + lineH };
  },

  activities(l) {
    return drawTags(l, activityList(), "やっているコンテンツ");
  },

  playtime(l) {
    const d = project.data;
    const mode = l.timeDisplay ?? "icon";
    // 朝〜深夜は、出し方に合わせてアイコン・アイコン+文字・文字にする(いる頻度はいつも文字)
    const times = PLAY_TIMES.filter((t) => d.playTimes?.includes(t)).map((t) => ({ text: mode === "icon" ? "" : t, icon: mode === "text" ? null : t }));
    return drawTags(l, [...(d.playStyle ? [d.playStyle] : []), ...times], "時間帯");
  },

  mainjob(l) {
    const d = project.data;
    if (!d.mainJob) return null; // メインジョブを選んでいないときは出さない(キャラタブで選ぶと出る)
    const size = l.size, iconSize = size * 1.4, gap = size * 0.35;
    const label = l.showName === false ? "" : d.mainJob;
    const lv = l.showLevel === false ? "" : d.levels.find((j) => j.name === d.mainJob)?.level ?? "";
    const lvText = /^\d+$/.test(lv) ? "Lv" + lv : "";
    ctx.font = fontString(l);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ensureFont(ctx.font, label + lvText);
    const icon = jobIcon(d.mainJob, col(l.iconColor));
    // 先に幅を測って、背景の板を敷く
    const parts = [icon && iconSize, label && ctx.measureText(label).width, lvText && ctx.measureText(lvText).width].filter(Boolean);
    const w = Math.max(size, parts.reduce((a, b) => a + b, 0) + gap * (parts.length - 1));
    drawElementPanel(l, l.x, l.y, w, iconSize);
    if (l.shadow) setShadow(size);
    const cy = l.y + iconSize / 2;
    let x = l.x;
    if (icon) {
      ctx.drawImage(icon, x, l.y, iconSize, iconSize);
      x += iconSize + gap;
    }
    if (label) {
      ctx.fillStyle = col(l.color);
      ctx.fillText(label, x, cy);
      x += ctx.measureText(label).width + gap;
    }
    if (lvText) {
      ctx.fillStyle = col(l.levelColor);
      ctx.fillText(lvText, x, cy);
    }
    return { x: l.x, y: l.y, w, h: iconSize };
  },
};

// タグ(角の丸いラベル)を、枠の幅に入る分だけ並べて、入らなければ折り返す。高さを決めたときは、入らない行は出さない。
//   tags が空のときは、編集中だけ placeholder を薄く出す(保存する画像には出ない)
//   タグは文字か、{ text, icon }(icon は TIME_ICONS の名前。text が空ならアイコンだけの丸いタグ)
function drawTags(l, tags, placeholder) {
  const size = l.size, padX = size * 0.7, chipH = size * 1.8, gap = size * 0.45;
  const iconS = size * 1.15, iconGap = size * 0.3;
  const w = l.w > 0 ? l.w : 800;
  ctx.font = fontString(l);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const empty = !tags.length;
  if (empty) {
    tags = exporting ? [] : [placeholder];
    ctx.globalAlpha *= 0.45;
  }
  tags = tags.map((t) => (typeof t === "string" ? { text: t, icon: null } : t));
  ensureFont(ctx.font, tags.map((t) => t.text).join(""));
  const maxRows = l.h > 0 ? Math.max(1, Math.floor((l.h + gap) / (chipH + gap))) : Infinity;
  const chip = col(l.chipColor);
  // 並べ方(どのタグを、どこに)
  const placed = [];
  let x = 0, row = 0;
  for (const tag of tags) {
    const tw = tag.text ? ctx.measureText(tag.text).width : 0;
    const cw = !tag.icon ? tw + padX * 2 : !tag.text ? chipH : padX * 0.8 + iconS + iconGap + tw + padX;
    if (x > 0 && x + cw > w) {
      x = 0;
      row++;
    }
    if (row >= maxRows) break;
    placed.push({ tag, tw, cw, cx: l.x + x, cy: l.y + row * (chipH + gap) });
    x += cw + gap;
  }
  const rows = placed.length ? Math.round((placed.at(-1).cy - l.y) / (chipH + gap)) + 1 : 1;
  const h = l.h > 0 ? l.h : rows * chipH + (rows - 1) * gap;
  if (!empty) drawElementPanel(l, l.x, l.y, w, h);
  const fill = l.chipFill ?? "soft";
  for (const { tag, tw, cw, cx, cy } of placed) {
    shapePath(l.chipFrame, cx, cy, cw, chipH, chipH / 2);
    let text = col(l.color);
    if (fill === "fill") {
      ctx.fillStyle = chip;
      ctx.fill();
      text = lightness(chip) > 0.6 ? "#1a1a1a" : "#ffffff"; // 塗りの上で読める色
    } else if (fill === "soft") {
      ctx.fillStyle = rgba(chip, 0.22);
      ctx.fill();
    }
    if (l.chipLine > 0) {
      ctx.strokeStyle = col(l.chipLineColor ?? l.chipColor);
      ctx.lineWidth = l.chipLine;
      ctx.stroke();
    }
    const mid = cy + chipH / 2;
    if (tag.icon) {
      const ix = tag.text ? cx + padX * 0.8 : cx + (cw - iconS) / 2;
      drawTimeIcon(tag.icon, ix, mid - iconS / 2, iconS, text);
    }
    if (tag.text) {
      ctx.fillStyle = text;
      const tx = tag.icon ? cx + padX * 0.8 + iconS + iconGap + tw / 2 : cx + cw / 2;
      ctx.fillText(tag.text, tx, mid + size * 0.04);
    }
  }
  return { x: l.x, y: l.y, w, h };
}

// 時間帯のアイコン(24×24 のマスに描いた形。fill は塗り、stroke は線)
const TIME_ICONS = {
  朝: { stroke: "M2 19H22M6 19A6 6 0 0 1 18 19M12 4V7.5M4.6 9.6L6.9 11.9M19.4 9.6L17.1 11.9M9 22H15" },
  昼: { fill: "M8 12A4 4 0 1 0 16 12A4 4 0 1 0 8 12Z", stroke: "M12 2V4.5M12 19.5V22M2 12H4.5M19.5 12H22M4.9 4.9L6.7 6.7M17.3 17.3L19.1 19.1M4.9 19.1L6.7 17.3M17.3 6.7L19.1 4.9" },
  夕方: { stroke: "M2 14H22M7.5 14A4.5 4.5 0 0 1 16.5 14M12 4.5V7M5.5 8L7.2 9.7M18.5 8L16.8 9.7M12 16.5V22M9.2 19.4L12 22L14.8 19.4" },
  夜: { fill: "M19.5 15A8.5 8.5 0 1 1 9 3.5A6.8 6.8 0 0 0 19.5 15Z" },
  深夜: { fill: "M15.5 17A7 7 0 1 1 6.5 7.5A5.6 5.6 0 0 0 15.5 17ZM18 2L18.9 4.6L21.5 5.5L18.9 6.4L18 9L17.1 6.4L14.5 5.5L17.1 4.6ZM21 10.5L21.5 11.9L22.9 12.4L21.5 12.9L21 14.3L20.5 12.9L19.1 12.4L20.5 11.9Z" },
};
const timeIconPaths = new Map();
function drawTimeIcon(name, x, y, s, color) {
  const def = TIME_ICONS[name];
  if (!def) return;
  let p = timeIconPaths.get(name);
  if (!p) timeIconPaths.set(name, (p = { fill: def.fill && new Path2D(def.fill), stroke: def.stroke && new Path2D(def.stroke) }));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 24, s / 24);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = ctx.lineJoin = "round";
  if (p.fill) ctx.fill(p.fill);
  if (p.stroke) ctx.stroke(p.stroke);
  ctx.restore();
}

// ジョブ一覧は、枠の幅に入る分だけ横に並べて、入らなければ折り返す(列の数は決めない)。
//   幅が未設定の古いデータは、これまでの列数ぶんの幅
function jobWidth(l) {
  return l.w > 0 ? l.w : l.cols * l.cellW;
}
function jobCols(l, itemW = l.cellW) {
  return Math.max(1, Math.floor((jobWidth(l) - itemW) / l.cellW) + 1);
}

// 「なし」「標準」の見本
const FRAME_FIRST_PREVIEW = {
  none: '<rect x="4" y="4" width="52" height="32" rx="6" fill="none" stroke-dasharray="4 4"/>',
  pill: '<rect x="4" y="11" width="52" height="18" rx="9"/>',
};
// 詳細の「枠の形」の欄:見本のアイコンを横に並べて、スクロールして選ぶ(first は「なし」「標準」など、先頭に足す選択肢)。
//   いちばん右は「＋ 作る」(枠エディタ)。オリジナル枠を選んでいるときは、その枠の編集・削除
function framePicker(l, key, label, first = []) {
  const wrap = document.createElement("div");
  wrap.className = "field field--wide";
  wrap.append(Object.assign(document.createElement("span"), { textContent: label }));
  const list = document.createElement("div");
  list.className = "frame-pick";
  const current = l[key];
  const tile = (id, name, preview, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "frame-btn";
    b.title = name;
    b.setAttribute("aria-pressed", String(current === id));
    b.append(preview, Object.assign(document.createElement("span"), { textContent: name }));
    b.addEventListener("click", onClick ?? (() => {
      l[key] = id;
      changed();
      renderProps();
    }));
    list.append(b);
    return b;
  };
  const svg = (inner) => {
    const span = document.createElement("span");
    span.innerHTML = `<svg viewBox="0 0 60 40" aria-hidden="true">${inner}</svg>`;
    return span.firstChild;
  };
  for (const [id, name] of first) tile(id, name, svg(FRAME_FIRST_PREVIEW[id] ?? ""));
  for (const [id, name] of FRAMES) tile(id, name, svg(FRAME_PREVIEW[id]));
  for (const def of loadCustomFrames()) {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 80;
    c.className = "frame-canvas";
    drawFramePreview(c, def, col, { pad: 8, radius: 10, alpha: 0.85, borderWidth: 2 });
    tile(CUSTOM_PREFIX + def.id, def.name || "オリジナル枠", c);
  }
  tile("", "作る", svg('<path d="M30 10V30M20 20H40" fill="none"/>'), () => openFrameEditor(null, { id: l.id, key }));
  wrap.append(list);
  // 選んでいる見本が見える所まで、横にスクロールしておく
  requestAnimationFrame(() => list.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }));

  const def = findCustomFrame(current);
  if (def) {
    const row = document.createElement("div");
    row.className = "actions";
    row.append(
      button("この枠を編集", () => openFrameEditor(def.id, { id: l.id, key })),
      button("この枠を削除", () => {
        if (!confirm(`「${def.name || "オリジナル枠"}」を削除します。よろしいですか?`)) return;
        saveCustomFrames(loadCustomFrames().filter((f) => f.id !== def.id));
        // この枠を使っていた所は、ふつうの形に戻す
        const gone = CUSTOM_PREFIX + def.id;
        for (const x of project.layers) {
          if (x.frame === gone) x.frame = "round";
          if (x.panelFrame === gone) x.panelFrame = "round";
          if (x.chipFrame === gone) x.chipFrame = "pill";
          if (x.boardFrame === gone) x.boardFrame = "pill";
        }
        changed();
        renderProps();
        renderAddTiles();
      }, "btn btn--small btn--danger"),
    );
    wrap.append(row);
  }
  return wrap;
}
// 小さい部品(タグ・ジョブの板)の形の道すじ。"pill" は今までどおりの角丸、ほかは枠の形
function shapePath(frame, x, y, w, h, r) {
  if (!frame || frame === "pill") return roundRectPath(x, y, w, h, r);
  framePath(ctx, frame, x, y, w, h, Math.min(r, h / 4));
}
// ジョブ一覧・時間帯・コンテンツ・メインジョブのうしろに敷く「背景の板」(大きさは中身 + すき間)
function drawElementPanel(l, x, y, w, h) {
  if (!l.panelFrame || l.panelFrame === "none") return;
  const pad = l.size * 0.6;
  ctx.save();
  clearShadow();
  drawFramePanel(ctx, l.panelFrame, { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2, radius: l.size * 0.6, borderColor: l.panelBorderColor ?? "@accent", borderWidth: l.panelBorderWidth ?? 2 }, col, col(l.panelColor ?? "@panel"), l.panelOpacity ?? 0.4);
  ctx.restore();
}

function lightness(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  return m ? (parseInt(m[1], 16) * 0.299 + parseInt(m[2], 16) * 0.587 + parseInt(m[3], 16) * 0.114) / 255 : 0.5;
}

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
  // 選択枠はオレンジの点線。4つの角と4つの辺の真ん中に、白ふちのまるいつまみ(どの辺・角をドラッグしても大きさが変わる)
  ctx.save();
  ctx.strokeStyle = "#ff7a2e";
  ctx.lineWidth = 2.5 / s;
  ctx.setLineDash([7 / s, 5 / s]);
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  if (isFolder(selected())) {
    ctx.restore();
    return;
  }
  const hs = HANDLE / s;
  ctx.setLineDash([]);
  const knob = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffa45c";
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
//   つかめる帯は、枠の外側に EDGE_GRAB、内側は狭く(枠の大きさの 15% まで)。小さい要素でも、中を押せば動かせるように
function edgeAt(p, b) {
  if (!b) return null;
  const t = EDGE_GRAB / viewScale();
  if (p.x < b.x - t || p.x > b.x + b.w + t || p.y < b.y - t || p.y > b.y + b.h + t) return null;
  const ix = Math.min(t, b.w * 0.15), iy = Math.min(t, b.h * 0.15); // 内側の帯
  const n = p.y <= b.y + iy, s = p.y >= b.y + b.h - iy;
  const w = p.x <= b.x + ix, e = p.x >= b.x + b.w - ix;
  const ns = n && s ? (p.y - b.y < b.y + b.h - p.y ? "n" : "s") : n ? "n" : s ? "s" : "";
  const ew = w && e ? (p.x - b.x < b.x + b.w - p.x ? "w" : "e") : w ? "w" : e ? "e" : "";
  return ns + ew || null;
}

// つかめる辺は、選んでいる要素のものだけ(選んでいない要素は、どこを押しても選んで動かす)
function edgeTarget(p) {
  const sel = selected();
  const se = sel && !isFolder(sel) && !isHidden(sel) && edgeAt(p, boundsById.get(sel.id));
  return se ? { layer: sel, edge: se } : null;
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
  return [...project.layers].reverse().find((l) => !isFolder(l) && !isHidden(l) && inside(p, boundsById.get(l.id))) ?? null;
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
// Shift を押している間も、表示を動かせる印(つかむ形のカーソル)。要素の大きさを変えている途中の Shift(縦横比を保つ)はそのまま
const shiftPan = (e) => $("artboard").classList.toggle("shift-pan", e.shiftKey && !drag);
document.addEventListener("keydown", shiftPan);
document.addEventListener("keyup", shiftPan);
window.addEventListener("blur", () => $("artboard").classList.remove("shift-pan"));

canvas.addEventListener("pointerdown", (e) => {
  const p = toCard(e);
  // スペースを押しながら・ホイールボタン・Shift を押しながら左クリック → 表示を動かす(要素は選ばない・動かさない)
  if (spaceHeld || e.button === 1 || (e.button === 0 && e.shiftKey)) {
    e.preventDefault(); // ホイールボタンの自動スクロールを出さない
    startViewDrag(e);
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (pickHueFor) {
    pickHue(p); // 色を拾うモードの間は、選択や移動をしない
    return;
  }
  const sel = selected();
  if (isFolder(sel) && inside(p, boundsById.get(sel.id))) {
    drag = { mode: "folder", start: p, layer: sel, kids: contentsOf(sel).map((k) => ({ l: k, x: k.x, y: k.y })) };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    return;
  }
  const grab = edgeTarget(p);
  if (grab) {
    select(grab.layer.id);
    openTab("layers");
    drag = { mode: "resize", edge: grab.edge, start: p, layer: grab.layer, orig: { ...grab.layer }, b: { ...boundsById.get(grab.layer.id) } };
  } else {
    const hit = hitTest(p);
    if (hit) select(hit.id); // 何もない所は、押した時点では選択を外さない(startViewDrag。クリックで離したときだけ外す)
    if (hit) openTab("layers");
    // Alt+ドラッグで画像を枠の中で動かす
    const mode = hit?.type === "image" && e.altKey ? "pan" : "move";
    if (hit) drag = { mode, start: p, layer: hit, orig: { ...hit }, b: { ...boundsById.get(hit.id) } };
    else startViewDrag(e, true);
  }
  if (drag || viewDrag) canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const p = toCard(e);
  if (!drag) {
    const grab = !viewDrag && edgeTarget(p);
    const sel = selected();
    const onFolder = isFolder(sel) && inside(p, boundsById.get(sel.id));
    canvas.style.cursor = viewDrag ? "grabbing" : onFolder ? "move" : grab ? EDGE_CURSOR[grab.edge] : hitTest(p) ? "move" : "grab";
    return;
  }
  const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (drag.mode === "folder") {
    for (const k of drag.kids) {
      k.l.x = Math.round(k.x + dx);
      k.l.y = Math.round(k.y + dy);
    }
  } else if (drag.mode === "move") {
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
//   テキスト:箱の幅・高さ / メインジョブ:文字の大きさを比率で変える
function resize({ layer: l, orig: o, b, edge }, dx, dy, keepRatio) {
  const W = edge.includes("e") ? b.w + dx : edge.includes("w") ? b.w - dx : b.w;
  const H = edge.includes("s") ? b.h + dy : edge.includes("n") ? b.h - dy : b.h;
  // テキストは箱の大きさを変える(文字の大きさは変えない。自動改行なら折り返す位置が変わる)
  //   左右の辺だけなら幅だけ、上下の辺なら高さも決める
  if (l.type === "text") {
    const w = Math.max(10, Math.round(W)), h = Math.max(10, Math.round(H));
    l.w = /[ew]/.test(edge) || !(o.w > 0) ? w : o.w;
    if (/[ns]/.test(edge)) l.h = h;
    l.x = edge.includes("w") ? Math.round(b.x + b.w - l.w) : Math.round(b.x); // 箱になったので x は左端
    l.y = edge.includes("n") ? Math.round(b.y + b.h - (l.h || b.h)) : o.y;
    return;
  }
  if (l.type === "rect" || l.type === "image" || l.type === "symbol" || l.type === "jobicon") {
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
  // ジョブ一覧・コンテンツのタグは、枠の幅・高さを自由に変える(文字の大きさは変えない。並ぶ数は枠に合わせて変わる)
  if (l.type === "jobs" || l.type === "activities" || l.type === "playtime") {
    let w = Math.max(20, W), h = Math.max(10, H);
    if (keepRatio && edge.length === 2) {
      const f = Math.max(w / b.w, h / b.h);
      w = b.w * f;
      h = b.h * f;
    }
    l.w = Math.round(w);
    l.h = Math.round(h);
    l.x = edge.includes("w") ? Math.round(o.x + b.w - l.w) : o.x;
    l.y = edge.includes("n") ? Math.round(o.y + b.h - l.h) : o.y;
    return;
  }
  // 左右の辺(と角)は幅の比率、上下の辺は高さの比率
  const f = Math.max(0.05, /[ew]/.test(edge) ? W / b.w : H / b.h);
  l.size = Math.max(4, Math.round(o.size * f));
  const k = l.size / o.size; // 丸めたあとの実際の比率
  const bw = b.w * k, bh = b.h * k;
  l.x = Math.round(edge.includes("w") ? b.x + b.w - bw : b.x);
  l.y = Math.round(edge.includes("n") ? b.y + b.h - bh : b.y);
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
  // 中身が空の仮画像(土台のスクショ枠)がまだあるときは、どこにドロップしても、その仮画像に入れる(初回だけ)。
  // 画像がすでに設定されているときは、今までどおり(画像の上なら置き換え、それ以外は新しい画像として追加)
  const placeholder = project.layers.find((x) => x.type === "image" && !x.src);
  if (hit?.type === "image") {
    setImage(hit, src);
  } else if (placeholder) {
    setImage(placeholder, src);
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
    deleteSelected();
    return;
  }
  const step = e.shiftKey ? 10 : 1;
  const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!move) return;
  e.preventDefault();
  if (isFolder(l)) moveFolderBy(l, move[0], move[1]);
  else {
    l.x += move[0];
    l.y += move[1];
  }
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
    text: { x: Math.round(w / 2 - 200), y: Math.round(h / 2 - 30), w: 400, text: "テキスト" },
    image: { x: Math.round(w / 2 - 200), y: Math.round(h / 2 - 270) },
    rect: { x: Math.round(w / 2 - 200), y: Math.round(h / 2 - 120) },
    jobs: { x: Math.round(w / 2 - 470), y: Math.round(h / 2 - 120) },
    mainjob: { x: Math.round(w / 2 - 150), y: Math.round(h / 2 - 25), size: 30 },
    activities: { x: Math.round(w / 2 - 400), y: Math.round(h / 2 - 60) },
    playtime: { x: Math.round(w / 2 - 400), y: Math.round(h / 2 - 60) },
    symbol: { x: Math.round(w / 2 - sw / 2), y: Math.round(h / 2 - sh / 2), w: sw, h: sh, symbol: symbolId },
    jobicon: { x: Math.round(w / 2 - 80), y: Math.round(h / 2 - 80), job: symbolId ?? "ナイト" },
  }[type];
  const l = makeLayer(type, props);
  project.layers.push(l);
  changed();
  select(l.id);
}

// 「追加」の、1つあれば十分な要素のボタンを、カードに出ているかどうかの見た目にする
function syncSingleTiles() {
  for (const b of document.querySelectorAll("#addTiles [data-single]")) {
    const l = project.layers.find((x) => x.type === b.dataset.single);
    const on = !!l && !isHidden(l);
    b.setAttribute("aria-pressed", String(on));
    b.title = on ? "押すと隠す" : "押すと出す";
  }
}

// 1つあれば十分な要素(ジョブ一覧など):カードに無ければ置き、あれば表示・非表示を切り替える
function toggleSingle(type) {
  const l = project.layers.find((x) => x.type === type);
  if (!l) return addLayer(type);
  // フォルダーごと隠れているときは、フォルダーも出す
  const shown = !isHidden(l);
  l.hidden = shown;
  if (!shown) for (const f of ancestorsOf(l)) f.hidden = false;
  changed();
  if (!shown) select(l.id);
  else if (selectedId === l.id) renderProps();
}

// 選んでいるものを消す(「詳細」の見出しのごみ箱・Delete キー)。フォルダーは中身ごと(確かめてから)
function deleteSelected() {
  const l = selected();
  if (!l) return;
  if (!isFolder(l)) removeLayer(l.id);
  else if (confirm(`「${l.name}」を中身ごと削除しますか?`)) removeFolder(l, true);
}
$("deleteSelected").addEventListener("click", deleteSelected);

function removeLayer(id) {
  const f = project.layers.find((l) => l.id === id);
  if (isFolder(f)) return removeFolder(f, true);
  project.layers = project.layers.filter((l) => l.id !== id);
  if (selectedId === id) selectedId = null;
  changed();
  renderProps();
}

function changed() {
  assignShapeNumbers(project.layers);
  requestDraw();
  renderLayers();
  syncSingleTiles();
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

// テキストの揃え:左寄せ・中央寄せ・右寄せのボタン
//   箱の幅が 0(文字に合わせた幅)のときは x が揃えの基準点なので、文字が動かないように x も合わせる
function alignField(l) {
  const wrap = document.createElement("div");
  wrap.className = "field field--wide";
  wrap.append(Object.assign(document.createElement("span"), { textContent: "揃え" }));
  const row = document.createElement("div");
  row.className = "align-pick";
  const ICON = {
    left: "M3 5H21M3 10H14M3 15H21M3 20H14",
    center: "M3 5H21M7 10H17M3 15H21M7 20H17",
    right: "M3 5H21M10 10H21M3 15H21M10 20H21",
  };
  for (const [value, name] of [["left", "左寄せ"], ["center", "中央寄せ"], ["right", "右寄せ"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "align-btn";
    b.title = name;
    b.setAttribute("aria-pressed", String(l.align === value));
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[value]}"/></svg><span>${name}</span>`;
    b.addEventListener("click", () => {
      const bx = boundsById.get(l.id);
      if (!(l.w > 0) && bx) l.x = Math.round(bx.x + (value === "center" ? bx.w / 2 : value === "right" ? bx.w : 0));
      l.align = value;
      changed();
      renderProps();
    });
    row.append(b);
  }
  wrap.append(row);
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

// 名前のない図形に番号(no)を振る。追加された順に 1, 2, 3…。一度付いた番号は、並べ替えても消しても変わらない
function assignShapeNumbers(layers) {
  let max = Math.max(0, ...layers.map((l) => l.no ?? 0));
  for (const l of layers) if (l.type === "rect" && !l.name && l.no == null) l.no = ++max;
}

function layerLabel(l) {
  if (!isFolder(l) && l.name) return l.name; // 名前が付いているものは、その名前(デザインの初めの素材など)
  if (isFolder(l)) return `${l.name}(${childrenOf(l).length})`;
  if (l.type === "text") return resolveText(l.text).replace(/\n/g, " ").slice(0, 30) || "(空)";
  if (l.type === "image") return l.src ? "スクショ" : "(未設定)";
  if (l.type === "rect") return `枠 ${l.no ?? ""}`.trim();
  if (l.type === "symbol") return findSymbol(l.symbol)?.name || "(消されたシンボル)";
  if (l.type === "jobicon") return l.job;
  if (l.type === "activities") return "やっているコンテンツ";
  if (l.type === "playtime") return "時間帯";
  if (l.type === "mainjob") return project.data.mainJob ? "メインジョブ" : "メインジョブ(未選択)";
  return { battle: "戦闘職", craft: "クラフター・ギャザラー", all: "すべて" }[l.filter];
}

function renderLayers() {
  const ul = $("layers");
  ul.replaceChildren();
  // 上にあるほど前面。フォルダーの中身は、フォルダーの行のすぐ下に字下げして並ぶ(閉じていれば出さない)
  for (const l of [...project.layers].reverse()) {
    const f = folderOf(l);
    const outer = ancestorsOf(l);
    if (outer.some((g) => !g.open)) continue;
    const li = document.createElement("li");
    if (outer.length > 1) li.style.marginLeft = `${22 * outer.length}px`; // 中のフォルダーの中身は、もっと字下げ
    li.dataset.id = l.id;
    li.className = [l.id === selectedId && "selected", isHidden(l) && "hidden", f && "in-folder", isFolder(l) && "folder-row"].filter(Boolean).join(" ");
    if (isFolder(l)) {
      const toggle = document.createElement("button");
      toggle.className = "folder-toggle";
      toggle.textContent = l.open ? "▾" : "▸";
      toggle.title = l.open ? "閉じる" : "開く";
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        l.open = !l.open;
        renderLayers();
        saveSoon();
      });
      li.append(toggle);
    }
    if (f) {
      // フォルダーの中身:├ と └ の線で、フォルダーにぶら下がっているように見せる(一覧のいちばん下の中身が └)
      const tree = document.createElement("span");
      tree.className = "layer-tree";
      tree.textContent = childrenOf(f)[0] === l ? "└" : "├";
      li.append(tree);
    }
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
  let target = null; // 差し込む位置:{ below: この行の要素のすぐ下(なければいちばん上) }
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
    target = { below: k >= 0 ? rows[k].dataset.id : null };
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
    if (layerDragged && target !== null) dropLayer(layer, target.below);
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

// フォルダーを選んでいるときの調整欄
function renderFolderProps(box, f) {
  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(button("フォルダーを解除", () => removeFolder(f, false)));
  box.append(actions);
  box.append(field(f, "name", "フォルダーの名前", "text", { wide: true }));

  // 位置(中身をぜんぶ囲む枠の左上)。数字を変えると、中身がまとめて動く
  const b = boundsById.get(f.id);
  if (b) {
    const pos = { x: Math.round(b.x), y: Math.round(b.y) };
    const onPos = () => {
      moveFolderBy(f, pos.x - Math.round(b.x), pos.y - Math.round(b.y));
      b.x = pos.x;
      b.y = pos.y;
      changed();
    };
    box.append(field(pos, "x", "X", "number", {}, onPos), field(pos, "y", "Y", "number", {}, onPos));
  }
  box.append(field(f, "opacity", "不透明度(中身ぜんぶ)", "range", { min: 0, max: 1, step: 0.05 }));
}

// 一覧でドラッグして離したときの並べ替え。belowId の行のすぐ下(= その要素のすぐ後ろ)に入れる。belowId がなければいちばん上(前面)
//   ・開いているフォルダーの行の下 → そのフォルダーのいちばん前に入る
//   ・閉じているフォルダーの行の下 → フォルダーには入らず、フォルダーのまるごと後ろに置く
//   ・フォルダーの中の行の下 → そのフォルダーに入る
//   ・フォルダーに入っていない行の下 → フォルダーから出る
//   フォルダーを動かすときは中身ごと。フォルダーも、ほかのフォルダーの中に入れられる(自分の中には入れない)
function dropLayer(layer, belowId) {
  const moving = isFolder(layer) ? [...subtreeOf(layer), layer] : [layer];
  if (belowId && moving.some((m) => m.id === belowId)) return; // 自分のフォルダーの中身の上で離したときは、そのまま
  const rest = project.layers.filter((x) => !moving.includes(x));
  const below = belowId ? rest.find((x) => x.id === belowId) : null;
  const behindFolder = (g) => rest.indexOf(subtreeOf(g, rest)[0] ?? g); // フォルダーのまるごと後ろの位置
  let index, parent = null;
  if (!below) index = rest.length;
  else if (isFolder(below) && below.open) {
    parent = below.id;
    index = rest.indexOf(below);
  } else if (isFolder(below)) {
    parent = below.folder ?? null;
    index = behindFolder(below);
  } else {
    parent = below.folder ?? null;
    index = rest.indexOf(below);
  }
  if (parent) layer.folder = parent;
  else delete layer.folder;
  rest.splice(index, 0, ...moving);
  project.layers = tidyFolders(rest);
  changed();
  if (layer.id === selectedId) renderProps();
}

// 「エフェクト」タブ:選んでいる画像のエフェクトを調整する(画像以外を選んでいるときは案内だけ)
function renderFx() {
  const box = $("fxProps");
  box.replaceChildren();
  // 画像を選んでいないときは、メインのスクショ(いちばん背面側の画像)を調整する
  const sel = selected();
  const l = sel?.type === "image" ? sel : project.layers.find((x) => x.type === "image");
  if (l) return renderFxFields(box, l);
  box.append(Object.assign(document.createElement("p"), { className: "note", textContent: "スクショがまだありません。" }));
}

function renderProps() {
  renderFx();
  const box = $("props");
  box.replaceChildren();
  const l = selected();
  $("deleteSelected").hidden = !l;
  if (!l) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = "カード上の要素をクリックすると、ここで編集できます。";
    box.append(p);
    return;
  }
  if (isFolder(l)) return renderFolderProps(box, l);

  for (const [key, label, type, opt] of FIELDS[l.type]) {
    if (type === "frame") {
      box.append(framePicker(l, key, label, opt?.first));
      continue;
    }
    if (type === "align") {
      box.append(alignField(l));
      continue;
    }
    if (l.type === "jobs" && !l.w) l.w = jobWidth(l); // 古いデータは、今の幅を入れる
    // 表示形式を変えたら列の幅もそれに合う幅にする
    const onChange = key === "display" ? () => {
      l.cellW = Math.round(l.size * { icon: 5.5, iconName: 10, name: 9 }[l.display]);
      changed();
      renderProps();
    } : changed;
    const shown = l.type === "rect" && key === "borderWidth" && findCustomFrame(l.frame) ? "枠線の太さ(0 = 枠エディタの太さ)" : label;
    const f = field(l, key, shown, type, opt, onChange);
    box.append(f);
    if (key === "text") box.append(varChips(f.querySelector("textarea"), l));
  }
  if (l.type === "activities" || l.type === "playtime" || l.type === "mainjob") box.append(button("キャラタブで選ぶ →", () => openTab("chara"), "btn btn--small btn--primary"));
  if (l.type === "image") {
    const row = document.createElement("div");
    row.className = "actions";
    row.append(uploadButton("スクショをアップロード", (src) => setImage(l, src)));
    box.append(row);
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "画像の上でホイール → ズーム / Alt+ドラッグ → 枠の中で位置調整";
    box.append(note);
    box.append(button("エフェクトを調整する →", () => openTab("fx"), "btn btn--small btn--primary"));
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

// 「やっているコンテンツ」のチェック(キャラタブ)。チェックしたものが、カードの「コンテンツ」の要素に並ぶ
function renderActivities() {
  const box = $("activityForm");
  box.replaceChildren();
  const sel = () => (project.data.activities ??= []);
  const toggle = (tag, on) => {
    project.data.activities = on ? [...sel().filter((t) => t !== tag), tag] : sel().filter((t) => t !== tag);
    changed();
    if (!on && !ACTIVITY_KNOWN.includes(tag)) renderActivities(); // 自分で足したタグは、外すと消える
  };
  const tagBox = (tag) => {
    const label = document.createElement("label");
    label.className = "act-tag";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = sel().includes(tag);
    cb.addEventListener("change", () => toggle(tag, cb.checked));
    label.append(cb, Object.assign(document.createElement("span"), { textContent: tag }));
    return label;
  };
  const group = (title, tags) => {
    const g = document.createElement("div");
    g.className = "act-group";
    g.append(Object.assign(document.createElement("h3"), { textContent: title }));
    const row = document.createElement("div");
    row.className = "act-tags";
    row.append(...tags.map(tagBox));
    g.append(row);
    box.append(g);
  };
  for (const [title, tags] of ACTIVITY_GROUPS) group(title, tags);
  const custom = sel().filter((t) => !ACTIVITY_KNOWN.includes(t));
  if (custom.length) group("自分で足した", custom);
  const form = document.createElement("form");
  form.className = "row";
  const input = Object.assign(document.createElement("input"), { type: "text", placeholder: "ほかのコンテンツを足す", maxLength: 20 });
  form.append(input, Object.assign(document.createElement("button"), { type: "submit", className: "btn btn--small", textContent: "足す" }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const tag = input.value.trim();
    if (!tag) return;
    if (!sel().includes(tag)) project.data.activities = [...sel(), tag];
    changed();
    renderActivities();
  });
  box.append(form);
}

// キャラタブで使う、チェックボックス付きのタグと、見出し付きのまとまり
function checkTag(name, checked, onChange) {
  const label = document.createElement("label");
  label.className = "act-tag";
  const cb = Object.assign(document.createElement("input"), { type: "checkbox", checked });
  cb.addEventListener("change", () => onChange(cb.checked));
  label.append(cb, Object.assign(document.createElement("span"), { textContent: name }));
  return label;
}
function checkGroup(box, title, nodes) {
  const g = document.createElement("div");
  g.className = "act-group";
  g.append(Object.assign(document.createElement("h3"), { textContent: title }));
  const row = document.createElement("div");
  row.className = "act-tags";
  row.append(...nodes);
  g.append(row);
  box.append(g);
}

// メインジョブ(1つ)・サブジョブ(いくつでも)。メインはジョブ一覧で強調、サブは色違いになる
function renderJobPicks() {
  const box = $("jobPickForm");
  box.replaceChildren();
  const d = project.data;
  d.subJobs ??= [];
  const names = d.levels.map((j) => j.name).filter((n) => !CRAFT_GATHER.has(n) && !SPECIAL.has(n));
  const main = document.createElement("select");
  main.add(new Option("(選ばない)", ""));
  for (const n of names) main.add(new Option(n, n));
  main.value = names.includes(d.mainJob) ? d.mainJob : "";
  main.addEventListener("change", () => {
    d.mainJob = main.value;
    d.subJobs = d.subJobs.filter((n) => n !== d.mainJob); // メインにしたジョブは、サブから外す
    changed();
    renderJobPicks();
  });
  const mainField = document.createElement("label");
  mainField.className = "field";
  mainField.append(Object.assign(document.createElement("span"), { textContent: "メインジョブ" }), main);
  box.append(mainField);
  checkGroup(box, "サブジョブ", names.filter((n) => n !== d.mainJob).map((n) => checkTag(n, d.subJobs.includes(n), (on) => {
    d.subJobs = on ? [...d.subJobs, n] : d.subJobs.filter((x) => x !== n);
    changed();
  })));
}

// 時間帯:エオ住/不定期(どちらか1つ。もう一度押すと外れる)と、朝〜深夜(いくつでも)
function renderPlayTimes() {
  const box = $("playTimeForm");
  box.replaceChildren();
  const d = project.data;
  d.playTimes ??= [];
  checkGroup(box, "いる頻度", PLAY_STYLES.map((t) => checkTag(t, d.playStyle === t, (on) => {
    d.playStyle = on ? t : "";
    changed();
    renderPlayTimes();
  })));
  checkGroup(box, "いる時間帯", PLAY_TIMES.map((t) => checkTag(t, d.playTimes.includes(t), (on) => {
    d.playTimes = on ? [...d.playTimes, t] : d.playTimes.filter((x) => x !== t);
    changed();
  })));
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
  renderJobPicks();
  renderPlayTimes();
  renderActivities();
  renderLayers();
  renderProps();
  renderCard();
  renderSwatches();
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
  const p = normalize({ ...structuredClone(t.data), data: project.data, palette: project.palette, paletteId: project.paletteId });
  const newIds = new Map(p.layers.map((l) => [l.id, uid()]));
  p.layers.forEach((l) => {
    l.id = newIds.get(l.id);
    if (l.folder) l.folder = newIds.get(l.folder);
  });
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
  renderProps(); // 詳細の「枠の形」の見本は、配色の色で描いている
  renderAddTiles(); // シンボルの見本も
  renderProps();
  renderCard();
}

// 枠の形の一覧。最初からある枠は SVG の見本、オリジナル枠は canvas に描いた見本
// このカードで使っているオリジナル枠(書き出しに入れる)
function usedCustomFrames() {
  const ids = new Set(project.layers.flatMap((l) => [l.frame, l.panelFrame, l.chipFrame, l.boardFrame]));
  const list = [...ids].map(findCustomFrame).filter(Boolean);
  return list.length ? list : undefined;
}

// 要素を追加の一覧。「枠の形」と同じように、見本付きのボタンを並べる(押すとカードの真ん中に追加)
const ADD_PREVIEW = {
  text: '<path d="M16 9H44M30 9V33" fill="none"/>',
  image: '<rect x="7" y="6" width="46" height="28" rx="4"/><path d="M11 31L24 18L32 26L38 20L49 31" fill="none"/><circle cx="41" cy="13" r="3"/>',
  rect: '<rect x="7" y="8" width="46" height="24" rx="7"/>',
  playtime: '<circle cx="15" cy="20" r="10" fill="none"/><path d="M15 14V20L19 23" fill="none"/><rect x="30" y="15" width="22" height="10" rx="5"/>',
  activities: '<rect x="6" y="9" width="20" height="9" rx="4.5"/><rect x="30" y="9" width="24" height="9" rx="4.5"/><rect x="6" y="23" width="26" height="9" rx="4.5"/><rect x="36" y="23" width="14" height="9" rx="4.5"/>',
  jobs: '<rect x="8" y="9" width="10" height="10" rx="2"/><rect x="25" y="9" width="10" height="10" rx="2"/><rect x="42" y="9" width="10" height="10" rx="2"/><rect x="8" y="23" width="10" height="10" rx="2"/><rect x="25" y="23" width="10" height="10" rx="2"/><rect x="42" y="23" width="10" height="10" rx="2"/>',
  mainjob: '<rect x="6" y="11" width="18" height="18" rx="4"/><path d="M30 17H54M30 24H46" fill="none"/>',
};
const ADD_NAME = { jobs: "ジョブ一覧" };
function renderAddTiles() {
  const box = $("addTiles");
  box.replaceChildren();
  const tile = (name, preview, onClick, type) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "frame-btn";
    if (type) b.dataset.single = type;
    b.append(preview, Object.assign(document.createElement("span"), { textContent: name }));
    b.addEventListener("click", onClick);
    box.append(b);
  };
  const svgTile = (inner) => {
    const svg = document.createElement("span");
    svg.innerHTML = `<svg viewBox="0 0 60 40" aria-hidden="true">${inner}</svg>`;
    return svg.firstChild;
  };
  for (const type of ["text", "image", "rect"]) tile(TYPE_LABEL[type], svgTile(ADD_PREVIEW[type]), () => addLayer(type));
  // 1つあれば十分なものは、押すたびに出す・隠すが入れかわる(出ているものは押された見た目)
  for (const type of SINGLE_TYPES) tile(ADD_NAME[type] ?? TYPE_LABEL[type], svgTile(ADD_PREVIEW[type]), () => toggleSingle(type), type);
  syncSingleTiles();
  // ジョブアイコン(シンボルのように、好きなだけ置ける。ジョブは詳細で選ぶ)
  const icon = document.createElement("img");
  icon.className = "frame-canvas";
  icon.alt = "";
  icon.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(JOB_ICONS["ナイト"].replace("<svg ", '<svg color="#4a3f5c" '));
  tile("ジョブアイコン", icon, () => addLayer("jobicon"));
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
// 枠エディタを開く。target は、作った・直した枠を入れる欄({ id: 要素の id, key: "frame" など })
const FRAME_TARGET_KEY = "characa:frameTarget";
function openFrameEditor(id, target) {
  try {
    if (target) sessionStorage.setItem(FRAME_TARGET_KEY, JSON.stringify(target));
    else sessionStorage.removeItem(FRAME_TARGET_KEY);
  } catch {}
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

// ロードストーン ID だけは、タブを閉じても覚えておく(ほかの作りかけのものは、開きなおすと最初に戻る)
const LODESTONE_ID_KEY = "characa:lodestoneId";
try {
  $("lodestoneId").value = localStorage.getItem(LODESTONE_ID_KEY) ?? "";
} catch {}

$("fetchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = $("lodestoneId").value.trim();
  const id = raw.match(/character\/(\d+)/)?.[1] ?? raw.match(/^\d+$/)?.[0];
  if (!id) {
    setStatus("ID(数字)か、キャラページの URL を入れてください", "error");
    return;
  }

  try {
    localStorage.setItem(LODESTONE_ID_KEY, id); // このブラウザに覚えておくのは、ロードストーン ID だけ
  } catch {}
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
    const { activities, playTimes, playStyle, mainJob, subJobs } = project.data; // 自分で選んだものは、取得しても消さない
    project.data = { ...emptyData(), ...info, activities, playTimes, playStyle, mainJob, subJobs };
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

// 著作権表記「(C) SQUARE ENIX」が、カードの上に見えているか(隠していない・透明にしていない・カードの外に出ていない)
const COPYRIGHT = /(\(C\)|©)\s*SQUARE\s*ENIX/i;
function copyrightShown() {
  const { w, h } = project.card;
  return project.layers.some((l) => {
    if (l.type !== "text" || isHidden(l) || (l.opacity ?? 1) * folderOpacity(l) < 0.1) return false;
    if (!COPYRIGHT.test(resolveText(l.text))) return false;
    const b = boundsById.get(l.id);
    return b && b.x < w && b.y < h && b.x + b.w > 0 && b.y + b.h > 0;
  });
}

$("exportPng").addEventListener("click", async () => {
  draw(); // 未読み込みの画像・フォントの読み込みを始める(表記のチェックにも、描いたあとの位置を使う)
  if (!copyrightShown()) {
    const add = confirm("(C) SQUARE ENIX の表記がないため、保存できません。\nカードの右下に表記を追加しますか?(追加したあと、もう一度「PNGで保存」を押してください)");
    if (add) {
      const { w, h } = project.card;
      const size = Math.max(14, Math.round(Math.min(w, h) / 54));
      const l = makeLayer("text", { text: "(C) SQUARE ENIX", w: size * 10, x: w - 30 - size * 10, y: h - 30 - size, size, align: "right", color: "@sub", opacity: 0.7, wrap: false });
      project.layers.push(l);
      changed();
      select(l.id);
    }
    return;
  }
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
  const json = JSON.stringify({ version: 2, card: project.card, palette: project.palette, paletteId: project.paletteId, customFrames: usedCustomFrames(), customSymbols: usedSymbols(), layers: project.layers }, null, 1);
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
    project = normalize({ palette: project.palette, paletteId: project.paletteId, ...t, data: project.data });
    selectedId = null;
    renderAll();
    saveSoon();
  } catch (err) {
    alert("テンプレートを読み込めませんでした: " + err.message);
  }
});

// 制作エリアの下の「リセット」:レイアウト・配色・枠・画像などをまるごと最初の状態に戻す。キャラ情報(取得した名前など)とロードストーン ID は残す
$("resetAll").addEventListener("click", () => {
  if (!confirm("カードを最初の状態に戻します。よろしいですか?")) return;
  project = { ...defaultProject(), data: project.data };
  selectedId = null;
  beforeApply = null;
  setStatus("");
  renderAll();
  saveSoon();
});

$("reset").addEventListener("click", () => {
  if (!confirm("レイアウトを初期状態に戻します(キャラ情報はそのまま)。よろしいですか?")) return;
  project = { ...defaultProject(), data: project.data, palette: project.palette, paletteId: project.paletteId };
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
  const availH = ws.clientHeight - padY - bar;
  // 横幅はいつも空いている所いっぱい(左右に余白を作らない)。
  // 縦に並べるときの高さは、横幅までにとどめる(下のシートを狭くしないため)。高さが足りなければ横長になる
  const bw = Math.max(120, Math.floor(availW));
  const bh = Math.max(120, Math.floor(availH));

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
// clickToDeselect:何もない所を押したとき。動かさずに離した(クリック)ときだけ、選択を外す。ドラッグで表示を動かしたときは、選択を残す
function startViewDrag(e, clickToDeselect = false) {
  viewDrag = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY, clickToDeselect, moved: false };
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
new ResizeObserver(layoutStage).observe(document.querySelector(".top")); // 上の帯の高さが変わったとき(トップへのリンクが入ったときなど)も測り直す
matchMedia("(min-width: 1000px)").addEventListener("change", layoutStage); // 左右の列が出入りするとき

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
    sessionStorage.setItem(GRID_KEY, on ? "1" : "0");
  } catch {}
}
$("gridToggle").addEventListener("click", () => setGrid($("artboard").classList.contains("no-grid")));
// カードの外側(制作エリアの余白)を押したら選択を外す。拡大中ならそのままドラッグでスクロール
$("artboard").addEventListener("pointerdown", (e) => {
  if (e.target !== e.currentTarget) return;
  // 選択を外すのは、クリックで離したときだけ。Shift を押しながらのときは、表示を動かすだけ(選択は外さない)
  if (startViewDrag(e, !e.shiftKey)) e.currentTarget.setPointerCapture(e.pointerId);
});
$("artboard").addEventListener("pointermove", (e) => {
  if (!viewDrag || pinch) return;
  if (Math.hypot(e.clientX - viewDrag.x, e.clientY - viewDrag.y) > 6) viewDrag.moved = true; // 6px 以上動かしたら、クリックではなくドラッグ
  view.panX = viewDrag.panX + e.clientX - viewDrag.x;
  view.panY = viewDrag.panY + e.clientY - viewDrag.y;
  applyView();
});
const endViewDrag = (e) => {
  const v = viewDrag;
  viewDrag = null;
  $("artboard").classList.remove("panning");
  // 何もない所を、動かさずに離した(クリック)ときだけ、選択を外す。2本指の操作・中断(pointercancel)・ドラッグでは外さない
  if (v?.clickToDeselect && !v.moved && e?.type === "pointerup") select(null);
};
$("artboard").addEventListener("pointerup", endViewDrag);
$("artboard").addEventListener("pointercancel", endViewDrag);
try {
  setGrid(sessionStorage.getItem(GRID_KEY) !== "0");
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
  $("sheet").dataset.tab = name; // タブごとのテーマの色(style.css)
  const body = $("sheetBody");
  body.style.setProperty("--tab-c", color);
  body.scrollTop = 0;
  try {
    sessionStorage.setItem(TAB_KEY, name);
  } catch {}
}
document.querySelectorAll(".sheet-tab").forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));

// レイヤーの引き出し(左から前面に出る)。つまみで出し入れして、開いているかはこのブラウザに覚えておく
const DRAWER_KEY = "characa:layersOpen";
function setLayerDrawer(open) {
  $("layerDrawer").classList.toggle("open", open);
  $("layerHandle").setAttribute("aria-expanded", String(open));
  $("layerHandle").title = open ? "レイヤーをしまう" : "レイヤーを出す";
  try {
    sessionStorage.setItem(DRAWER_KEY, open ? "1" : "0");
  } catch {}
}
$("layerHandle").addEventListener("click", () => setLayerDrawer(!$("layerDrawer").classList.contains("open")));
{
  let open = false;
  try {
    open = sessionStorage.getItem(DRAWER_KEY) === "1";
  } catch {}
  setLayerDrawer(open);
}
// 右のシート(狭い画面では、右から出る引き出し)。開いているかは、そのタブを開いている間だけ覚える
const SHEET_KEY = "characa:sheetOpen";
function setSheetDrawer(open) {
  $("sheet").classList.toggle("open", open);
  $("sheetHandle").setAttribute("aria-expanded", String(open));
  $("sheetHandle").title = open ? "設定をしまう" : "設定を出す";
  try {
    sessionStorage.setItem(SHEET_KEY, open ? "1" : "0");
  } catch {}
}
$("sheetHandle").addEventListener("click", () => setSheetDrawer(!$("sheet").classList.contains("open")));
{
  let open = false;
  try {
    open = sessionStorage.getItem(SHEET_KEY) === "1";
  } catch {}
  setSheetDrawer(open);
}
let savedTab = null;
try {
  savedTab = sessionStorage.getItem(TAB_KEY);
} catch {}
if (savedTab === "edit") savedTab = "layers"; // 「編集」タブは「要素」タブにまとめた
openTab(document.querySelector(`.sheet-tab[data-tab="${savedTab}"]`) ? savedTab : "design");

// 枠エディタで保存して戻ってきたときは、その枠を選んだ状態にする
{
  const params = new URLSearchParams(location.search);
  const back = params.get("frame");
  if (back && findCustomFrame(back)) {
    let target = null;
    try {
      target = JSON.parse(sessionStorage.getItem(FRAME_TARGET_KEY));
      sessionStorage.removeItem(FRAME_TARGET_KEY);
    } catch {}
    const l = target && project.layers.find((x) => x.id === target.id);
    if (l) {
      l[target.key] = back;
      saveNow();
      select(l.id);
      openTab("layers");
    }
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
