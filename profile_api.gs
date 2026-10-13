/**
 * キャラクタープロフィール データAPI（Google Apps Script）
 *
 * プロフィール用スプレッドシートの「拡張機能 > Apps Script」にこのファイルの中身を貼り付けて使う。
 *
 * シート構成
 *   「プロフィール」  A列: 名前 | B列: 画像（任意） | C列以降: 自由項目
 *   ※ 1行目は見出し行。C列以降は見出しがそのまま項目名になる（例: 誕生日 / 身長 / 好きなもの / 紹介文）
 *   ※ 見出しが空の列は無視する
 *
 *   「補足」          A列: 名前 | B列: 見出し | C列: 本文 | D列: 画像
 *   ※ 1行 = 1ブロック。同じキャラの行はシートの上から順に表示される
 *   ※ 見出し・本文・画像はどれも空欄可
 *
 * 画像
 *   IMAGE_FOLDER_ID のフォルダに「キャラ名.png」のような名前で置けば自動でひもづく。
 *   「プロフィール」のB列に何か書いてあればそちらを優先する（ドライブの共有リンク or 画像URL）。
 *   「補足」のD列には、フォルダ内のファイル名（拡張子あり/なしどちらでも）か、共有リンク・画像URLを書く。
 */

// 画像フォルダのID（フォルダURL https://drive.google.com/drive/folders/XXXX の XXXX 部分）
const IMAGE_FOLDER_ID = "ここにフォルダIDを貼る";

const SHEET_NAME = "プロフィール";
const EXTRA_SHEET_NAME = "補足";
const ICON_SIZE = "w800";
const EXTRA_SIZE = "w1600";

function doGet() {
  const folder = readFolderImageIds();
  const extras = readExtras(folder);
  const characters = readProfiles(folder).map(ch => ({ ...ch, extras: extras[ch.name] || [] }));
  return ContentService
    .createTextOutput(JSON.stringify({ characters }))
    .setMimeType(ContentService.MimeType.JSON);
}

function readProfiles(folder) {
  const [header, ...rows] = readSheet(SHEET_NAME);
  if (!header) return [];

  return rows
    .filter(r => r[0].trim())
    .map(r => {
      const name = r[0].trim();
      const explicit = r[1].trim() ? toImageUrl(r[1].trim(), ICON_SIZE) : "";
      const fromFolder = folder[name] ? thumbUrl(folder[name], ICON_SIZE) : "";
      const fields = [];
      for (let i = 2; i < header.length; i++) {
        const label = header[i].trim();
        if (label) fields.push({ label, value: r[i] });
      }
      return { name, image: explicit || fromFolder, fields };
    });
}

// { キャラ名: [{ title, body, image }, ...] }
function readExtras(folder) {
  const map = {};
  const [header, ...rows] = readSheet(EXTRA_SHEET_NAME);
  if (!header) return map;

  rows.forEach(r => {
    const name = (r[0] || "").trim();
    const title = (r[1] || "").trim();
    const body = r[2] || "";
    const imageValue = (r[3] || "").trim();
    if (!name || !(title || body.trim() || imageValue)) return;

    let image = "";
    if (imageValue) {
      if (/^https?:\/\//.test(imageValue)) {
        image = toImageUrl(imageValue, EXTRA_SIZE);
      } else {
        const id = folder[imageValue] || folder[imageValue.replace(/\.[^.]+$/, "")];
        if (id) image = thumbUrl(id, EXTRA_SIZE);
      }
    }
    (map[name] = map[name] || []).push({ title, body, image });
  });
  return map;
}

// 日付などもシート上の見た目どおりの文字列で取得する
function readSheet(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getDisplayValues();
}

// フォルダ内の画像を { ファイル名: ID, 拡張子なしファイル名: ID } にする
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
function toImageUrl(value, size) {
  const m = value.match(/\/d\/([\w-]+)/) || value.match(/[?&]id=([\w-]+)/);
  if (m && value.includes("drive.google.com")) return thumbUrl(m[1], size);
  return value;
}

function thumbUrl(id, size) {
  return "https://drive.google.com/thumbnail?id=" + id + "&sz=" + size;
}
