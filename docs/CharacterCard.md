# FF14 キャラカメーカー(characa/)

最終更新:2026-10-22。ツール共通の決まりは [Tools.md](Tools.md)

FF14 のキャラクターカード画像を作るツール。**スクショの上に、文字やパネルを自由に置いていく**のが基本。差別化ポイントは、テキストなどを自由に配置・編集できること。

- 公開:https://amehrkzu.github.io/AmechanCreate/characa/index.html
- 枠エディタ・シンボルエディタ:[CharacterCard_frameEditor.md](CharacterCard_frameEditor.md)
- いつ何を作ったか・調べて決めたこと:[CharacterCard_history.md](CharacterCard_history.md)

## ファイル
| ファイル | 中身 |
|---|---|
| `characa/index.html` / `style.css` / `app.js` | キャラカ本体(canvas に直接描く。見たまま PNG) |
| `characa/frames.js` | 枠の描き方(用意してある形+オリジナル枠)とシンボル。本体とエディタで共通(SVGメーカーも線の形の計算に使う) |
| `characa/effects.js` | スクショのエフェクト(画素を自前で計算) |
| `characa/job-icons.js` | ジョブアイコン(単色 SVG、currentColor) |
| `characa/templates/index.js` + `*.json` | デザイン(テンプレート)5種と配色7種 |
| `characa/frame-editor.html` / `frame-editor.js` | 枠エディタ |
| `characa/symbol-editor.html` | シンボルエディタ(frame-editor.js を共有) |
| `ui/util.js` | `$`(本体・枠エディタ・シンボルエディタで読み込む。`app.js` / `frame-editor.js` の中では作らない) |
| `ui/scrollbar.css` | 共通のスクロールバー(サイト全体で共通。2026-10-22 に `characa/` から移した) |
| `characa/worker.js` | Cloudflare Worker(Lodestone からキャラ情報を取る) |

## しくみ(コードのどこで何をしているか)
- `app.js`
  - `defaultProject`:初めのカード。`tidyFolders`:フォルダーの中身をフォルダーのすぐ後ろに並べ直す(読み込み・並べ替えのたび)
  - `layoutStage`:制作エリアの大きさと全体表示の倍率(1920×1080 が収まる倍率 ×0.94。はみ出すカードだけさらに縮める)。`view` / `applyView` / `zoomTo`:表示の拡大縮小・移動(50%〜600%)
  - `edgeAt` / `resize`:辺・角のドラッグで大きさ。`fitBaseImages`:カードのサイズを変えたら土台のスクショを合わせる
  - `startLayerDrag`:階層の並べ替え(指は長押し 400ms)。`drawPhoto` / `renderFx`:スクショとエフェクト
- `frames.js`:`drawFramePanel`(枠を描く。切り抜きは `drawIsolated` で別 canvas)、`customBaseOutline`(土台「自分で描く」)、`drawBorderPattern`(枠線の模様)、`drawSymbol` / `loadSymbols`(シンボル)
- `frame-editor.js`:`SYMBOL_MODE`(シンボルエディタのとき)、`renderContext`(編集していない部分をうすく重ねる)、`PANEL_TINT`(パネルの色の濃さ)

## Lodestone からの取得(Cloudflare Worker)
- ブラウザから Lodestone は直接読めない(CORS)ので、Worker を通す:`https://characa.game-rain-0406.workers.dev/?id={ID}`
- 返すもの:`name, title, server, dataCenter, race, tribe, gender, birthday, guardian, hometown, grandCompany, grandCompanyRank, freeCompany, selfIntroduction, id, levels[{name, level}]`。画像は使わない(スクショはユーザーが自分で入れる)
  - `levels`:未習得は `"-"`。ジョブを取る前はクラス名(例:剣術士)。末尾にエレメンタルなどのレベルも入る。自己紹介「未設定」は空文字
  - エラー:ID が変 → 400、キャラがない → 404、Lodestone の異常 → 502。同じ ID は 10 分キャッシュ
