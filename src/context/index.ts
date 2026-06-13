import type Anthropic from "@anthropic-ai/sdk";
import type { Model } from "../model/call.js";
import { estimateTokens, pressure, type Budget } from "./budget.js";
import { trim } from "./fallback/trim.js";
import { compact } from "./fallback/compact.js";

// The single entry point for the context layer — the agent imports only from here.
export { budgetFor, type Budget } from "./budget.js";
export { truncateMiddle, MAX_TOOL_OUTPUT_CHARS } from "./truncate.js";
export { callWithEviction } from "./fallback/evict.js";

/**
 * Proactive context management, run before each model call:
 *   - hard  → trim (middle-truncate) back under soft (mechanical, emergency),
 *   - soft  → compact (summarize older turns into a handoff; graceful),
 *   - ok    → leave as-is.
 *
 * Returns the (possibly reduced) message list. The *reactive* path — recovering
 * from a ground-truth API overflow — is `callWithEviction`.
 */
export async function manageContext(
  messages: Anthropic.MessageParam[],
  model: Model,
  budget: Budget,
): Promise<Anthropic.MessageParam[]> {
  switch (pressure(estimateTokens(messages), budget)) {
    case "hard":
      return trim(messages, budget);
    case "soft":
      return await compact(messages, model);
    default:
      return messages;
  }
}
