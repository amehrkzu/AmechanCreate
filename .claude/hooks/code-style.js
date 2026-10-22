// コード規約(docs/Base.md の「コード規約」)の見張り。
// AI が .html / .js / .css を書き換える直前(PreToolUse)に呼ばれ、
// 新しく書く行だけを調べて、反していたら書き換えを止める(今ある行は見ない)。
"use strict";

const fs = require("fs");
const path = require("path");

const TARGET_EXT = new Set([".html", ".js", ".css"]);
// 画面の幅の切り替え点(@media の min-width / max-width)に使ってよい値
const ALLOWED_WIDTHS = new Set(["1000", "999.98", "400", "360"]);
// 状態のクラスは .on / .open / .is-disabled だけ。これらは使わない
const BANNED_STATE = "selected|active|shown|is-active|is-selected";
const HANDLER_EVENTS = "click|dblclick|contextmenu|load|error|input|change|submit|keydown|keyup|keypress|focus|blur|scroll|resize|wheel|paste|drop|drag\\w*|pointer\\w*|mouse\\w*|touch\\w*|message";
const MOUSE_TOUCH = "mousedown|mousemove|mouseup|mouseenter|mouseleave|mouseover|mouseout|touchstart|touchmove|touchend|touchcancel";

const RULES = [
  {
    name: "var は使わない(const / let にする)",
    test: (line) => /(^|[^\w$.])var\s+[A-Za-z_$]/.test(line)
  },
  {
    name: "イベントは addEventListener で付ける(onclick= や el.onclick = にしない)",
    test: (line) =>
      new RegExp(`\\son(${HANDLER_EVENTS})\\s*=\\s*["']`, "i").test(line) ||
      new RegExp(`\\.on(${HANDLER_EVENTS})\\s*=(?!=)`).test(line)
  },
  {
    name: "ドラッグなどは pointer イベントにする(mouse / touch イベントは使わない)",
    // 長押しドラッグ中にスクロールを止める touchmove(passive: false)は pointer ではできないので通す
    test: (line) => {
      if (/["'`]touchmove["'`]/.test(line) && (/passive\s*:\s*false/.test(line) || /removeEventListener/.test(line))) return false;
      return new RegExp(`["'\`](${MOUSE_TOUCH})["'\`]`).test(line);
    }
  },
  {
    name: "状態のクラスは .on / .open / .is-disabled だけ",
    test: (line, ext) => {
      if (new RegExp(`classList\\.(add|remove|toggle|contains|replace)\\([^)]*["'](${BANNED_STATE})["']`).test(line)) return true;
      if (new RegExp(`class\\s*=\\s*["'][^"']*\\b(${BANNED_STATE})\\b`).test(line)) return true;
      // CSS のセレクター(.css の行か、HTML の <style> の中らしい行)
      const selector = new RegExp(`\\.(${BANNED_STATE})(?![\\w-])`);
      if (ext === ".css") return selector.test(line) && !/^\s*(\/\*|\*)/.test(line);
      return /^[^=;()"'`]*[{,]\s*$/.test(line) && selector.test(line);
    }
  },
  {
    name: "画面の幅の切り替え点は 1000px(999.98px)・400px・360px",
    test: (line) => {
      if (!/@media/.test(line)) return false;
      const widths = [...line.matchAll(/(?:min|max)-width\s*:\s*([\d.]+)px/g)].map((m) => m[1]);
      return widths.some((w) => !ALLOWED_WIDTHS.has(w));
    }
  },
  {
    name: "字下げは2スペース(タブは使わない)",
    test: (line) => /^[ ]*\t/.test(line)
  }
];

function splitLines(text) {
  return (text || "").replace(/\r\n?/g, "\n").split("\n");
}

// new の行のうち、old に無い行(新しく書く行)だけを返す
function addedLines(oldText, newText) {
  const old = new Set(splitLines(oldText).map((l) => l.trimEnd()));
  return splitLines(newText).filter((l) => l.trim() !== "" && !old.has(l.trimEnd()));
}

function collect(toolName, input) {
  if (toolName === "Edit") return addedLines(input.old_string, input.new_string);
  if (toolName === "MultiEdit") {
    return (input.edits || []).flatMap((e) => addedLines(e.old_string, e.new_string));
  }
  if (toolName === "Write") {
    let before = "";
    try {
      before = fs.readFileSync(input.file_path, "utf8");
    } catch {
      // 新しいファイル
    }
    return addedLines(before, input.content);
  }
  return [];
}

function main(raw) {
  const data = JSON.parse(raw);
  const input = data.tool_input || {};
  const file = input.file_path || "";
  const ext = path.extname(file).toLowerCase();
  if (!TARGET_EXT.has(ext)) return;
  if (/[\\/]\.claude[\\/]/.test(file)) return;

  const problems = [];
  for (const line of collect(data.tool_name, input)) {
    for (const rule of RULES) {
      if (rule.test(line, ext)) problems.push(`- ${rule.name}\n    ${line.trim().slice(0, 160)}`);
    }
  }
  if (problems.length === 0) return;

  const reason = [
    `コード規約(docs/Base.md の「コード規約」)に反する行があるので、書き換えを止めました:${path.basename(file)}`,
    ...problems.slice(0, 20),
    problems.length > 20 ? `…ほか ${problems.length - 20} 件` : "",
    "規約に合わせて書き直してから、もう一度書き換えてください。"
  ].filter(Boolean).join("\n");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  }));
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => main(raw));
