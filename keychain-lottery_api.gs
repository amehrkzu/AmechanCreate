/**
 * アクキーくじ データAPI(Google Apps Script)
 *
 * くじ用スプレッドシートの「拡張機能 > Apps Script」にこのファイルの中身を貼り付けて使う。
 * デプロイ:「デプロイ > 新しいデプロイ > ウェブアプリ」。次のユーザーとして実行 = 自分、アクセスできるユーザー = 全員
 *
 * シート構成(1行目は見出し行。シートが無ければ、最初に呼ばれたときに作る)
 *   「景品」    A列: 種類 | B列: 在庫数 | C列: 画像(任意。ドライブの共有リンク or 画像URL)
 *   「コード」  A列: 引換コード(1つのコードで1個もらえる)
 *   「応募」    A列: 最後に送った日時 | B列: 氏名 | C列: 住所 | D列: コード | E列: 当たり
 *               1人1行。氏名と住所が同じなら同じ人として、コードと当たりを「、」でつないで足す
 *
 * しくみ
 *   引く:在庫数で重みを付けて選ぶ(残りが多い種類ほど当たりやすい)。在庫は減らさず、シートにも書かない
 *         当たりはコードごとにスクリプトのプロパティに覚える(ページで書きかえられないように)
 *         いっしょに入れたほかのコードの当たりは、在庫から引いて考える(まとめて引いても在庫より多く当たらない)
 *         一度引いたコードの当たりは固定(もう一度引いても、タブを閉じても同じ当たり。リセマラできない)
 *   送る:コードをまとめて「応募」に書き、当たった種類の在庫を減らす。そのコードはもう使えない
 *         引いてから送るまでに在庫が足りなくなっていたら "gone"(何も書かない。ページは引く画面に戻る)
 *         このときだけ、足りなかった種類のコードの当たりを消して、引き直せるようにする
 *   住所・氏名はシートに書くだけで、ページからは読めない
 */

const PRIZE_SHEET = "景品";
const CODE_SHEET = "コード";
const ENTRY_SHEET = "応募";
const HEADERS = {
  [PRIZE_SHEET]: ["種類", "在庫数", "画像"],
  [CODE_SHEET]: ["引換コード"],
  [ENTRY_SHEET]: ["最後に送った日時", "氏名", "住所", "コード", "当たり"]
};
const DRAW_KEY = "draw:";
// 画像フォルダのID(フォルダURL https://drive.google.com/drive/folders/XXXX の XXXX 部分)
// ここに「種類の名前.png」のような名前で置けば自動でひもづく。「景品」の C列に書いてあればそちらを優先する
// 画像は「リンクを知っている全員」が見られるように共有しておく
const IMAGE_FOLDER_ID = "ここにフォルダIDを貼る";
const IMAGE_SIZE = "w600";
const SEP = "、";

// 種類の一覧(在庫があるものだけ。数は出さない)。{ items: [{ name, img }] }(画像が無ければ img は "")
function doGet() {
  return json(withLock(() => {
    const folder = readFolderImageIds();
    const items = readPrizes().filter(p => p.stock > 0).map(p => ({
      name: p.name,
      img: p.img ? toImageUrl(p.img) : (folder[p.name] ? thumbUrl(folder[p.name]) : "")
    }));
    return { items };
  }));
}

// body(text/plain の JSON)
//   { action: "draw", codes: [いっしょに入れた全部], draw: [今引くコード] } → { results: [{ code, result }] }
//   { action: "send", codes: [...], name, address } → { ok, results }
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json({ error: "bad" }); }
  return json(withLock(() => {
    const codes = uniq(req.codes);
    if (codes.length === 0) return { error: "code" };
    const bad = checkCodes(codes);
    if (bad) return bad;
    if (req.action === "draw") return draw(codes, uniq(req.draw).filter(c => codes.includes(c)));
    if (req.action === "send") return send(codes, cleanText(req.name), cleanText(req.address));
    return { error: "bad" };
  }));
}

function draw(codes, targets) {
  if (targets.length === 0) return { error: "code" };
  const props = PropertiesService.getScriptProperties();
  const prizes = readPrizes();
  // もう当たりがあるコードは、その当たりのまま(固定)。その分は在庫から引いて考える
  const fixed = {};
  codes.forEach(c => {
    const prize = props.getProperty(DRAW_KEY + c);
    if (!prize) return;
    if (targets.includes(c)) fixed[c] = prize;
    const p = prizes.find(x => x.name === prize);
    if (p) p.stock--;
  });
  const fresh = {};
  for (const code of targets.filter(c => !fixed[c])) {
    const left = prizes.filter(p => p.stock > 0);
    const total = left.reduce((s, p) => s + p.stock, 0);
    if (total === 0) return { error: "empty" };
    let r = Math.random() * total;
    const hit = left.find(p => (r -= p.stock) < 0) || left[left.length - 1];
    hit.stock--;
    fresh[code] = hit.name;
  }
  Object.keys(fresh).forEach(c => props.setProperty(DRAW_KEY + c, fresh[c]));
  return { results: targets.map(code => ({ code, result: fixed[code] || fresh[code] })) };
}

