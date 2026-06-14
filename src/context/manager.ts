import type Anthropic from "@anthropic-ai/sdk";
import type { LlmCall } from "../model/call.js";
import { estimateTokens, pressure, type Budget } from "./budget.js";
import { trim } from "./fallback/trim.js";
import { compact } from "./fallback/compact.js";

/**
 * Owns the conversation history and the operations on it. The agent records
 * turns and reads `forPrompt()` — it never touches the underlying array, so
 * persistence, compaction, and token accounting all live behind this one seam.
 */
export class ContextManager {
  private items: Anthropic.MessageParam[] = [];

  constructor(private readonly budget: Budget) {}

  /** Append a message — the single point everything enters the history through. */
  record(item: Anthropic.MessageParam): void {
    this.items.push(item);
  }

  /** The messages to send the model this turn. */
  forPrompt(): Anthropic.MessageParam[] {
    return this.items;
  }

  /** Rough token estimate of the current history. */
  tokens(): number {
    return estimateTokens(this.items);
  }

  /**
   * Proactively shrink the history to fit the budget before a model call:
   *   - hard → trim (middle-truncate back under soft, mechanical),
   *   - soft → compact (summarize older turns, graceful),
   *   - ok   → leave as-is.
   */
  async manage(call: LlmCall): Promise<void> {
    switch (pressure(this.tokens(), this.budget)) {
      case "hard":
        this.replace(trim(this.items, this.budget));
        break;
      case "soft":
        this.replace(await compact(this.items, call));
        break;
    }
  }

  /** Swap the working history in place, keeping the array identity stable. */
  private replace(items: Anthropic.MessageParam[]): void {
    if (items !== this.items) this.items.splice(0, this.items.length, ...items);
  }
}
