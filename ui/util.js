// みんなで使う小さな処理。ページのスクリプトより前に <script src="ui/util.js"></script> で読み込む
// (同じ名前をページの中でもう一度 const / function で作らない。二重になって動かなくなる)

// id で要素を探す
const $ = (id) => document.getElementById(id);

// HTML に文字を入れるときのエスケープ(& < > " ')
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 画面の下に短いお知らせを出す(見た目は ui/kit.css の .toast。要素が無ければ作る)
function toast(msg, ms = 1500) {
  let t = $("toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.id = "toast";
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("on"), ms);
}

// ぐるぐる(読み込み中)の HTML。見た目は ui/kit.css の .spinner
const SPINNER = '<span class="spinner" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>';

// 色コード("#abc"・"abc"・"#aabbcc"・"#aabbccdd" など)→ { r, g, b, a }。読めなければ null
function parseColor(t) {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(t).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((d) => d + d).join("");
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 255 };
}

// { r, g, b, a } → 色コード。透明度 100%(a なし)は "#rrggbb"、すけている色は "#rrggbbaa"
function toHex({ r, g, b, a = 255 }) {
  const x = (n) => Math.round(n).toString(16).padStart(2, "0");
  return "#" + x(r) + x(g) + x(b) + (a < 255 ? x(a) : "");
}

// 数を min〜max の間におさめる
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// このタブを開いている間だけ覚える(sessionStorage)。読めなければ null。書けたら true(大きすぎる・使えないときは false)
function loadSession(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}
function saveSession(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ファイル名に使えない文字(\ / : * ? " < > |)を _ にする。空なら fallback
const safeFileName = (name, fallback) => (String(name ?? "").trim() || fallback).replace(/[\\/:*?"<>|]/g, "_");

// Blob をファイルとして保存する(ダウンロード)
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