function send(codes, name, address) {
  if (!name || !address) return { error: "input" };
  const props = PropertiesService.getScriptProperties();
  const results = codes.map(code => ({ code, result: props.getProperty(DRAW_KEY + code) }));
  if (results.some(x => !x.result)) return { error: "nodraw" };

  // 在庫が全部足りるか先に確かめる(足りなければ何も書かない)
  const prizes = readPrizes();
  const short = [];
  for (const x of results) {
    const p = prizes.find(q => q.name === x.result);
    if (!p || p.stock < 1) short.push(x.code);
    else p.stock--;
  }
  if (short.length) {
    // 足りなかったコードだけ当たりを消す(ほかのコードの当たりは固定のまま)
    short.forEach(c => props.deleteProperty(DRAW_KEY + c));
    return { error: "gone", codes: short };
  }
  const prizeSheet = sheet(PRIZE_SHEET);
  prizes.forEach(p => prizeSheet.getRange(p.row, 2).setValue(p.stock));

  // 先頭の ' で、= などで始まる文字を式にしない・数字だけのコードを数にしない
  const addCodes = results.map(x => x.code).join(SEP);
  const addPrizes = results.map(x => x.result).join(SEP);
  const sh = sheet(ENTRY_SHEET);
  const rows = values(sh);
  const i = rows.findIndex(r => cleanText(r[1]) === name && cleanText(r[2]) === address);
  if (i < 0) {
    sh.appendRow([new Date(), "'" + name, "'" + address, "'" + addCodes, "'" + addPrizes]);
  } else {
    const row = rows[i];
    sh.getRange(i + 2, 1).setValue(new Date());
    sh.getRange(i + 2, 4).setValue("'" + joinCell(row[3], addCodes));
    sh.getRange(i + 2, 5).setValue("'" + joinCell(row[4], addPrizes));
  }
  codes.forEach(c => props.deleteProperty(DRAW_KEY + c));
  return { ok: true, results };
}

// ないコード・使ったコードがあれば、そのエラーを返す
function checkCodes(codes) {
  const known = values(sheet(CODE_SHEET)).map(r => normCode(r[0]));
  const missing = codes.filter(c => !known.includes(c));
  if (missing.length) return { error: "code", codes: missing };
  const used = usedCodes();
  const dup = codes.filter(c => used.includes(c));
  if (dup.length) return { error: "used", codes: dup };
  return null;
}

function usedCodes() {
  return values(sheet(ENTRY_SHEET)).flatMap(r => stripQuote(r[3]).split(SEP).map(normCode)).filter(Boolean);
}

function readPrizes() {
  return values(sheet(PRIZE_SHEET))
    .map((r, i) => ({ row: i + 2, name: String(r[0]).trim(), stock: Math.max(0, Math.floor(Number(r[1]) || 0)), img: String(r[2]).trim() }))
    .filter(p => p.name);
}

// フォルダの画像 { "名前.png": id, "名前": id }(フォルダIDが無ければ {})
function readFolderImageIds() {
  const map = {};
  if (!IMAGE_FOLDER_ID || IMAGE_FOLDER_ID.startsWith("ここに")) return map;
  const files = DriveApp.getFolderById(IMAGE_FOLDER_ID).getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (!f.getMimeType().startsWith("image/")) continue;
    const full = f.getName().trim();
    map[full] = f.getId();
    map[full.replace(/\.[^.]+$/, "")] = f.getId();
  }
  return map;
}

// ドライブの共有リンクならサムネイルURLに変換、それ以外のURLはそのまま使う
function toImageUrl(value) {
  const m = value.match(/\/d\/([\w-]+)/) || value.match(/[?&]id=([\w-]+)/);
  if (m && value.includes("drive.google.com")) return thumbUrl(m[1]);
  return value;
}

function thumbUrl(id) {
  return "https://drive.google.com/thumbnail?id=" + id + "&sz=" + IMAGE_SIZE;
}

function joinCell(old, add) {
  const s = stripQuote(old);
  return s ? s + SEP + add : add;
}

function stripQuote(v) {
  return String(v == null ? "" : v).replace(/^'/, "");
}

function cleanText(v) {
  return stripQuote(v).replace(/\s+/g, " ").trim();
}

function normCode(c) {
  return String(c == null ? "" : c).trim().toUpperCase();
}

function uniq(list) {
  return Array.isArray(list) ? [...new Set(list.map(normCode).filter(Boolean))] : [];
}

// 見出しの下の行(無ければ [])
function values(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS[sh.getName()].length).getValues();
}

function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// 同時に送っても在庫がずれないように、1人ずつ順番に処理する
function withLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { error: "busy" };
  try {
    Object.keys(HEADERS).forEach(sheet); // 無いシートを作る
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
