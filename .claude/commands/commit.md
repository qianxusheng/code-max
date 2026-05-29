---
description: Write a Conventional Commits message for staged changes and commit
argument-hint: "[optional hint about intent, e.g. 'this is a bugfix']"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*)
---

Create a high-quality git commit for the current changes.

## Context (read before writing the message)

Staged changes:
!`git diff --cached --stat`

Staged diff:
!`git diff --cached`

Unstaged changes (NOT yet staged — mention if relevant):
!`git status --short`

Recent commit style in this repo (match it):
!`git log --oneline -10`

User's hint about intent (may be empty): $ARGUMENTS

## Your task

1. If nothing is staged, stop and tell the user to `git add` first (offer to stage everything with `git add -A` if they confirm). Do NOT stage automatically.
2. Analyze the staged diff and decide the single best **Conventional Commits** message:
   - Format: `type(scope): summary`
   - Types: feat, fix, docs, refactor, test, chore, perf, build, ci, style
   - Summary: imperative mood, lowercase, no trailing period, ≤ 72 chars
   - Add a body (wrapped at ~72 cols) ONLY when the change needs the "why" explained; skip it for trivial changes.
   - Add `BREAKING CHANGE:` footer if the public API changed.
   - If the diff really contains several unrelated changes, say so and suggest splitting into multiple commits instead of one muddy message.
3. Show the proposed message to the user and commit it with `git commit -m`.

Keep the message about *what changed and why*, never *how* (the diff already shows how).
