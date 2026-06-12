import type Anthropic from "@anthropic-ai/sdk";

/**
 * Context budget: how big the conversation is allowed to get for a given model.
 *
 *   raw   — the model's hard context ceiling (the API's absolute limit).
 *   soft  — raw * 0.90: where we start compacting proactively.
 *   hard  — raw * 0.95: the emergency line we never want to cross; truncate.
 *
 * The thresholds leave headroom below `raw` for the system prompt, tool specs,
 * and the next response's output tokens.
 */

// Per-model context ceilings. Verify each against the model's docs; fall back
// to a conservative default for anything not listed.
const RAW_WINDOWS: Record<string, number> = {
  "deepseek-v4-pro": 1_000_000,
};
const DEFAULT_RAW_WINDOW = 64_000;

export interface Budget {
  /** The model's hard context ceiling. */
  raw: number;
  /** Proactive-compaction threshold (raw * 0.90). */
  soft: number;
  /** Emergency-truncation threshold (raw * 0.95). */
  hard: number;
}

/** Build the budget thresholds for a model. */
export function budgetFor(model: string): Budget {
  const raw = RAW_WINDOWS[model] ?? DEFAULT_RAW_WINDOW;
  return {
    raw,
    soft: Math.floor(raw * 0.9),
    hard: Math.floor(raw * 0.95),
  };
}

/**
 * Rough token estimate for a message list (≈ chars / 4). Cheap and
 * provider-agnostic — used to decide *when* to compact or truncate before a
 * request. The exact size is available from `response.usage.input_tokens`
 * after each call; this is the pre-send approximation.
 */
export function estimateTokens(messages: Anthropic.MessageParam[]): number {
  let chars = 0;
  for (const m of messages) {
    chars +=
      typeof m.content === "string"
        ? m.content.length
        : JSON.stringify(m.content).length;
  }
  return Math.ceil(chars / 4);
}

/** How much context pressure we're under, relative to a budget. */
export type Pressure = "ok" | "soft" | "hard";

export function pressure(tokens: number, b: Budget): Pressure {
  if (tokens >= b.hard) return "hard";
  if (tokens >= b.soft) return "soft";
  return "ok";
}
