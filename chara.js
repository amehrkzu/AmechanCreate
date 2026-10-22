"use strict";
// キャラ紹介(profile.html)と関係辞典(coupling.html)で使う処理。ui/util.js(esc)を先に読み込んでおく

// Apps Script からデータを取る。apiUrl が空ならサンプルデータ
async function loadData(apiUrl, sample) {
  if (!apiUrl) return sample;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// 名前の1文字目(顔アイコンの画像が無いとき・読めないときに出す)
function initial(name) {
  return esc([...name][0] || "?");
}

// root の中の顔アイコン(img.avatar)の読み込みに失敗したら、イニシャル表示に差し替える
function attachAvatarFallback(root) {
  root.querySelectorAll("img.avatar").forEach((img) => {
    img.addEventListener("error", () => {
      const div = document.createElement("div");
      div.className = "avatar";
      div.textContent = img.dataset.initial;
      img.replaceWith(div);
    }, { once: true });
  });
}
