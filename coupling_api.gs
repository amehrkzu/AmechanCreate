/**
 * カップリング辞典 データAPI（Google Apps Script）
 *
 * スプレッドシートの「拡張機能 > Apps Script」にこのファイルの中身を貼り付けて使う。
 *
 * シート構成
 *   「名前」          A列: 名前 | B列: 画像（任意。ドライブの共有リンク or 画像URL）
 *   「カップリング」  A列: キャラ1 | B列: キャラ2 | C列: カプ名 | D列: 補足
 *   ※ 1行目は見出し行として読み飛ばす
 *
 * 画像
 *   IMAGE_FOLDER_ID のフォルダに「キャラ名.png」のような名前で置けば自動でひもづく。
 *   「名前」シートのB列に何か書いてあればそちらを優先する。
 */

// 画像フォルダのID（フォルダURL https://drive.google.com/drive/folders/XXXX の XXXX 部分）
const IMAGE_FOLDER_ID = "ここにフォルダIDを貼る";

const THUMB_SIZE = "w400";

function doGet() {
  const data = {
    characters: readCharacters(),
    couplings: readCouplings(),
  };
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readCharacters() {
  const images = readFolderImages();
  return readRows("名前")
    .filter(r => r[0])
    .map(r => {
      const name = String(r[0]).trim();
      const explicit = r[1] ? toImageUrl(String(r[1]).trim()) : "";
      return { name, image: explicit || images[name] || "" };
    });
}

function readCouplings() {
  return readRows("カップリング")
    .filter(r => r[0] && r[1])
    .map(r => ({
      a: String(r[0]).trim(),
      b: String(r[1]).trim(),
      name: String(r[2] || "").trim(),
      note: String(r[3] || ""),
    }));
}

function readRows(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1);
}

// フォルダ内の画像を { 拡張子なしファイル名: サムネイルURL } にする
function readFolderImages() {
  const map = {};
  if (!IMAGE_FOLDER_ID || IMAGE_FOLDER_ID.startsWith("ここに")) return map;
  const files = DriveApp.getFolderById(IMAGE_FOLDER_ID).getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (!f.getMimeType().startsWith("image/")) continue;
    const base = f.getName().replace(/\.[^.]+$/, "").trim();
    map[base] = thumbUrl(f.getId());
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
  return "https://drive.google.com/thumbnail?id=" + id + "&sz=" + THUMB_SIZE;
}
