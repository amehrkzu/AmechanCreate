// FF14 キャラカ用 Lodestone 取得 Worker(Cloudflare Workers)
//   GET /?id={LodestoneID}   → キャラ情報 JSON(文字情報のみ。キャラ画像は使う人のスクショを使う)

// カードを置くサイトのオリジン。GitHub Pages の URL が決まったら書き換える
const ALLOWED_ORIGINS = [
  "https://<user>.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const LODESTONE = "https://jp.finalfantasyxiv.com/lodestone/character";
const CACHE_SECONDS = 600; // 同じIDは10分キャッシュして Lodestone へのアクセスを減らす

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405, cors);

    // キャッシュは CORS ヘッダ無しで保存し、返すときに付ける
    const cache = caches.default;
    const cacheKey = new Request(url.toString());
    const hit = await cache.match(cacheKey);
    if (hit) return withHeaders(hit, cors);

    const res = await character(url.searchParams.get("id"));

    if (res.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return withHeaders(res, cors);
  },
};

async function character(id) {
  if (!/^\d{1,10}$/.test(id ?? "")) return json({ error: "invalid id" }, 400);

  const [main, jobs] = await Promise.all([
    lodestone(`${LODESTONE}/${id}/`),
    lodestone(`${LODESTONE}/${id}/class_job/`),
  ]);
  if (!main.ok) return json({ error: main.status === 404 ? "not found" : `lodestone ${main.status}` }, main.status === 404 ? 404 : 502);

  const data = parseProfile(await main.text());
  data.id = id;
  data.levels = jobs.ok ? parseLevels(await jobs.text()) : [];
  return json(data, 200, { "Cache-Control": `max-age=${CACHE_SECONDS}` });
}

function lodestone(url) {
  return fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ja" } });
}

function parseProfile(html) {
  const pick = (re) => clean(html.match(re)?.[1]);

  // 「種族/部族/性別」「誕生日」などは title と値の組で並んでいる
  const blocks = {};
  for (const m of html.matchAll(/character-block__title">([^<]*)<\/p>\s*<p class="character-block__(?:name|birth)">([\s\S]*?)<\/p>/g)) {
    blocks[clean(m[1])] = m[2];
  }
  const [race = "", tribeGender = ""] = (blocks["種族/部族/性別"] ?? "").split(/<br\s*\/?>/);
  const [tribe = "", gender = ""] = tribeGender.split("/");
  const [grandCompany = "", grandCompanyRank = ""] = (blocks["所属グランドカンパニー"] ?? "").split("/");

  const world = pick(/frame__chara__world">[\s\S]*?<\/i>([^<]*)/);
  const [, server = world, dataCenter = ""] = world.match(/^(.*?)\s*\[(.*)\]$/) ?? [];

  const intro = pick(/character__selfintroduction">([\s\S]*?)<\/div>/);

  return {
    name: pick(/frame__chara__name">([^<]*)/),
    title: pick(/frame__chara__title">([^<]*)/),
    server,
    dataCenter,
    race: clean(race),
    tribe: clean(tribe),
    gender: clean(gender),
    birthday: clean(blocks["誕生日"]),
    guardian: clean(blocks["守護神"]),
    hometown: clean(blocks["開始都市"]),
    grandCompany: clean(grandCompany),
    grandCompanyRank: clean(grandCompanyRank),
    freeCompany: pick(/character__freecompany__name">[\s\S]*?<h4><a[^>]*>([^<]*)/),
    selfIntroduction: intro === "未設定" ? "" : intro,
  };
}

// 未習得のジョブは level が "-"
function parseLevels(html) {
  const levels = [];
  for (const m of html.matchAll(/character__job__level">([^<]*)<\/div>\s*<div class="character__job__name[^>]*>([^<]*)<\/div>/g)) {
    levels.push({ name: clean(m[2]), level: clean(m[1]) });
  }
  return levels;
}

// <br> は改行に、その他のタグは除去し、HTML エンティティを戻す
function clean(s) {
  return (s ?? "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = { "Access-Control-Allow-Methods": "GET, OPTIONS", Vary: "Origin" };
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function withHeaders(res, headers) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}
