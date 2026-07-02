# handoff-doc

A Claude Code plugin that closes the context gap between sessions. It auto-generates a handoff markdown doc when a session ends, injects it silently at the next session start, and nudges Claude mid-session to tag decisions and bugs so the auto-doc actually captures what matters.

## How it works

```
During session
  UserPromptSubmit hook (nudge.js)
    → every ~8 prompts, or when signal words detected ("decided", "bug", "switching"...)
    → silently injects a systemMessage asking Claude to tag notable events
    → Claude emits: DECISION: ..., BUG: ..., NEXT: ..., NOTE: ...
    → these stay in the transcript, zero extra context bloat

Session ends
  SessionEnd hook (generate-handoff.js)
    → parses transcript: extracts tagged lines, files touched, git state
    → writes .claude/handoffs/HANDOFF_<timestamp>.md
    → overwrites .claude/handoffs/LATEST.md

Next session starts
  SessionStart hook (inject-context.js)
    → reads LATEST.md
    → injects content as additionalContext (silent, not a visible message)
    → Claude starts the session already knowing prior decisions, open bugs, next steps
```

## The /handoff command

Run `/handoff` any time — especially before ending a session on purpose. Claude synthesizes the full conversation into a clean, specific handoff doc and writes it to `LATEST.md`. This produces a far richer doc than the heuristic SessionEnd scraper, because Claude has full conversational context. The SessionEnd hook is a safety net for sessions you forget to close out; `/handoff` is the primary quality mechanism.

## Tagging convention

The nudge hook teaches this, but you can also ask Claude manually or tag lines yourself:

```
DECISION: chose server-side OAuth state over sessionStorage — survives redirect, client storage does not
BUG: claim_pending_business RPC returns 409 when called twice — not idempotent yet
NEXT: add unique constraint on pending_oauth_business.user_id before shipping
NOTE: Haiku for classification tasks, Sonnet for rich generation — keep this split
```

Rules for good tags:
- **DECISION** lines should state what was chosen AND what was rejected and why
- **BUG** lines should state the symptom and root cause if known
- **NEXT** lines should be specific enough to start immediately with no clarifying questions
- Skip the tag if nothing notable happened — over-tagging is noise

## Install

```bash
# From the official marketplace (after submission)
claude plugin install handoff-doc@claude-plugins-official

# Directly from GitHub
claude plugin install github:souravnayak/handoff-doc

# Locally during development
claude plugin install ./handoff-doc
```

Restart Claude Code after install — hooks load at session start.

## Why no LLM call in the SessionEnd hook

`SessionEnd` can't block termination and has a short timeout. An LLM call (5-30s) would race against the session closing. The deterministic scraper exits in <100ms. If you want LLM quality in the handoff doc, run `/handoff` before ending the session — that's the right place for synthesis, not a lifecycle hook.

## Why no API key needed

The UserPromptSubmit nudge is a `command`-type hook (pure Node, no model call). The SessionStart injection is also a `command`-type hook (reads a file, outputs JSON). Neither calls the Anthropic API directly. `/handoff` uses Claude Code's internal model access — covered by your Claude plan, no separate API key required.

## File structure

```
handoff-doc/
├── .claude-plugin/
│   └── plugin.json            # marketplace metadata
├── hooks/
│   └── hooks.json             # wires all three hooks
├── scripts/
│   ├── generate-handoff.js    # SessionEnd: deterministic transcript scraper
│   ├── inject-context.js      # SessionStart: reads LATEST.md → additionalContext
│   └── nudge.js               # UserPromptSubmit: rare-trigger tagging nudge
└── commands/
    └── handoff.md             # /handoff: on-demand LLM synthesis command
```

## Context impact

| Hook | Context added per session | Accumulates? |
|---|---|---|
| SessionStart inject | One LATEST.md (≤8K chars, ~2K tokens) | No — injected once at start |
| UserPromptSubmit nudge | One systemMessage (~60 tokens) | No — ephemeral per turn, only when triggered |
| Tagged lines in transcript | ~10-30 tokens per tag | Only as many as Claude emits |

## License

MIT
