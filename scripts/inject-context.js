#!/usr/bin/env node
/**
 * handoff-doc :: inject-context.js
 *
 * SessionStart hook. Reads .claude/handoffs/LATEST.md from the project
 * directory and injects its content as additionalContext so Claude starts
 * the session already aware of prior state — decisions made, bugs open,
 * next steps — without the user having to re-explain anything.
 *
 * If no handoff file exists (first session, or project has never run
 * /handoff), exits silently. Never blocks session start.
 *
 * Output shape Claude Code expects for additionalContext injection:
 *   { "hookSpecificOutput": { "additionalContext": "..." } }
 */

const fs = require("fs");
const path = require("path");

const MAX_CHARS = 8000; // ~2K tokens — enough context, not a bloat risk

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function main() {
  const input = readStdin();
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const handoffPath = path.join(cwd, ".claude", "handoffs", "LATEST.md");

  if (!fs.existsSync(handoffPath)) {
    process.exit(0);
  }

  let content;
  try {
    content = fs.readFileSync(handoffPath, "utf8").trim();
  } catch {
    process.exit(0);
  }

  if (!content) {
    process.exit(0);
  }

  // Truncate gracefully at a section boundary if over limit
  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS);
    const lastSection = content.lastIndexOf("\n##");
    if (lastSection > MAX_CHARS * 0.6) {
      content = content.slice(0, lastSection);
    }
    content += "\n\n_(handoff doc truncated — run `/handoff` to regenerate a fresh one)_";
  }

  const additionalContext = [
    "## Prior session handoff",
    "",
    "The following was written at the end of your last session. Use it to resume",
    "context without re-reading the transcript. Do not recite it back — just use it.",
    "",
    content,
  ].join("\n");

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        additionalContext,
      },
    })
  );

  process.exit(0);
}

main();
