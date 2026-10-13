"use strict";
// スクショのエフェクト
//   画素を自前で計算する(ctx.filter は Safari で使えない・不安定なため。どの端末でも同じ見た目にする)
//   周辺を暗く(ビネット)・端をぼかす は、枠に合わせて描画時に app.js で重ねる

// 画像要素に持たせる項目と既定値
const FX_DEFAULTS = {
  fxPreset: "none",
  fxBrightness: 0, // -100〜100
  fxContrast: 0, // -100〜100
  fxSaturation: 0, // -100〜100
  fxTone: "none", // none / gray / sepia / duotone / part
  fxDuoDark: "@bg1", // デュオトーンの暗い側
  fxDuoLight: "@accent", // デュオトーンの明るい側
  fxPartHue: 0, // パートカラーで残す色相(0〜360)
  fxPartRange: 18, // 残す色相の幅(±度)
  fxTint: "@accent", // かぶせる色
  fxTintAmount: 0, // 0〜1
  fxTintMode: "multiply", // multiply / screen / overlay / normal
  fxVignette: 0, // 0〜1
  fxFade: 0, // 0〜1
  fxFadeSide: "all", // all / x / y / left / right / top / bottom
};
const FX_KEYS = Object.keys(FX_DEFAULTS).filter((k) => k !== "fxPreset");

const FX_PRESETS = [
  ["none", "なし", {}],
  ["cinema", "シネマ風", { fxContrast: 15, fxSaturation: -20, fxVignette: 0.55 }],
  ["vivid", "鮮やか", { fxContrast: 10, fxSaturation: 35 }],
  ["soft", "ふんわり明るく", { fxBrightness: 10, fxContrast: -15, fxSaturation: -10, fxTint: "#ffffff", fxTintMode: "screen", fxTintAmount: 0.15 }],
  ["mono", "モノクロ", { fxTone: "gray", fxContrast: 15 }],
  ["sepia", "セピア", { fxTone: "sepia", fxVignette: 0.35 }],
  ["duotone", "デュオトーン(配色の色)", { fxTone: "duotone" }],
  ["part", "パートカラー", { fxTone: "part", fxContrast: 10 }],
  ["sunset", "夕焼け", { fxTint: "#ff8a4c", fxTintMode: "multiply", fxTintAmount: 0.3, fxVignette: 0.3 }],
  ["fade", "端をぼかす", { fxFade: 0.4 }],
];

// 画素の計算が要るか(ビネット・端ぼかしだけなら要らない)
function hasPixelFx(l) {
  return !!(l.fxBrightness || l.fxContrast || l.fxSaturation || (l.fxTone && l.fxTone !== "none") || l.fxTintAmount > 0);
}

// 0〜360 の色相と 0〜1 の彩度
function hueSat(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return [0, 0];
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max === 0 ? 0 : d / max];
}

function hexRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex ?? "") ?? [, "00", "00", "00"];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// img にエフェクトをかけた canvas を返す。長い辺は maxSide まで縮める
// fx の色(fxDuoDark など)は "#rrggbb" に解決済みのものを渡す
function processPixels(img, fx, maxSide) {
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;

  const bright = 1 + fx.fxBrightness / 100;
  const contrast = 1 + fx.fxContrast / 100;
  const sat = 1 + fx.fxSaturation / 100;
  const tone = fx.fxTone;
  const dark = hexRgb(fx.fxDuoDark), light = hexRgb(fx.fxDuoLight);
  const tint = hexRgb(fx.fxTint), tintAmt = fx.fxTintAmount, mode = fx.fxTintMode;
  const hue = fx.fxPartHue, range = fx.fxPartRange, soft = Math.max(4, range * 0.35);

  const blend = (c0, t) => {
    if (mode === "screen") return 255 - ((255 - c0) * (255 - t)) / 255;
    if (mode === "overlay") return c0 < 128 ? (2 * c0 * t) / 255 : 255 - (2 * (255 - c0) * (255 - t)) / 255;
    if (mode === "normal") return t;
    return (c0 * t) / 255; // multiply
  };

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], gr = d[i + 1], b = d[i + 2];

    // 明るさ・コントラスト・彩度
    r = (r * bright - 128) * contrast + 128;
    gr = (gr * bright - 128) * contrast + 128;
    b = (b * bright - 128) * contrast + 128;
    let y = 0.299 * r + 0.587 * gr + 0.114 * b;
    if (sat !== 1) {
      r = y + (r - y) * sat;
      gr = y + (gr - y) * sat;
      b = y + (b - y) * sat;
    }

    if (tone === "gray") {
      r = gr = b = y;
    } else if (tone === "sepia") {
      const r0 = r, g0 = gr, b0 = b;
      r = 0.393 * r0 + 0.769 * g0 + 0.189 * b0;
      gr = 0.349 * r0 + 0.686 * g0 + 0.168 * b0;
      b = 0.272 * r0 + 0.534 * g0 + 0.131 * b0;
    } else if (tone === "duotone") {
      const t = Math.max(0, Math.min(1, y / 255));
      r = dark[0] + (light[0] - dark[0]) * t;
      gr = dark[1] + (light[1] - dark[1]) * t;
      b = dark[2] + (light[2] - dark[2]) * t;
    } else if (tone === "part") {
      // 選んだ色相に近いところだけ色を残し、ほかはモノクロにする
      const [ph, ps] = hueSat(Math.max(0, r), Math.max(0, gr), Math.max(0, b));
      let dist = Math.abs(ph - hue);
      if (dist > 180) dist = 360 - dist;
      const keep = (1 - smooth(range, range + soft, dist)) * smooth(0.15, 0.35, ps); // 色がうすい所(肌・グレー)は残さない
      r = y + (r - y) * keep;
      gr = y + (gr - y) * keep;
      b = y + (b - y) * keep;
    }

    if (tintAmt > 0) {
      const cr = Math.max(0, Math.min(255, r)), cg = Math.max(0, Math.min(255, gr)), cb = Math.max(0, Math.min(255, b));
      r = cr + (blend(cr, tint[0]) - cr) * tintAmt;
      gr = cg + (blend(cg, tint[1]) - cg) * tintAmt;
      b = cb + (blend(cb, tint[2]) - cb) * tintAmt;
    }

    d[i] = r;
    d[i + 1] = gr;
    d[i + 2] = b;
  }
  g.putImageData(image, 0, 0);
  return c;
}