- `ALLOWED_ORIGINS` に `https://amehrkzu.github.io` と `http://localhost:8000` を許可。**worker.js を変えたら、Cloudflare のダッシュボードで「コードを編集」に丸ごと貼り替えてデプロイ**(ユーザーがやる)
- テスト用 ID:`22997788`(Cyrano Ott)

## 画面の構成
- 配置は [Tools.md](Tools.md) の「エディタ系の配置」どおり(右の引き出しのつまみは「✿ 設定」)。上の帯:タイトル・PNG で保存
- 真ん中は**制作エリア**(`artboard`。グリッド線・カード)。下のバー(`stage-bar`):「－ 100% ＋」/ リセット / グリッド
- 右のシートのタブ(左から):**詳細**(選んでいる要素。HTML では `data-tab="layers"`)・デザイン・キャラ・エフェクト・カード。タブごとにテーマの色(詳細=もり、デザイン=みかん、キャラ=レモン、エフェクト=いちご、カード=ぶどう。`.sheet[data-tab]`)
- 「詳細」の見出しの右はしにごみ箱(選んでいる物を削除。フォルダーは中身ごと、確認あり。Delete キーも同じ)。並べ替えは階層のドラッグ
- 著作物の表記(「FINAL FANTASY XIV 著作物利用条件」へのリンク)を、シートの一番下に置く

## 要素(左の「追加」)
| 要素 | 内容 |
|---|---|
| テキスト | 差し込み項目 `{name}` `{server}` … `{lv:ナイト}` が取得データに置き換わる。大きさは枠のドラッグで比率で変わる |
| 画像 | スクショ。カード全体を覆う土台の画像枠がいちばん背面。ホイールでズーム、Alt+ドラッグで枠の中の位置 |
| 枠(前の名前は「図形」) | パネル。**枠の形は1つずつ選ぶ**(詳細の「枠の形」:見本のアイコンを横にスクロールして選ぶ。最後の「作る」で枠エディタへ。作った枠はその欄に入る)。枠線の太さはオリジナル枠にも効く(0 = 枠エディタの太さ) |
| ジョブ一覧 | 追加すると、フォルダー「ジョブ一覧」に一覧とメインジョブが入る。枠の幅・高さを自由に変えると、幅に入る分だけ並んで折り返す(列数はない)。メインジョブは板+ふちで強調、サブジョブは色違い。「背景の板」「メイン・サブの板の形」も選べる |
| メインジョブ | アイコン+ジョブ名+Lv。メインジョブを選んでいないときは何も出ない |
| 時間帯 | 「エオ住 / 不定期」と「朝〜深夜」のタグ |
| コンテンツ | やっているコンテンツのタグ(戦う/作る・集める/その他+自由に足す)。タグの形・塗り・線の太さ・背景の板を選べる |
| シンボル | シンボルエディタで作った図形 |
| フォルダー | 中に要素やフォルダーを入れる(何段でも)。隠す・不透明度(かけ算)・まとめて動かす・複製・削除は中身まで。「フォルダーを解除」で中身は1つ外へ。出し入れは階層のドラッグだけ |

- 時間帯・メイン/サブジョブ・やっているコンテンツは「キャラ」タブで選ぶ(キャラ情報と同じ扱い。リセットしても残る。Lodestone の取得でも消えない)
- 初めのカードと5つのデザインは、土台のスクショ以外を「ステータス」フォルダーに入れてある(テンプレートの JSON では `"id": "status"` / `"folder": "status"`)
- ジョブアイコンの元素材は `Downloads/FFXIV_Jobs_Plus_Bonus_3`(Git には入れない)。魔獣使いは素材にないので、同じ太さ・丸い先端の線(stroke)で描き直した(ほかは塗り)

