// /ok(作業の了承)のしくみ。docs/Base.md の「了承と作業の終わりの確認」。
// node .claude/hooks/task.js <mode>
//   prompt : UserPromptSubmit の Hook。ユーザーが /ok と打ったら「作業中」の目印を作る(ファイルの今の状態も覚える)
//   gate   : PreToolUse(Edit / Write)の Hook。目印が無いのに、このフォルダーのファイルを書き換えようとしたら止める
//   shell  : PreToolUse(Bash / PowerShell)の Hook。AI が自分で目印を作る・消すのを止める
//   stop   : Stop の Hook。目印が残ったまま終わろうとしたら、1回だけ止めて確認させる
//   check  : AI が実行。作業中に変えたファイルを見て、md・Backlog.md・最終更新 の直し忘れを出す
//   done   : AI が実行。check が通ったら目印を消す(--review "見つけた・後回しにしたこと" が要る。--skip "理由" で警告を飛ばす)
//   wait   : AI が実行。作業の途中でユーザーに質問するとき、1回だけ止めずに終われるようにする
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, "..", ".."));
const STATE_DIR = path.join(ROOT, ".claude", "state");
const STATE = path.join(STATE_DIR, "task.json");
const CODE_EXT = new Set([".html", ".js", ".css", ".gs"]);
// 進捗・やることを書く見出し(ここが変わったら Backlog.md も見直す)
const TODO_HEADING = /次|候補|やりたい|未対応|進捗|やること/;

// コードのファイル → そのページの md(上から順に、最初に合ったもの)
const DOC_MAP = [
  [/^profile(\.html|_api\.gs)$/, "docs/Chara_1.md"],
  [/^coupling(\.html|_api\.gs)$/, "docs/Chara_2.md"],
  [/^characa\/(frame-editor\.|symbol-editor\.html)/, "docs/CharacterCard_frameEditor.md"],
  [/^characa\/tools\/icon-maker\.html$/, "docs/svgCreate.md"],
  [/^characa\//, "docs/CharacterCard.md"],
  [/^ui\/layer-drawer\./, "docs/Tools.md"],
  [/^(ui-kit\.html|ui-maker\.html|ui\/)/, "docs/htmlParts.md"],
  [/^dot-maker\.html$/, "docs/dotMaker.md"],
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

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return null;
  }
}

function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state));
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

function changedFiles(state) {
  const now = snapshot();
  const files = new Set([...Object.keys(state.hashes), ...Object.keys(now.hashes)]);
  const changed = [...files].filter((f) => state.hashes[f] !== now.hashes[f]).sort();
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

function check(state) {
  const { changed, now } = changedFiles(state);
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

const mode = process.argv[2];

if (mode === "prompt") {
  const data = readStdin();
  if (/^\s*\/ok(\s|$)/.test(data.prompt || "")) {
    const { hashes, docs } = snapshot();
    saveState({ startedAt: new Date().toISOString(), hashes, docs, waiting: false });
    output({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "/ok を受け取り、作業中の目印を作りました。書き換えてよい状態です。終わったら node .claude/hooks/task.js done --review \"…\" で確認してください。"
      }
    });
  }
} else if (mode === "gate") {
  const data = readStdin();
  const file = (data.tool_input || {}).file_path || "";
  if (!file || !inProject(file)) process.exit(0);
  let reason = "";
  if (rel(file).startsWith(".claude/state/")) {
    reason = "作業中の目印(.claude/state/)は、AI が直接さわってはいけません。";
  } else if (!loadState()) {
    reason = "まだ了承(/ok)がありません。何をどう直すかを伝えて、ユーザーに /ok を打ってもらってから書き換えてください(docs/Base.md の「了承と作業の終わりの確認」)。";
  }
  if (reason) {
    output({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
  }
} else if (mode === "shell") {
  const data = readStdin();
  const cmd = (data.tool_input || {}).command || "";
  if (/\.claude[\\/]+state|task\.js["']?\s+prompt/.test(cmd)) {
    output({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "作業中の目印は、ユーザーの /ok でだけ作られます。AI が作る・消すことはできません(消すのは node .claude/hooks/task.js done)。"
      }
    });
  }
} else if (mode === "stop") {
  const data = readStdin();
  const state = loadState();
  if (!state) process.exit(0);
  if (state.waiting) {
    state.waiting = false;
    saveState(state);
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
} else if (mode === "wait") {
  const state = loadState();
  if (!state) {
    console.log("作業中ではありません(/ok がまだ)。");
  } else {
    state.waiting = true;
    saveState(state);
    console.log("質問の返事待ちにしました。この回は止めずに終われます。");
  }
} else if (mode === "check" || mode === "done") {
  const state = loadState();
  if (!state) {
    console.log("作業中ではありません(/ok がまだ)。");
    process.exit(0);
  }
  const { changed, warnings } = check(state);
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
    fs.rmSync(STATE, { force: true });
    console.log(`\n確認が済みました。目印を消しました。\n見つけた・後回しにしたこと:${review}`);
    if (skip) console.log(`直さなかった理由:${skip}`);
  }
} else {
  console.log("使い方:node .claude/hooks/task.js check | done --review \"…\" [--skip \"…\"] | wait");
}
