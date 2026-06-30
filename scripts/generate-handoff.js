#!/usr/bin/env node
/**
 * handoff-doc :: generate-handoff.js
 *
 * Runs as a SessionEnd command hook. Reads the session transcript (JSONL),
 * pulls out a deterministic summary (files touched, prompts, tagged notes,
 * git state) and writes a timestamped markdown handoff file plus a LATEST.md
 * pointer. Never calls an LLM and never blocks session exit — failures are
 * swallowed so a broken hook can't break Claude Code.
 *
 * Tagging convention (optional, but makes output much richer): anywhere in
 * the session, write a line like:
 *   DECISION: switched AICopilot to the Claude API gateway
 *   BUG: sessionStorage doesn't survive OAuth redirect
 *   NEXT: implement claim_pending_business RPC
 * and this script will pull those lines into the relevant section.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function safeExec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function readTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed lines (e.g. partial writes)
    }
  }
  return entries;
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function extractToolUses(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b && b.type === "tool_use");
}

function collectSessionData(entries) {
  const filesTouched = new Set();
  const userPrompts = [];
  const taggedLines = { DECISION: [], BUG: [], NEXT: [], NOTE: [] };
  const tagPattern = /^(DECISION|BUG|NEXT|NOTE):\s*(.+)$/;

  for (const entry of entries) {
    const msg = entry.message || entry;
    if (!msg || !msg.role) continue;

    const text = extractText(msg.content);

    if (msg.role === "user" && text) {
      userPrompts.push(text.slice(0, 300));
    }

    if (text) {
      for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        const match = line.match(tagPattern);
        if (match) {
          taggedLines[match[1]].push(match[2].trim());
        }
      }
    }

    if (msg.role === "assistant") {
      for (const toolUse of extractToolUses(msg.content)) {
        const input = toolUse.input || {};
        const filePath = input.file_path || input.path || input.notebook_path;
        if (filePath) filesTouched.add(filePath);
      }
    }
  }

  return { filesTouched: [...filesTouched], userPrompts, taggedLines };
}

function gitState(cwd) {
  if (!cwd || !fs.existsSync(path.join(cwd, ".git"))) return null;
  return {
    branch: safeExec("git rev-parse --abbrev-ref HEAD", cwd),
    lastCommit: safeExec("git log -1 --oneline", cwd),
    diffStat: safeExec("git diff --stat HEAD", cwd),
    statusShort: safeExec("git status --short", cwd),
  };
}

function formatList(items, emptyText) {
  if (!items || items.length === 0) return `_${emptyText}_`;
  return items.map((i) => `- ${i}`).join("\n");
}

function buildMarkdown({ sessionId, reason, cwd, data, git, startedAt }) {
  const now = new Date().toISOString();
  const { filesTouched, userPrompts, taggedLines } = data;

  const firstPrompt = userPrompts[0] || "_(no user prompt captured)_";
  const lastPrompt = userPrompts[userPrompts.length - 1] || "_(no user prompt captured)_";

  let md = `# Session Handoff\n\n`;
  md += `- **Generated:** ${now}\n`;
  md += `- **Session ID:** ${sessionId || "unknown"}\n`;
  md += `- **End reason:** ${reason || "unknown"}\n`;
  md += `- **Working directory:** ${cwd || "unknown"}\n`;
  if (git) {
    md += `- **Git branch:** ${git.branch || "n/a"}\n`;
    md += `- **Last commit:** ${git.lastCommit || "n/a"}\n`;
  }
  md += `- **Prompts this session:** ${userPrompts.length}\n\n`;

  md += `## Session goal\n\n**Opened with:** ${firstPrompt}\n\n**Ended with:** ${lastPrompt}\n\n`;

  md += `## Decisions\n\n${formatList(taggedLines.DECISION, "No DECISION: lines tagged this session")}\n\n`;
  md += `## Bugs / issues surfaced\n\n${formatList(taggedLines.BUG, "No BUG: lines tagged this session")}\n\n`;
  md += `## Next steps\n\n${formatList(taggedLines.NEXT, "No NEXT: lines tagged this session")}\n\n`;
  md += `## Notes\n\n${formatList(taggedLines.NOTE, "No NOTE: lines tagged this session")}\n\n`;

  md += `## Files touched\n\n${formatList(filesTouched.map((f) => `\`${f}\``), "No file edits detected")}\n\n`;

  if (git) {
    md += `## Working tree at session end\n\n`;
    md += "```\n" + (git.statusShort || "(clean)") + "\n```\n\n";
    if (git.diffStat) {
      md += "```\n" + git.diffStat + "\n```\n\n";
    }
  }

  md += `## How to use this doc\n\nThis file was auto-generated by the **handoff-doc** plugin's SessionEnd hook. `;
  md += `Tag lines with \`DECISION:\`, \`BUG:\`, \`NEXT:\`, or \`NOTE:\` during a session (in your prompts or ask Claude to emit them) `;
  md += `to populate the sections above automatically. Paste this file into the next session, a CLI handoff, or a teammate's context.\n`;

  return md;
}

function main() {
  const input = readStdin();
  const { session_id: sessionId, transcript_path: transcriptPath, cwd, reason } = input;

  const entries = readTranscript(transcriptPath);
  const data = collectSessionData(entries);
  const git = gitState(cwd);

  const md = buildMarkdown({ sessionId, reason, cwd, data, git });

  const outDir = path.join(cwd || ".", ".claude", "handoffs");
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outFile = path.join(outDir, `HANDOFF_${stamp}.md`);
    fs.writeFileSync(outFile, md, "utf8");
    fs.writeFileSync(path.join(outDir, "LATEST.md"), md, "utf8");
  } catch {
    // Never block session exit on a write failure.
  }

  // SessionEnd hooks can't block termination; exit 0 regardless.
  process.exit(0);
}

main();