## デザイン・配色・エフェクト
- テンプレートは「書き出し」と同じ形式の JSON(`version: 2`, `card`, `layers`)。fetch で読むので file:// では出ない
- 配色の役割:`accent` `text` `sub` `muted` `panel` `bg1` `bg2` `shadow`。要素の色に `"@accent"` のように書くと配色の色、`#xxxxxx` は固定の色
- エフェクトは画素を自前で計算(`ctx.filter` は Safari で使えないため)。操作中は小さい版(480px、指の端末は 360px)、250ms 止まったら本番の版(1600px)。PNG 保存では必ず本番の版
- PNG 保存は、読み込み途中の画像・フォントを最大3秒待ってから描く(ジョブアイコンが頭文字になるのを防ぐ)

## 操作
- 選ぶ・動かす:カード上で押す・ドラッグ。辺・角のドラッグで大きさ(図形・画像は幅と高さ、テキストは比率。角をドラッグ中に Shift で縦横比を保つ)
- 表示を動かす:何もない所・余白のドラッグ、**Shift+左ドラッグ**(要素は選ばない・動かさない)、スペース+ドラッグ、ホイールボタン、2本指。動かしても選択は外れない(動かさずに離したクリックだけ外す)
- 拡大縮小:「－ 100% ＋」、Ctrl+ホイール、ピンチ(50%〜600%)
- エフェクト:画像を選んでいないときは、メインのスクショを調整する

## 保存・リセット
- 作りかけのカード・グリッド・開いているタブ・引き出しは、そのタブを開いている間だけ(sessionStorage `characa:v1` など)
- ずっと覚えるのは、ロードストーン ID(`characa:lodestoneId`)と、オリジナル枠・シンボル(`characa:frames` / `characa:symbols`)
- 「リセット」(制作エリアの下):カードを最初の状態に(キャラ情報は残す。確認あり)。「カード」タブの「初期レイアウトに戻す」は、配色などを残してレイアウトだけ戻す
- 「自分のデザインを保存・読み込み」:JSON の書き出し・読み込み(使っているオリジナル枠・シンボルも入る)。前の保存データの「カード全体の枠の形」(`project.frame`)は、読み込むときに各枠へ移す

## 確認のしかた
- [Base.md](Base.md) の「画面の確認」のやり方(ヘッドレス Chrome)で `characa/index.html` を開く。Worker が許可しているのは `http://localhost:8000`(ユーザーのサーバー)だけなので、自分のポート 8765 では取得だけ失敗する(ほかは確かめられる)。file:// は取得もテンプレートも読めない
- ID `22997788` で取得 → デザイン切り替え → PNG 保存、まで通す

## 進捗
- できた:取得(Pages・localhost)、要素・フォルダー・デザイン5種・配色7種・エフェクト、枠エディタ・シンボルエディタ、画面の配置(広い画面・引き出し)
- 入力欄の文字:広い画面は `.field` の 12px を `font: inherit` で受ける。狭い画面(999.98px 以下)は `style.css` の引き出しの `@media` で 16px

## 次の候補
- デザインを増やす(ツールで作る → 書き出す → `templates/` に置いて `index.js` に1行足す)
- 改善候補:Lodestone ID の調べ方の説明画像、X 共有、スナップ(中央揃えガイド)
- スマホの保存:すぐダウンロードせず、保存用の画面に画像を出す(長押しで保存の案内・「写真に保存 / 共有」= Web Share。`navigator.share` はまだ使っていない)。iOS Safari はボタンを押した直後でないと共有画面を出せないので、画像の準備が済んでからもう一度押してもらう
- 枠エディタ(`frame-editor.js`)と同じ処理をまとめる:予備の配色(`FALLBACK_PALETTE` / `FALLBACK_COLORS`)・`ROLES`・`col` は `frames.js` へ、保存の名前 `characa:v1` は1か所に、色の読み取り(`rgba`・`lightness`)は effects.js の `hexRgb` に寄せる。元に戻す・`button()`・`startLayerDrag`・2本指の拡大も同じ作り

## 注意
- 指の端末:押せる所は高さ 40px 前後に。`pointercancel`(着信などで途切れた)でも状態を戻す
- 確認するサイズ:320×568 / 375×667 / 812×375(横向き)。横にはみ出さないこと
