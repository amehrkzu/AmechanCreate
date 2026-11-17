# Tシャツ画像データメーカー(tshirt-designer.html)

最終更新:2026-11-17。ツール共通の決まりは [Tools.md](Tools.md)

- Tシャツにプリントする画像データ(透過 PNG・SVG・PDF)を作るツール。画像・文字・図形を、印刷サイズ(mm)と解像度(dpi)のキャンバスに置く
- 1ファイルで完結(2500行くらい)。サイトの部品(`ui/kit.css`・`ui/util.js`・`ui/site-header.js`・`ui/scrollbar.css`)はまだ使っていない。CSS はページの中(オレンジ系)
- 外から読むもの:Google Fonts(和文・英字の書体)、jsPDF 2.5.1(cdnjs。PDF 書き出し)、保存先の Google Apps Script(`SHEET_WEB_APP_URL`)
- 改行は CRLF([Base.md](Base.md))
- トップの「ツール」で、GIFメーカーの次にカード(アイコン:Tシャツ。説明「Tシャツ用の画像データを作る」)。2026-11-17 に表示した(それまでは `hidden`)

## 画面
- 左のタブ:🧰 そざい(画像の追加・文字・図形(四角・丸)・マイ素材ライブラリ)/ 🖼 キャンバス(大きさ(A3タテ など・自由)・解像度 350/300/150 dpi・プリセット)/ 📋 レイヤー(ドラッグで並べ替え)
- 右:選んでいる物の設定(文字:書体・縦書き/横書き・揃え・太字・色。画像:色を変える・✂️ 枠・背景を消す・💾 マイ素材として保存・実効解像度。共通:不透明度・最前面/最背面・複製・削除・反転)
- 「保存・書き出し」の窓:スプレッドシートに保存/読み込む・.json に保存/読み込む・PNG(透過)・SVG・PDF(印刷サイズ)・👕 プレビュー画像
- ほかの窓:プリセットを選択・Tシャツ着用イメージ(色を選べる)・書き出し前チェック・画像編集(自動で消す/消しゴム)

## しくみ
- `state`(`wMM`・`hMM`・`dpi`・`els`(置いた物)・`sel`)。出力の px は `pxW()`・`pxH()`(mm ÷ 25.4 × dpi)
- 描く:`draw()` → `drawEl()`。つかむ・動かす:`onDown`・`onMove`・`onUp`(ハンドル・スナップ)。元に戻す:`pushUndo`・`undo`・`redo`
- 保存:`serializeState()`。スプレッドシートは `fetch(SHEET_WEB_APP_URL)`(`?action=list`・`?action=get&id=`、保存は POST。長い文字は `splitForSheet()` で分ける)
- 書き出し:`doExport()` → `doExportPng`(背景・ガイドは描かない)・`doExportSvg`・`doExportPdf`(jsPDF)・`doExportPreview`(着用イメージ `drawTee()`)。書き出しの前に、空・解像度が低い画像(150dpi 未満)・はみ出しを調べる
- ずっと覚えるもの(localStorage):足したフォント(`CUSTOM_FONT_KEY`)、マイ素材(`MAT_KEY`)
- プリセット:`PRESETS`(今は「背面」1つ)

## 確認のしかた
- [Base.md](Base.md) の「画面の確認」のとおり(ヘッドレス Chrome)。文字・画像を置いて PNG・PDF を書き出し、大きさ(px)がキャンバスの mm × dpi と合うかを見る

## 今の進捗
- [x] 置く・動かす・文字・図形・画像編集・保存(スプレッドシート・json)・書き出し(PNG・SVG・PDF・着用イメージ)
- [x] トップにカードを表示(2026-11-17)

## 次にやること・候補(頼まれてから作る)
- 使ってみて直す
- サイトの共通部品にそろえる:`ui/site-header.js`(あめちゃんもの置きのリンク)・`ui/scrollbar.css`・テーマ「みかん」([Base.md](Base.md) でまだ付けないことになっている)
