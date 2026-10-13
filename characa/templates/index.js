// デザイン(テンプレート)と配色の一覧
//
// デザインを増やすには:
//   1. ツールでレイアウトを作る(色は「配色の色」を選んでおくと、配色の切り替えに対応する)
//   2. 「自分のデザインを保存・読み込み」→「書き出し」で JSON を保存
//   3. その JSON をこのフォルダに置き、下の CHARACA_TEMPLATES に1行足す
//   ※ JSON 内のキャラ情報やスクショは保存されない(書き出しに含まれない)ので、そのまま置いてよい
//   ※ 画像枠のいちばん背面側のものに、使う人のスクショが入る

window.CHARACA_TEMPLATES = [
  { file: "classic.json", name: "クラシック" },
  { file: "split.json", name: "スプリット" },
  { file: "cinema.json", name: "シネマ" },
  { file: "square.json", name: "スクエア" },
  { file: "portrait.json", name: "ポートレート" },
];

// 配色を増やすには、ここに1つ足す
//   bg1 / bg2 : 背景のグラデーション   panel : パネル(図形)   accent : アクセント(称号・枠線・レベル)
//   text : 文字   sub : サブ文字   muted : 控えめ(未習得ジョブなど)   shadow : 文字の影
window.CHARACA_PALETTES = [
  { id: "night", name: "夜空", colors: { bg1: "#1c2333", bg2: "#4a3558", panel: "#000000", accent: "#e0c27a", text: "#ffffff", sub: "#cfd6e6", muted: "#6b7280", shadow: "#000000" } },
  { id: "noir", name: "黒金", colors: { bg1: "#0b0b0d", bg2: "#2a2418", panel: "#000000", accent: "#d4af37", text: "#f5f0e1", sub: "#b9ad8f", muted: "#4a4538", shadow: "#000000" } },
  { id: "crimson", name: "紅", colors: { bg1: "#2a0a10", bg2: "#7a1a2a", panel: "#000000", accent: "#ff9a76", text: "#fff4ef", sub: "#e8c3bc", muted: "#6e3c42", shadow: "#000000" } },
  { id: "ocean", name: "海", colors: { bg1: "#0e3a5c", bg2: "#3fa7c4", panel: "#062033", accent: "#8ee6f0", text: "#ffffff", sub: "#cfe9f2", muted: "#4f7f95", shadow: "#001018" } },
  { id: "forest", name: "森", colors: { bg1: "#16322a", bg2: "#4f6b3a", panel: "#0b1a14", accent: "#c8e28a", text: "#f1f5e9", sub: "#c3d1b8", muted: "#5d6e5a", shadow: "#000000" } },
  { id: "sakura", name: "桜", colors: { bg1: "#f7d6e0", bg2: "#c99bd8", panel: "#ffffff", accent: "#d4517a", text: "#4a2a3a", sub: "#7a5566", muted: "#c4a8b4", shadow: "#ffffff" } },
  { id: "porcelain", name: "白磁", colors: { bg1: "#f4f1ea", bg2: "#d9dde3", panel: "#ffffff", accent: "#2f5d8a", text: "#1f2630", sub: "#4f5b6b", muted: "#b5bcc6", shadow: "#ffffff" } },
];
