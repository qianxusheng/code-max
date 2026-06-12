import type Anthropic from "@anthropic-ai/sdk";
import { estimateTokens, type Budget } from "./budget.js";

/**
 * A real user turn (typed text), not a user message that merely carries
 * `tool_result` blocks. These are the only safe cut points: between two of them
 * every `tool_use` has its `tool_result`, so slicing here never splits a pair
 * and the message after a cut is always a valid `user`-first message.
 */
function isUserTurn(m: Anthropic.MessageParam): boolean {
  return m.role === "user" && typeof m.content === "string";
}

/**
 * Proactive trim (estimate-based, fires near the hard threshold): middle-
 * truncate the conversation to get back under `budget.soft`, so the next
 * request — or the compaction request itself — fits.
 *
 * Keeps the FIRST turn (the original task) and the most recent turns, dropping
 * whole turns from the middle (the stale, least-useful part). Cuts only at
 * user-turn boundaries, so tool_use/tool_result pairs stay intact and the
 * result is still a valid user-first conversation.
 */
export function trimMiddle(
  messages: Anthropic.MessageParam[],
  budget: Budget,
): Anthropic.MessageParam[] {
  const boundaries: number[] = [];
  messages.forEach((m, i) => {
    if (isUserTurn(m)) boundaries.push(i);
  });
  // Need at least head + one middle + tail before there's anything to drop.
  if (boundaries.length <= 2) return messages;

  const head = messages.slice(boundaries[0], boundaries[1]); // the first turn

  // Drop the oldest middle turns first: head + an increasingly short tail.
  for (let t = 2; t < boundaries.length; t++) {
    const candidate = [...head, ...messages.slice(boundaries[t]!)];
    if (estimateTokens(candidate) < budget.soft) return candidate;
  }

  // Even head + the last turn alone is over soft — return that (best effort).
  return [...head, ...messages.slice(boundaries[boundaries.length - 1]!)];
}
