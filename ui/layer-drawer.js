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
