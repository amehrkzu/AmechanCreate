// /ok(作業の了承)のしくみ。docs/Base.md の「了承と作業の終わりの確認」。
// 目印はスレッド(セッション)ごとに .claude/state/task-<セッションID>.json に作る。
// node .claude/hooks/task.js <mode>
//   prompt : UserPromptSubmit の Hook。ユーザーが /ok と打ったら「作業中」の目印を作る(ファイルの今の状態も覚える)
//            /ok unlock なら、ほかのスレッドのロックを外す
//            /ok 以外のときは、/ok のあとでユーザーが止めていたら(会話の記録で見る)目印を消す
//   gate   : PreToolUse(Edit / Write)の Hook。目印が無いのに書き換えようとしたら止める。
//            書き換えたファイルをロックし、ほかのスレッドがロック中のファイルなら止める
//   shell  : PreToolUse(Bash / PowerShell)の Hook。AI が自分で目印を作る・消すのを止める
//   stop   : Stop の Hook。目印が残ったまま終わろうとしたら、1回だけ止めて確認させる
//   check  : AI が実行。作業中に変えたファイルを見て、md・Backlog.md・最終更新 の直し忘れを出す
//   done   : AI が実行。check が通ったら目印を消す(--review "見つけた・後回しにしたこと" が要る。--skip "理由" で警告を飛ばす)
//   wait   : AI が実行。作業の途中でユーザーに質問するとき、1回だけ止めずに終われるようにする
// AI が実行するときのスレッドは、環境変数 CLAUDE_CODE_SESSION_ID で見分ける
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, "..", ".."));
const STATE_DIR = path.join(ROOT, ".claude", "state");
// 前のしくみ(全スレッドで1つ)の目印。見つけたら、最初に使ったスレッドの目印にする
const LEGACY_STATE = path.join(STATE_DIR, "task.json");
const CODE_EXT = new Set([".html", ".js", ".css", ".gs"]);
// 進捗・やることを書く見出し(ここが変わったら Backlog.md も見直す)
const TODO_HEADING = /次|候補|やりたい|未対応|進捗|やること/;
// どのスレッドも最後に書き足すので、ロックしないファイル
const NO_LOCK = new Set(["docs/Backlog.md"]);
// 最後に書き換えてからこの時間が過ぎたスレッドのロックは無視する(閉じたスレッドの残りロック)
const LOCK_HOURS = 3;

