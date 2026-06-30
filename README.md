# handoff-doc

A Claude Code plugin that automatically writes a markdown handoff document at the end of every session — summarizing decisions, files touched, bugs surfaced, and next steps — so the next session, a different CLI tool, or a teammate can resume instantly without re-reading the transcript.

This generalizes a pattern from real-world agentic workflows (e.g. bridging `claude.ai` strategy sessions and Claude Code CLI implementation sessions via a `HANDOFF.md` file).

## What it does

- **Automatic (`SessionEnd` hook):** When a Claude Code session ends, a deterministic Node script parses the session transcript and git state, then writes:
  - `.claude/handoffs/HANDOFF_<timestamp>.md` — a dated snapshot
  - `.claude/handoffs/LATEST.md` — always overwritten, for quick reference
- **On-demand (`/handoff` command):** Mid-session, run `/handoff` to have Claude itself write a richer, LLM-authored handoff doc (better prose, real synthesis) instead of the heuristic version.

## Tagging convention (optional, makes the auto-generated doc much better)

During a session, any line (yours or Claude's) formatted like this gets pulled into the relevant section of the auto-generated doc:

```
DECISION: switched AICopilot to the Claude API gateway, never client-side
BUG: sessionStorage doesn't survive OAuth redirect — loses generated business
NEXT: implement claim_pending_business Postgres function
NOTE: Haiku for classification, Sonnet for rich generation
```

You can ask Claude mid-session to "tag your key decisions with DECISION:" and it'll naturally start doing this, which makes the SessionEnd hook's output far more useful than a generic transcript summary.

## Install

```bash
claude plugin marketplace add <your-marketplace-repo>
claude plugin install handoff-doc
```

Or locally during development:

```bash
claude plugin install ./handoff-doc
```

Restart Claude Code after install — hooks load at session start.

## Why a hook instead of an LLM call inside the hook

`SessionEnd` hooks are meant to be fast and must not block session termination, so this plugin deliberately avoids an in-hook LLM call (those can take 5-30s and aren't appropriate for a blocking lifecycle hook). The hook does cheap, deterministic extraction instead. If you want LLM-quality synthesis, use `/handoff` mid-session before you end — Claude has full conversational context at that point and can write something much richer than transcript-parsing ever could.

## Files

```
handoff-doc/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json          # wires SessionEnd -> generate-handoff.js
├── scripts/
│   └── generate-handoff.js # deterministic transcript + git parser
└── commands/
    └── handoff.md           # /handoff slash command
```

## Notes / limitations

- File-touch detection relies on `tool_use` blocks for `Write`/`Edit`/notebook tools in the transcript; tools that use different input field names for paths may not be picked up — extend `collectSessionData` in `generate-handoff.js` if you hit this.
- Git section is skipped entirely if `cwd` isn't inside a git repo.
- The hook fails silently by design (never blocks session exit) — if handoff docs aren't appearing, run `claude --debug` and check the `SessionEnd` hook log.
