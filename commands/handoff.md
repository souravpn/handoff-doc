---
description: Generate a handoff markdown doc summarizing this session's decisions, files touched, bugs, and next steps — written by Claude, not just heuristics.
---

Write a session handoff document and save it to `.claude/handoffs/HANDOFF_<ISO-timestamp>.md` (create the directory if needed), then also overwrite `.claude/handoffs/LATEST.md` with the same content.

Base it on this conversation. Use this structure:

```
# Session Handoff

- Generated: <ISO timestamp>
- Working directory: <cwd>

## Session goal
What was this session trying to accomplish, in 1-3 sentences.

## Decisions
Bullet list of concrete decisions made and why (architecture, naming, approach, trade-offs accepted).

## Bugs / issues surfaced
Bullet list of bugs found or diagnosed, with root cause if known.

## Next steps
Concrete, ordered next actions — specific enough that a fresh session (or a different tool/person) could start immediately.

## Files touched
List of files created or edited this session, each with a one-line note on what changed.

## Open questions
Anything unresolved that needs a decision before continuing.
```

Be concise and concrete — this doc exists so a future session can resume without re-reading the whole transcript. Skip sections with nothing to report rather than padding them. After writing the file, tell me the path and give me a 2-3 sentence summary, nothing else.
