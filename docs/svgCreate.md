# SVGメーカー(アイコンメーカー・characa/tools/icon-maker.html)

最終更新:2026-10-22。ツール共通の決まりは [Tools.md](Tools.md)

- 単色の SVG アイコンを描くツール。もとはキャラカのジョブアイコンを描くために作った(2026-10-08)。トップの「SVGメーカー」のカード(アイコン:曲線と点)から開くだけ(キャラカからのリンクはない)
- 1ファイルで完結(CSS・JS もページの中)。ページのタイトルは「アイコンメーカー」のまま

## ファイル
| ファイル | 役目 |
|---|---|
| `characa/tools/icon-maker.html` | ツール本体。`ui/kit.css` は使わず、みかん色(`--accent: #ff8a3d` など)をページの中の CSS に持つ |
| `ui/layer-drawer.css` / `.js` | 左の列(追加+階層)と右の列。狭い画面では引き出し |
| `ui/site-header.js` | 「あめちゃんもの置き」のリンク |
| `characa/job-icons.js` | できたアイコンを貼る先(`JOB_ICONS`) |

## 画面
- 広い画面:左の列(追加+階層)/ 真ん中の描くマス / 右の列(詳細など)。狭い画面では左右とも引き出し。右の引き出しは「詳細・全体・下書き・プレビュー・ファイル」の付箋タブ
  - 左の「追加」:✏️ 描く / ✋ 動かす / 🖼 下書きを動かす、下書きを読み込む、SVG を開く
  - 左の「階層」:線の一覧(線 1、線 2…。上ほど前。タグ:線・閉じた線・塗り)。押すとその線を選ぶ
  - 右:詳細(選んでいる線)・全体(線の太さ・グリッドに吸着・マス目)・下書き・プレビュー・ファイル(名前・SVG で保存・job-icons.js 用にコピー)
- スクロールバーは共通の見た目(`characa/scrollbar.css`)

## しくみ
- 432×432 の正方形に、下書き画像(PNG・JPG・SVG。読み込み・ドラッグ&ドロップ・貼り付け)をうすく敷いて描く。下書きは移動・拡大・回転・うすさを変えられる
- 描く:クリックした点をなめらかにつなぐ(Catmull-Rom)。点ごとに「角」にできる。最初の点を押すと閉じた形、閉じた形は「塗る」にもできる(重なりは穴)
- 線は丸い先端で currentColor(ジョブアイコンと同じ)。太さは全体で1つ、線ごとに変えることもできる(詳細の「この線の太さ」)
- 保存:SVG に編集用のデータ(`<metadata id="icon-maker">`)を入れておき、開き直すと続きから編集できる。「job-icons.js 用にコピー」で、`JOB_ICONS` にそのまま貼れる1行をコピー
- 元に戻す・やり直す、グリッド吸着、プレビュー(サイズ4つ・色)、このブラウザに自動保存(localStorage `iconmaker:v1`)

## コードの中の地図(icon-maker.html の JS)
- 定数:`SIZE`(432)、`STORAGE_KEY`(`iconmaker:v1`)。状態 `doc`(`blank()` が初期値):`name`・`strokeW`(全体の太さ)・`paths`(`{ id, closed, fill, w?, pts: [{ x, y, corner, hIn?, hOut? }] }`)・`draft`(下書きの画像と位置)
- そのほかの状態:`mode`(`"draw" | "move" | "draft"`。操作の一言は `HINTS`)、`sel`(選んでいる線と点)、`drawing`、`drag`
- `load()` / `save()`(0.3 秒まとめて localStorage。入りきらないときは下書きの画像なしで保存)
- 元に戻す:`snapshot()`(変える前に `doc` 丸ごとを積む。下書きも入る。150 回まで)→ `undo()` / `redo()` → `afterHistory()`
- 線の形:`handlesOf()`(手で動かした点は `hIn`/`hOut`、無ければ自動)→ `pathD()`。太さは `widthOf(p)`
- 書き出し:`exportSvg(withMeta)`(塗りは1つの path、線は同じ太さごとにまとめる。withMeta で metadata を入れる)。開く:`openSvgText()` / `handleFile()`
- 描き直し:`renderAll()`(下書き・線・点・パネル・階層・プレビュー)。マウス:`editor` の pointerdown / pointermove / pointerup、`toUnit()`(画面 → 432 の座標)、`snapV()`(吸着は 9 ごと)

## 確認のしかた
- [Base.md](Base.md) の「画面の確認」のとおりに開いて、`doc` に点を入れて `exportSvg(true)` の中身を見る。開き直し(`openSvgText`)で同じ `paths` に戻るかも見る

## 今の進捗
- [x] 描く・動かす・塗り・下書き・SVG 保存と開き直し・job-icons.js 用コピー・元に戻す・自動保存

## 次の候補(頼まれてから)
- 自動保存が localStorage(ずっと残る)で、[Tools.md](Tools.md) の「作りかけは sessionStorage」と合っていない(わかっているずれ。直すかはユーザーに聞く)
