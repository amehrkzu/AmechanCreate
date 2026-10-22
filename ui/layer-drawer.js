"use strict";
// ツールのレイヤーのサイドバー(左から前面に出てくる引き出し)の出し入れ
//   このサイトのツールは、レイヤーの一覧を必ずこのサイドバーに置く。ui/layer-drawer.css と一緒に読み込む。
//   HTML(<body> の中、ほかの部品の外):
//     <aside class="layer-drawer" id="layerDrawer" aria-label="レイヤー">
//       <section class="box"><h2>レイヤー</h2> …一覧… </section>
//       <button type="button" class="layer-handle" id="layerHandle" aria-controls="layerDrawer" aria-expanded="false">☂ レイヤー</button>
//     </aside>
//   ・開いているかは、そのタブを開いている間だけ覚える(閉じて開きなおすと、閉じた状態に戻る)
//   ・上の帯(.top)の高さに合わせて、引き出しの上の位置をそろえる
// 右の「詳細」の列も、狭い画面では右から出る引き出し(<aside class="right-drawer" id="rightDrawer"> の中に列と
//   <button class="right-handle" id="rightHandle">✿ 詳細</button>)。出し入れは同じ仕組み
//   スマホでスクロールしてしまうときは、列の前に
//   <div class="right-tabs" role="tablist"><button type="button" role="tab" data-tab="a" style="--c:#bdeccd">名前</button>…</div>
//   を置き、箱に data-panel="a" を付ける(狭い画面だけ、キャラカと同じ付箋タブになる。--c はタブの色)
(() => {
  const drawer = document.getElementById("rightDrawer");
  const handle = document.getElementById("rightHandle");
  if (!drawer || !handle) return;
  const KEY = "rightDrawer:" + location.pathname.split("/").pop();
  const set = (open) => {
    drawer.classList.toggle("open", open);
    handle.setAttribute("aria-expanded", String(open));
    handle.title = open ? "詳細をしまう" : "詳細を出す";
    try { sessionStorage.setItem(KEY, open ? "1" : "0"); } catch {}
  };
  handle.addEventListener("click", () => set(!drawer.classList.contains("open")));
  let open = false;
  try { open = sessionStorage.getItem(KEY) === "1"; } catch {}
  set(open);

  // スマホのときの、詳細の中の付箋タブ(<div class="right-tabs"><button data-tab="a">…</div> と、箱の data-panel="a")
  const tabs = drawer.querySelectorAll(".right-tabs > [data-tab]");
  const paper = drawer.querySelector(".right-tabs + *");
  const show = (key) => {
    tabs.forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.tab === key));
      if (b.dataset.tab === key && paper) paper.style.setProperty("--tab-c", b.style.getPropertyValue("--c"));
    });
    drawer.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("on", p.dataset.panel === key));
  };
  tabs.forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));
  if (tabs.length) show(tabs[0].dataset.tab);
})();
(() => {
  const drawer = document.getElementById("layerDrawer");
  const handle = document.getElementById("layerHandle");
  if (!drawer || !handle) return;
  const KEY = "layerDrawer:" + location.pathname.split("/").pop();

  const set = (open) => {
    drawer.classList.toggle("open", open);
    handle.setAttribute("aria-expanded", String(open));
    handle.title = open ? "レイヤーをしまう" : "レイヤーを出す";
    try {
      sessionStorage.setItem(KEY, open ? "1" : "0");
    } catch {}
  };
  handle.addEventListener("click", () => set(!drawer.classList.contains("open")));
  let open = false;
  try {
    open = sessionStorage.getItem(KEY) === "1";
  } catch {}
  set(open);

  const top = document.querySelector(".top");
  const fit = () => document.documentElement.style.setProperty("--top-h", `${top ? top.offsetHeight : 49}px`);
  fit();
  if (top && window.ResizeObserver) new ResizeObserver(fit).observe(top);
})();
