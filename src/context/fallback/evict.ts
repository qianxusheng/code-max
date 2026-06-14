import type Anthropic from "@anthropic-ai/sdk";
import type { CallParams, LlmCall } from "../../model/call.js";

/**
 * A real user turn (typed text), not a tool_result-carrying user message — the
 * only safe cut points (every tool_use between two of them has its result).
 */
function isUserTurn(m: Anthropic.MessageParam): boolean {
  return m.role === "user" && typeof m.content === "string";
}

/**
 * Drop exactly one oldest turn, cutting at a user-turn boundary so pairs stay
 * intact and the result is still user-first. Returns null when only one turn is
 * left — nothing safe remains to shed.
 */
export function evictOldest(
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] | null {
  const boundaries: number[] = [];
  messages.forEach((m, i) => {
    if (isUserTurn(m)) boundaries.push(i);
  });
  if (boundaries.length <= 1) return null; // can't drop the only/last turn
  return messages.slice(boundaries[1]!);
}

/** Does this error look like the API rejecting the request for being too long? */
export function isOverflowError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  const msg = (e?.message ?? "").toLowerCase();
  const tokenish =
    msg.includes("too long") ||
    msg.includes("context length") ||
    msg.includes("context window") ||
    (msg.includes("token") && (msg.includes("max") || msg.includes("exceed")));
  return e?.status === 400 && tokenish;
}

/**
 * API fallback (ground-truth overflow): call the model, and if the API rejects
 * the request for context overflow, shed the oldest turn and retry — repeating
 * until it fits or nothing more can be dropped. Mutates `params.messages` in
 * place so the caller's conversation reflects the eviction.
 */
export async function callWithEviction(
  call: LlmCall,
  params: CallParams,
): Promise<Anthropic.Message> {
  while (true) {
    try {
      return await call(params);
    } catch (err) {
      if (!isOverflowError(err)) throw err;
      const evicted = evictOldest(params.messages);
      if (!evicted) throw err; // can't shrink any further — surface the error
      params.messages.splice(0, params.messages.length, ...evicted);
    }
  }
}
