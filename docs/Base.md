# 全体規約(基盤)— 必ず読む

最終更新:2026-10-21

## このサイト
- 「あめちゃんもの置き」:ユーザー(あめちゃん)が個人で楽しむためのサイト。FF14 のキャラ紹介と、自作ツールを置いている
- 公開:GitHub Pages(https://amehrkzu.github.io/AmechanCreate/)。リポジトリはこのフォルダー(`AmechanCreate/`)
- 素の HTML / CSS / JavaScript(ビルドなし)。多くのページは、CSS・JS をページの中に書いた1ファイル構成

### ページ一覧
| ページ | ファイル | 分野(詳しい md) |
|---|---|---|
| トップ | `index.html` | このファイル |
| キャラクター紹介 | `profile.html` + `profile_api.gs` | キャラ系 → [Chara_1.md](Chara_1.md) |
| 関係辞典(カップリング辞典) | `coupling.html` + `coupling_api.gs` | キャラ系 → [Chara_2.md](Chara_2.md) |
| FF14 キャラカメーカー・枠エディタ・シンボルエディタ | `characa/` | ツール系 → [CharacterCard.md](CharacterCard.md) |
| パーツ台帳・パーツメーカー | `ui-kit.html` / `ui-maker.html` / `ui/` | ツール系 → [htmlParts.md](htmlParts.md) |
| SVGメーカー(アイコンメーカー) | `characa/tools/icon-maker.html` | ツール系 → [svgCreate.md](svgCreate.md) |
| ドット絵メーカー | `dot-maker.html` | ツール系 → [dotMaker.md](dotMaker.md) |
| アプリダウンロード | `download/` | ツール系 → [Download.md](Download.md) |
| HNB(文字アニメの確認) | `test.html` | — |
| Tシャツ画像データメーカー | `tshirt-designer.html` | 作業中。トップでは非表示 |

### トップ(index.html)
- テーマ「そら」。見出しごとにカードを並べる:キャラ / ツール / その他 / 外部リンク
- キャラ:キャラクター紹介・関係辞典(どちらも「～作成中～」)
- ツール:キャラカメーカー・パーツメーカー・SVGメーカー・ドット絵メーカー(Tシャツは `hidden`)
- その他:HNB・パーツ台帳・アプリダウンロード
- 外部リンク:譜面屋「G Clef.」

---

## UI を作る・直すとき(このサイトのすべての HTML)
- 部品は [ui-kit.html](../ui-kit.html)(パーツ台帳)にあるものを使う。見た目は [ui/kit.css](../ui/kit.css)。部品の詳しい決まりは [htmlParts.md](htmlParts.md)
- ユーザーは**テーマ名**(そら=水色 / いちご=ピンク / みかん=オレンジ / レモン=黄色(remon) / もり=緑(mori) / ぶどう=むらさき(budo))、**部品の名前**(「箱」「ぷっくりボタン」「リンクカード」など)、**色の名前**(「アクセント」「付箋・ミント」など)で指示する
- 新しいページは `<html data-theme="…">` + `ui/kit.css` を読み込んで作る。色は直接書かず `var(--accent)` などを使う
- テーマの目安:サイトのトップ=そら、キャラ紹介・関係辞典=いちご、ツール=みかん
- 今あるページ(index / coupling / profile / キャラカ / Tシャツ)は、まだ ui/kit.css を使っていない(それぞれのページの中に CSS がある)。kit.css を後から読み込むと、ページ全体の見た目まで変わるので注意(必要な部品の CSS だけ、ページの中に写す)
- 合言葉は「かわいく」:パステル・太めの枠線・まるい角・押すと沈むボタン・丸ゴシック(M PLUS Rounded 1c)
- スマホ(幅 320px)でも崩れないこと。入力欄の文字は 16px 以上
- **外側の余白を多くしない(ユーザーの好み)**:PC(広い画面)では、画面の左右を大きく空けて真ん中に小さくまとめない。特に一覧・キャラ選択・ギャラリーなど「並べて見せる」部分は、画面の幅いっぱい近くまで使う(内容に max-width を付けるなら大きめに。文章を読ませる部分だけは、読みやすい幅にしてよい)。スマホ(狭い画面)は余白多めでもよい
- **説明の文章は、なるべく画面に出さない**(ユーザーの好み。「使い方」の箱や長い注意書きは邪魔、とのこと)。どうしても必要なら1行で
- どのページにも、ブラウザのタブのアイコンを付ける:`<title>` のすぐ下に `<link rel="icon" type="image/png" href="Icon.png">`(フォルダーの深さに合わせて `../Icon.png` など)。`Icon.png` は青い傘(256×256)
- どのページにも「あめちゃんもの置き」(トップへ戻る文字だけのリンク。「あめちゃん/もの置き」の小さめの2行)を付ける:`ui/site-header.js` を `defer` で読み込み、上の帯があればその帯に `data-site-bar` を付ける(なければ左上に浮く)。ページ一覧は付けない
  - 行き来は関係のあるページ同士だけ(パーツ台帳 ⇔ パーツメーカー、キャラカ ⇔ 枠エディタ・シンボルエディタ。SVGメーカーはトップのカードから開くだけ)。Tシャツのページにはまだ付けない
- 新しい部品を作ったら、名前を決めて ui/kit.css と パーツ台帳の両方に足す(書き方は [htmlParts.md](htmlParts.md))

---

## 作業の決まり(AI 向け)
- **返事・説明は日本語**。専門用語はなるべく使わず、手順はメニュー名を具体的に書く
- **コミット・プッシュはしない、すすめない**(ユーザーが必ず自分でやる)。報告では、変えたファイルを書く
- ユーザーは合言葉・好みがはっきりしている。言われていない機能・説明文を勝手に足さない。迷ったら短く聞く
- **画面の確認**
  - ブラウザのペイン(preview_start / navigate)は自分から開かない。開くと空タブが残って、ユーザーが困る
  - Write ツールで `.html` を作る・書き換えると、アプリが自動でそのファイルのタブを開く。HTML は node のスクリプトで書くか、Write のあとでタブを確認して全部閉じる
  - 確認は、見えないブラウザ(ヘッドレス Chrome:`C:/Program Files/Google/Chrome/Application/chrome.exe --headless=new --remote-debugging-port=… --user-data-dir=一時フォルダー` を Node の WebSocket(CDP)で動かす)で行う。写真(Page.captureScreenshot)も撮れる。拡大率のずれは Emulation.setDeviceMetricsOverride の deviceScaleFactor で再現できる
  - 確認用のサーバーは、自分で Node の小さなサーバーをポート **8765** に立てて、そのプロセスだけを止める。**ポート 8000 はユーザーが `npx http-server C:/Users/kikuchi/Documents/AmechanCreate -p 8000 -c-1` で使う**ので、さわらない
  - このPCの `python` は動かない(Microsoft Store の案内だけ)
- **ファイルの書き換え**
  - いくつかのファイルは改行が CRLF(`index.html`・`profile.html` など)。node のスクリプトで、いったん LF にして直し、元の改行に戻す
  - bash のヒアドキュメントの中に JS の正規表現(`\/` など)を書くと、`\` が消えることがある。正規表現を含むスクリプトは Write ツールで書く(String.raw を使う)
- 新しい決まり・仕様が決まったら、合う md に書き足す([CLAUDE.md](../CLAUDE.md) は目次だけにする)
