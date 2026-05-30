---
name: extract-skill
description: >
  Spot repeatable work and turn it into a reusable skill or command. Use when
  the user asks "what should I make a skill for", wants to capture a workflow
  they keep repeating, or asks to create a skill/command. May also be offered
  proactively when the SAME multi-step task has recurred several times in a
  session — but only then, not for one-offs.
allowed-tools: Bash(git log:*), Bash(git status:*), Read, Glob, Grep, Write, Edit
---

# Extract a skill from repeatable work

The job is **judgment first, scaffolding second**. Most things people ask to
"make a skill for" should not be skills. Your value is filtering hard, then
producing one tight artifact — not generating a pile of shovelware skills.

## The test: is this skill-worthy?

A candidate qualifies only if **all** hold:

1. **It's a method, not a topic.** "Teach me TypeScript" is a topic — it has no
   fixed procedure. "Explain a symbol grounded in repo code, why-first, ending
   with a check question" is a method. If you can't write down the steps, it's
   not a skill.
2. **It actually repeats.** It has happened ≥3 times, or the user states it
   clearly recurs. One-offs and "might be handy someday" do not qualify.
3. **Packaging buys something.** Either it saves real effort each time, or it
   enforces consistency (same structure/quality every run). If doing it inline
   is just as good, say so and don't make a skill.

If a candidate fails any of these, **recommend against it** and explain why.
Declining is a valid, common outcome.

## Where to look for candidates

- `git log --oneline -30` — what kinds of tasks recur (lots of similar
  refactors? a release dance? doc syncs?).
- Existing tooling: read `.claude/commands/*.md` and `.claude/skills/*/SKILL.md`.
  Don't duplicate or overlap with what exists — extend instead.
- The conversation itself: what has the user asked you to do more than once,
  with the same shape each time?
- Ask the user to name a workflow they repeat, if signals are thin.

## Skill vs. command vs. neither

Decide deliberately and tell the user which and why:

- **Command** (`.claude/commands/<name>.md`) — runs ONLY when the user types
  `/name`. Choose this when the work is user-initiated and they want control
  over when it fires (most cases). Can pre-load context with `!`shell`` and take
  `$ARGUMENTS`.
- **Skill** (`.claude/skills/<name>/SKILL.md`) — model-discoverable; Claude may
  invoke it on its own when a task matches the `description`. Choose this ONLY
  when proactive/automatic triggering is the point. Scope the `description`
  tightly so it doesn't fire constantly.
- **Neither** — the honest answer when the test above fails.

## Procedure

1. Gather candidates from the sources above.
2. Run each through the test. Keep only what passes; note what you rejected and
   why.
3. For survivors, classify skill vs. command, and draft: a name (kebab-case), a
   precise `description` (this is what triggers a skill — make it specific), and
   the step-by-step body.
4. **Show the shortlist to the user and get approval before writing anything.**
   Propose few, high-value items, not a buffet.
5. Scaffold each approved one:
   - Match the repo's existing frontmatter style (see `commit.md`,
     `update-docs.md`).
   - Body in the project's voice: directive, why-first, concrete steps.
   - Ground it in how the user *actually* does the task — read the real code or
     past examples; don't invent a generic template.
6. Do NOT commit — leave that to `/commit`. Summarize what you created and what
   you chose not to.
