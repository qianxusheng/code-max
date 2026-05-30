---
description: Update CLAUDE.md and/or README.md to match the current codebase
argument-hint: "[optional: 'claude' or 'readme' to limit scope, or a hint]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Edit, Write, Glob, Grep
---

Update the project docs so they match reality. `CLAUDE.md` and `README.md` have
**different audiences** — never copy one into the other:

- **CLAUDE.md** — instructions for the coding agent: architecture, conventions,
  invariants, what is built vs. intended vs. deliberately skipped. Written as
  *directives*.
- **README.md** — onboarding for a human: what it is, install, commands, a short
  layout tour. Written as *prose*.

## Context (read before editing)

Recent commits:
!`git log --oneline -15`

Working tree state:
!`git status --short`

Pending diff (if any — docs may need to describe it):
!`git diff`

User's scope/intent hint (may be empty): $ARGUMENTS

## Your task

1. **Establish ground truth.** Read the current `CLAUDE.md` (and `README.md` —
   use Glob to confirm it exists; if not, offer to create one). Spot-check the
   docs against reality: do the folders/files they name still exist? Did
   `package.json` scripts change? Did a "not built yet" item get built? Verify
   with Glob/Grep — don't trust stale prose.
2. **Decide scope and state it first.** Say which doc(s) you'll touch and the
   specific edits, before making them. If the hint says `claude` or `readme`,
   limit to that. If only one audience is affected, skip the other and say so.
3. **Edit surgically.** Prefer `Edit` over rewriting; change only what's now
   wrong and match the existing voice and heading style.
   - Keep CLAUDE.md's numbered design principles and invariants intact unless
     the design genuinely changed — if it did, update them *and* flag it.
   - Move finished features out of "not built yet" into the right section.
   - README stays short: title + one-liner, install, the *real* commands (from
     `package.json`, don't invent), brief layout tour. No internals.
   - Keep both about *what and why*, never a changelog of *how*.
4. **Verify and report.** Confirm every command exists and every path resolves.
   Summarize what changed and why. Do NOT commit — leave that to `/commit`.
