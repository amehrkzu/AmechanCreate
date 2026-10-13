"use strict";
// どのページにも「あめちゃんもの置き」(サイトのトップへ戻る文字のリンク)を付ける
//   使い方:<script src="(ui フォルダへの道)/site-header.js" defer></script>
//   ・ページに上の帯があるときは、その帯に data-site-bar を付ける → 帯の左はしに入る
//   ・帯がないページでは、画面の左上に小さく浮かせる
//   見た目を変えたいときは、このファイルだけ直せば全部のページが変わる
(() => {
  const me = document.currentScript;
  const top = new URL("../", me.src).href; // このファイル(ui/)の1つ上がサイトのトップ

  const css = document.createElement("style");
  css.textContent = `
/* 文字だけのリンク。「あめちゃん」「もの置き」の小さめの2行。のせると色が変わって下線 */
.site-home {
  flex-shrink: 0; width: 5.2em;
  color: var(--text, #4a3f4f);
  font: 700 11px/1.3 "M PLUS Rounded 1c", "Zen Maru Gothic", system-ui, sans-serif;
  letter-spacing: .03em; text-decoration: none; cursor: pointer; touch-action: manipulation;
  transition: color .15s;
}
.site-home:hover { color: var(--accent, #4ea4e8); text-decoration: underline; text-underline-offset: 3px; }
.site-home:focus-visible { outline: 3px solid var(--accent, #4ea4e8); outline-offset: 3px; border-radius: 4px; }
.site-home span { display: block; white-space: nowrap; }
[data-site-bar] > .site-home + h1 { margin-right: auto; } /* 帯のタイトルは、真ん中ではなくすぐ右に */
/* 帯がないページ:左上に浮かせる。背景の上でも読めるように、白いふちどり */
.site-float {
  position: fixed; z-index: 1000; top: max(10px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left));
  text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 6px #fff;
}
/* スマホ:帯の中はすき間をつめて、タイトルは言葉の切れ目で2行に折り返せるように(切れて「…」にならない)。
   帯がないページでは、浮かせずにページのいちばん上に置く(大きなタイトルと重ならない) */
@media (max-width: 400px) {
  [data-site-bar] { gap: 6px; }
  [data-site-bar] > h1 { white-space: normal; word-break: keep-all; line-height: 1.25; }
  .site-float { position: static; align-self: flex-start; margin: 0 0 10px; }
}
@media print { .site-home { display: none; } }`;
  document.head.append(css);

  const home = document.createElement("a");
  home.className = "site-home";
  home.href = top;
  home.title = "トップへ";
  home.innerHTML = "<span>あめちゃん</span><span>もの置き</span>";

  const bar = document.querySelector("[data-site-bar]");
  if (bar) bar.prepend(home);
  else {
    home.classList.add("site-float");
    document.body.prepend(home); // スマホでは浮かせないので、ページのいちばん上に入れておく
  }
})();
