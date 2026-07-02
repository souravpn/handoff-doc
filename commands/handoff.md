---
description: Synthesize this session into a clean handoff doc, write it to .claude/handoffs/LATEST.md, and give a 2-3 sentence summary.
---

Write a session handoff document. Save it to `.claude/handoffs/LATEST.md` (create the directory if needed), and also save a timestamped copy to `.claude/handoffs/HANDOFF_<ISO-timestamp>.md`.

Use this exact structure — skip any section with nothing real to report rather than padding with placeholder text:

```
# Session Handoff

- Generated: <ISO timestamp>
- Working directory: <cwd>

## Session goal
What this session was trying to accomplish, in 1-3 sentences.

## Decisions
Bullet list. For each decision: what was chosen, what was the alternative considered, and why this one. Vague bullets like "decided to fix the bug" are useless — be specific.

## Bugs / issues surfaced
Each bug: what the symptom is, what the root cause is (if known), current status (open / fixed / workaround in place).

## Next steps
Ordered. Specific enough that a fresh Claude Code session could start the first item immediately without asking clarifying questions.

## Files touched
Each file with a one-line note on what changed and why.

## Open questions
Anything that still needs a decision or more information before work can continue.
```

After writing both files, output exactly:
1. The path to LATEST.md
2. A 2-3 sentence summary of the session — nothing else.

Prioritize concision and specificity. This doc will be auto-injected into the next session's context, so every word should earn its place.