// コードのファイル → そのページの md(上から順に、最初に合ったもの)
const DOC_MAP = [
  [/^profile(\.html|_api\.gs)$/, "docs/Chara_1.md"],
  [/^coupling(\.html|_api\.gs)$/, "docs/Chara_2.md"],
  [/^chara\.js$/, "docs/Chara.md"],
  [/^characa\/(frame-editor\.|symbol-editor\.html)/, "docs/CharacterCard_frameEditor.md"],
  [/^characa\/tools\/icon-maker\.html$/, "docs/svgCreate.md"],
  [/^characa\//, "docs/CharacterCard.md"],
  [/^ui\/layer-drawer\./, "docs/Tools.md"],
  [/^(ui-kit\.html|ui-maker\.html|ui\/)/, "docs/htmlParts.md"],
  [/^dot-maker\.html$/, "docs/dotMaker.md"],
  [/^dot-convert\.html$/, "docs/dotConvert.md"],
  [/^layout-maker\.html$/, "docs/layoutMaker.md"],
  [/^raid-sim\.html$/, "docs/raidSim.md"],
  [/^download\//, "docs/Download.md"],
  [/^backlog\.html$/, "docs/BacklogView.md"],
  [/^(index|test|tshirt-designer)\.html$/, "docs/Base.md"]
];

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function stateFile(sid) {
  return path.join(STATE_DIR, `task-${String(sid).replace(/[^\w-]/g, "_")}.json`);
}

function loadState(sid) {
  if (!sid) return null;
  const file = stateFile(sid);
  if (!fs.existsSync(file) && fs.existsSync(LEGACY_STATE)) {
    try {
      fs.renameSync(LEGACY_STATE, file);
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function saveState(sid, state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile(sid), JSON.stringify(state));
}

function removeState(sid) {
  fs.rmSync(stateFile(sid), { force: true });
}

// 会話の記録(transcript)に、since よりあとで「ユーザーが止めた」があるか
function interruptedSince(transcriptPath, since) {
  let text = "";
  try {
    text = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return false;
  }
  for (const line of text.split("\n")) {
    if (!line.includes("[Request interrupted by user")) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "user" || !(entry.timestamp > since)) continue;
    const content = (entry.message || {}).content;
    const texts = typeof content === "string" ? [content] : (content || []).map((c) => (c && c.type === "text" ? c.text : ""));
    if (texts.some((t) => String(t).startsWith("[Request interrupted by user"))) return true;
  }
  return false;
}

// ほかのスレッドの目印(ロックが生きているものだけ)
function otherStates(sid) {
  let names = [];
  try {
    names = fs.readdirSync(STATE_DIR);
  } catch {
    return [];
  }
  const own = path.basename(stateFile(sid));
  const limit = Date.now() - LOCK_HOURS * 60 * 60 * 1000;
  const out = [];
  for (const name of names) {
    if (!/^task-.+\.json$/.test(name) || name === own) continue;
    try {
      const state = JSON.parse(fs.readFileSync(path.join(STATE_DIR, name), "utf8"));
      if (Date.parse(state.lastActive || state.startedAt) >= limit) out.push({ name, state });
    } catch {
      // 書きかけ・壊れた目印は無視する
    }
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, path.resolve(file)).replace(/\\/g, "/");
}

function inProject(file) {
  const r = rel(file);
  return r !== "" && !r.startsWith("..") && !path.isAbsolute(r);
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function normalize(text) {
  return text.replace(/\r\n?/g, "\n");
}

// git が知っているファイル(まだ git に入っていないものも)を、中身の指紋つきで覚える
function snapshot() {
  const list = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.startsWith(".claude/state/"));
  const hashes = {};
  const docs = {};
  for (const f of list) {
    let buf;
    try {
      buf = fs.readFileSync(path.join(ROOT, f));
    } catch {
      continue;
    }
    hashes[f] = crypto.createHash("sha1").update(buf).digest("hex");
    if (f.endsWith(".md")) docs[f] = normalize(buf.toString("utf8"));
  }
  return { hashes, docs };
}

// 変わったファイルのうち、ほかのスレッドだけが書き換えたものは外す
function changedFiles(sid, state) {
  const now = snapshot();
  const own = new Set(state.touched || []);
  const others = new Set(otherStates(sid).flatMap((o) => o.state.touched || []));
  const files = new Set([...Object.keys(state.hashes), ...Object.keys(now.hashes)]);
  const changed = [...files]
    .filter((f) => state.hashes[f] !== now.hashes[f])
    .filter((f) => own.has(f) || !others.has(f))
    .sort();
  return { changed, now };
}

// 「次の候補」などの見出しの中身だけを取り出す
function todoSections(md) {
  const out = [];
  let keep = false;
  let level = 0;
  for (const line of normalize(md || "").split("\n")) {
    const h = /^(#+)\s+(.*)$/.exec(line);
    if (h) {
      if (keep && h[1].length <= level) keep = false;
      if (!keep && TODO_HEADING.test(h[2])) {
        keep = true;
        level = h[1].length;
      }
    }
    if (keep) out.push(line.trimEnd());
  }
  return out.join("\n");
}

function check(sid, state) {
  const { changed, now } = changedFiles(sid, state);
  const warnings = [];
  const changedSet = new Set(changed);

  for (const f of changed) {
    if (f.startsWith(".claude/") || !CODE_EXT.has(path.extname(f))) continue;
    const hit = DOC_MAP.find(([re]) => re.test(f));
    if (!hit) {
      warnings.push(`${f} を変えたが、どの md に書くか決まっていない(ページを増やしたなら md を作り、task.js の DOC_MAP にも足す)`);
    } else if (!changedSet.has(hit[1])) {
      warnings.push(`${f} を変えたのに ${hit[1]} が変わっていない(画面・しくみ・進捗を直す)`);
    }
  }

  const todoChanged = changed.filter((f) => /^docs\/.+\.md$/.test(f) && f !== "docs/Backlog.md" &&
    todoSections(state.docs[f]) !== todoSections(now.docs[f]));
  const backlogChanged = changedSet.has("docs/Backlog.md");
  if (todoChanged.length > 0 && !backlogChanged) {
    warnings.push(`${todoChanged.join("・")} の「次の候補・進捗」が変わったのに docs/Backlog.md が変わっていない(足す・消す)`);
  }
  if (backlogChanged && todoChanged.length === 0) {
    warnings.push("docs/Backlog.md が変わったのに、リンク先の md の「次の候補・進捗」が変わっていない(両方に足す・消す)");
  }

  for (const f of changed) {
    if (!/^docs\/.+\.md$/.test(f) || !now.docs[f]) continue;
    if (/最終更新/.test(now.docs[f]) && !now.docs[f].includes(`最終更新:${today()}`)) {
      warnings.push(`${f} の「最終更新」が今日(${today()})になっていない`);
    }
  }
  return { changed, warnings };
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || "" : null;
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function deny(reason) {
  output({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
}

const mode = process.argv[2];

if (mode === "prompt") {
  const data = readStdin();
  const sid = data.session_id;
  const m = /^\s*\/ok(?:\s+(\S+))?/.exec(data.prompt || "");
  if (m && sid) {
    const notes = [];
    if (m[1] === "unlock") {
      for (const o of otherStates(sid)) {
        if ((o.state.touched || []).length === 0) continue;
        o.state.touched = [];
        fs.writeFileSync(path.join(STATE_DIR, o.name), JSON.stringify(o.state));
      }
      notes.push("ほかのスレッドのロックを外しました。");
    }
    const prev = loadState(sid);
    if (prev) {
      // 作業の途中でもう一度 /ok が来たときは、最初の状態とロックを引き継ぐ
      prev.lastActive = new Date().toISOString();
      prev.okAt = prev.lastActive;
      prev.waiting = false;
      saveState(sid, prev);
      notes.push("/ok を受け取りました。作業中の目印は前のまま続いています。");
    } else {
      const { hashes, docs } = snapshot();
      const nowIso = new Date().toISOString();
      saveState(sid, { startedAt: nowIso, lastActive: nowIso, okAt: nowIso, hashes, docs, touched: [], waiting: false });
      notes.push("/ok を受け取り、作業中の目印を作りました。書き換えてよい状態です。");
    }
    notes.push("終わったら node .claude/hooks/task.js done --review \"…\" で確認してください。");
    output({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: notes.join("") } });
  } else if (sid) {
    // /ok のあとでユーザーが止めていたら、了承は取り消し(書き換えたファイルはそのまま)
    const state = loadState(sid);
    if (state && interruptedSince(data.transcript_path, state.okAt || state.startedAt)) {
      removeState(sid);
      output({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "ユーザーが作業を止めたので、/ok の作業中の目印とロックを消しました(書き換えたファイルはそのまま)。続けるなら、何をどう直すかを確認の形で出して、/ok を待ってください。" } });
    }
  }
} else if (mode === "gate") {
  const data = readStdin();
  const sid = data.session_id;
  const file = (data.tool_input || {}).file_path || "";
  if (!file || !inProject(file)) process.exit(0);
  const f = rel(file);
  if (f.startsWith(".claude/state/")) {
    deny("作業中の目印(.claude/state/)は、AI が直接さわってはいけません。");
    process.exit(0);
  }
  const state = loadState(sid);
  if (!state) {
    deny("まだ了承(/ok)がありません。何をどう直すかを伝えて、ユーザーに /ok を打ってもらってから書き換えてください(docs/Base.md の「了承と作業の終わりの確認」)。");
    process.exit(0);
  }
  if (!NO_LOCK.has(f)) {
    const owner = otherStates(sid).find((o) => (o.state.touched || []).includes(f));
    if (owner) {
      deny(`${f} は別のスレッドが作業中です(ロック中)。そのスレッドが終わるのを待つか、別のファイルで作業してください。ユーザーに伝えて待つときは node .claude/hooks/task.js wait を実行してから終えてください。外してよいなら、ユーザーが /ok unlock を打つと外れます。`);
      process.exit(0);
    }
  }
  state.touched = state.touched || [];
  if (!state.touched.includes(f)) state.touched.push(f);
  state.lastActive = new Date().toISOString();
  saveState(sid, state);
} else if (mode === "shell") {
  const data = readStdin();
  const cmd = (data.tool_input || {}).command || "";
  if (/\.claude[\\/]+state|task\.js["']?\s+prompt/.test(cmd)) {
    deny("作業中の目印は、ユーザーの /ok でだけ作られます。AI が作る・消すことはできません(消すのは node .claude/hooks/task.js done)。");
  }
} else if (mode === "stop") {
  const data = readStdin();
  const sid = data.session_id;
  const state = loadState(sid);
  if (!state) process.exit(0);
  if (state.waiting) {
    state.waiting = false;
    saveState(sid, state);
    process.exit(0);
  }
  if (data.stop_hook_active) {
    output({ systemMessage: "/ok の作業の終わりの確認が、まだ済んでいません。" });
    process.exit(0);
  }
  output({
    decision: "block",
    reason: "/ok の作業中の目印が残っています。作業が終わったなら、この作業で見つけた・後回しにしたことを書き出して Backlog.md と md にあるか確かめ、node .claude/hooks/task.js done --review \"…\" を実行してから終えてください。ユーザーに質問して待つだけなら node .claude/hooks/task.js wait を実行してから終えてください。"
  });
} else if (mode === "wait" || mode === "check" || mode === "done") {
  const sid = process.env.CLAUDE_CODE_SESSION_ID;
  if (!sid) {
    console.log("スレッドが分かりません(環境変数 CLAUDE_CODE_SESSION_ID がありません)。Claude Code の中から実行してください。");
    process.exit(1);
  }
  const state = loadState(sid);
  if (!state) {
    console.log("このスレッドは作業中ではありません(/ok がまだ)。");
    process.exit(0);
  }
  if (mode === "wait") {
    state.waiting = true;
    saveState(sid, state);
    console.log("質問の返事待ちにしました。この回は止めずに終われます。");
    process.exit(0);
  }
  const { changed, warnings } = check(sid, state);
  console.log(`この作業で変えたファイル(${changed.length}):`);
  for (const f of changed) console.log(`  ${f}`);
  if (warnings.length > 0) {
    console.log("\n直し忘れかもしれないもの:");
    for (const w of warnings) console.log(`  - ${w}`);
  } else {
    console.log("\n直し忘れは見つかりませんでした。");
  }
  if (mode === "done") {
    const review = argValue("--review");
    const skip = argValue("--skip");
    if (!review) {
      console.log("\nまだ終われません:--review \"この作業で見つけた・後回しにしたこと(Backlog.md に足したもの)。無ければ なし\" を付けてください。");
      process.exit(1);
    }
    if (warnings.length > 0 && !skip) {
      console.log("\nまだ終われません:上を直すか、直さなくてよい理由を --skip \"理由\" で付けてください(理由はユーザーへの報告にも書く)。");
      process.exit(1);
    }
    removeState(sid);
    console.log(`\n確認が済みました。目印とロックを消しました。\n見つけた・後回しにしたこと:${review}`);
    if (skip) console.log(`直さなかった理由:${skip}`);
  }
} else {
  console.log("使い方:node .claude/hooks/task.js check | done --review \"…\" [--skip \"…\"] | wait");
}
