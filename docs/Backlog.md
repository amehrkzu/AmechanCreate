# バックログ(全体のやること一覧)

最終更新:2026-10-22

- 1項目1行。くわしい事情は、リンク先の md に書く(ここには書かない)
- 片付いたら、ここから消して、リンク先の md の進捗も直す。新しく出たら、両方に足す
- `backlog.html` がこの md を読んで表示する。`## 見出し` と `- [ ] 文 → [名前](x.md)` の形は変えない

## 修正提案
- [ ] 入力欄の文字が 16px 未満(iPhone で拡大される):キャラカ本体 12px・枠エディタの選択欄と名前の欄・パーツメーカーの選択欄2つ・test・Tシャツ → [CharacterCard.md](CharacterCard.md) → [CharacterCard_frameEditor.md](CharacterCard_frameEditor.md) → [htmlParts.md](htmlParts.md)
- [ ] 線の形の計算が、枠エディタ(`frames.js`)と SVGメーカーで少し違う(同じ点でも形が変わる) → [CharacterCard_frameEditor.md](CharacterCard_frameEditor.md) → [svgCreate.md](svgCreate.md)
- [ ] パーツの `escapeHTML`(`ui/parts.js`)が `'` を逃がさない → [htmlParts.md](htmlParts.md)
- [ ] 引き出しになる幅(999.98px)と、エディタが1列になる幅(900 / 860px)の間で崩れないか確かめる → [Tools.md](Tools.md)
- [ ] Base.md の改行の説明が古い(CRLF はキャラカの app.js などや dot-maker.html にもある) → [Base.md](Base.md)
- [ ] SVGメーカーの自動保存が localStorage(決まりは sessionStorage。直すか聞く) → [svgCreate.md](svgCreate.md)
- [ ] キャラカのサイドバーのスクロールの精査(項目が多いので後回し) → [Tools.md](Tools.md)
- [ ] ページごとに作り直している小さな処理(`$`・エスケープ・`toast`・ぐるぐる・色コードの読み取り)を `ui/` にまとめる → [htmlParts.md](htmlParts.md)
- [ ] キャラ紹介と関係辞典で同じ関数(`escapeHtml`・`initial`・`loadData`・`attachAvatarFallback`、.gs の `toImageUrl`・`thumbUrl`)をまとめる → [Chara.md](Chara.md)
- [ ] キャラカ本体と枠エディタの同じ処理(予備の配色・`ROLES`・`col`・保存の名前・色の読み取り・元に戻す・`startLayerDrag` など)をまとめる → [CharacterCard.md](CharacterCard.md) → [CharacterCard_frameEditor.md](CharacterCard_frameEditor.md)
- [ ] 枠エディタとシンボルエディタの同じ `<style>`(186行)を1つの CSS にする → [CharacterCard_frameEditor.md](CharacterCard_frameEditor.md)

## 対応予定
- [ ] キャラ紹介と関係辞典をつなぐ(データが8割そろってから) → [Chara.md](Chara.md)
- [ ] キャラ一覧の幅を広げるか(今 880px) → [Chara_1.md](Chara_1.md)
- [ ] シートの更新日を自動にする(onEdit) → [Chara.md](Chara.md)
- [ ] ドット絵メーカー:小さいドット絵の PNG を開いて大きく書き出す(返事待ち) → [dotMaker.md](dotMaker.md)
- [ ] ドット絵メーカー:レイヤー → [dotMaker.md](dotMaker.md)
- [ ] キャラカ:デザインを増やす、Lodestone ID の調べ方の画像、X 共有、中央揃えのガイド → [CharacterCard.md](CharacterCard.md)
- [ ] キャラカ:スマホの保存画面(長押し保存・Web Share) → [CharacterCard.md](CharacterCard.md)
- [ ] 枠エディタ:「プリセット反映」ボタン、辺の模様の見せ方の見直し、枠だけの書き出し → [CharacterCard_frameEditor.md](CharacterCard_frameEditor.md)
- [ ] パーツ台帳のテーマ切り替えに レモン・もり・ぶどう を足す → [htmlParts.md](htmlParts.md)
- [ ] Tシャツ画像データメーカー(作業中・トップでは非表示) → [Base.md](Base.md)
