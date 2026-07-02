#!/usr/bin/env node
/**
 * handoff-doc :: nudge.js
 *
 * UserPromptSubmit hook. Tracks prompt count per session and injects a
 * targeted tagging nudge into Claude's context when either:
 *   (a) a signal word appears in the user's prompt (decided, bug, issue,
 *       approach, going to, fixed, switching, breaking, blocked), OR
 *   (b) NUDGE_INTERVAL prompts have passed since the last nudge.
 *
 * The nudge is a systemMessage — it appears in Claude's context for that
 * turn only, not in the visible conversation, and does NOT persist or
 * accumulate. Zero context bloat.
 *
 * State is tracked in .claude/handoff-nudge-state.json (one file per
 * project, keyed by session_id so it resets cleanly each session).
 */

const fs = require("fs");
const path = require("path");

const NUDGE_INTERVAL = 8;   // nudge every N prompts if no signal words
const MIN_GAP = 3;          // never nudge twice within this many prompts
const SIGNAL_WORDS = [
  "decided", "decision", "going to", "switching", "changed",
  "bug", "broken", "issue", "fixed", "breaking",
  "approach", "instead", "blocked", "next step", "plan",
];

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function loadState(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function saveState(statePath, state) {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // state write failure is non-fatal
  }
}

function hasSignalWord(prompt) {
  const lower = (prompt || "").toLowerCase();
  return SIGNAL_WORDS.some((w) => lower.includes(w));
}

function shouldNudge(sessionState, promptCount) {
  const lastNudge = sessionState.last_nudge_at || 0;
  const gap = promptCount - lastNudge;
  if (gap < MIN_GAP) return false;
  return true;
}

const NUDGE_MESSAGE = `\
If this turn involves a concrete decision, bug, or next step, please emit a \
tagged line on its own (e.g. "DECISION: chose X over Y because Z", \
"BUG: root cause is Y", "NEXT: implement X before Y"). Include what was \
rejected or why where relevant — vague tags like "DECISION: ok" are not useful. \
Only tag things worth carrying into the next session. Skip this if nothing \
notable happened.`;

function main() {
  const input = readStdin();
  const {
    session_id: sessionId = "unknown",
    user_prompt: userPrompt = "",
    cwd,
  } = input;

  const projectDir =
    cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const statePath = path.join(
    projectDir,
    ".claude",
    "handoff-nudge-state.json"
  );

  const allState = loadState(statePath);

  // Reset state if this is a new session
  if (!allState[sessionId]) {
    allState[sessionId] = { prompt_count: 0, last_nudge_at: 0 };
  }
  const sessionState = allState[sessionId];
  sessionState.prompt_count = (sessionState.prompt_count || 0) + 1;
  const promptCount = sessionState.prompt_count;

  const signalFound = hasSignalWord(userPrompt);
  const intervalDue = promptCount % NUDGE_INTERVAL === 0;
  const willNudge =
    (signalFound || intervalDue) && shouldNudge(sessionState, promptCount);

  if (willNudge) {
    sessionState.last_nudge_at = promptCount;
  }

  saveState(statePath, allState);

  if (willNudge) {
    console.log(JSON.stringify({ systemMessage: NUDGE_MESSAGE }));
  }

  process.exit(0);
}

main();
