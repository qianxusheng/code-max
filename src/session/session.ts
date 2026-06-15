import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { createPolicy, type Mode } from "../policy/permissions.js";
import type { LlmCall } from "../model/call.js";
import { ContextManager, budgetFor } from "../context/index.js";

/** Descriptive handle for finding/listing the session (→ the cross-session index). */
export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  cwd: string;
}


export interface SessionParams {
  model: string;
  mode: Mode;
}

/**
 * The container for one conversation: its `meta` (find it), its `state` (run
 * it), and its `history` (the ContextManager — the conversation itself).
 */
export class Session {
  readonly meta: SessionMeta;
  readonly mode: Mode;
  lastUsage?: Anthropic.Message["usage"];
  /** Per-session permission policy (mode baseline + its "remembered" allowlist). */
  readonly policy: ReturnType<typeof createPolicy>;
  private readonly history: ContextManager;

  constructor({ model, mode }: SessionParams) {
    const now = new Date().toISOString();
    this.meta = {
      id: `sesn_${randomUUID()}`,
      title: "",
      createdAt: now,
      updatedAt: now,
      cwd: process.cwd(),
    };
    this.mode = mode;
    this.policy = createPolicy(mode);
    this.history = new ContextManager(budgetFor(model));
  }

  /**
   * Append a turn — the single append door at the session level. Stamps
   * `updatedAt`, derives `title` from the first user message, then delegates to
   * the ContextManager. (Persistence will hook in right here later.)
   */
  record(item: Anthropic.MessageParam): void {
    if (!this.meta.title && item.role === "user" && typeof item.content === "string") {
      this.meta.title = item.content.slice(0, 60);
    }
    this.meta.updatedAt = new Date().toISOString();
    this.history.record(item);
  }

  /** The messages to send the model this turn. */
  forPrompt(): Anthropic.MessageParam[] {
    return this.history.forPrompt();
  }

  /** Shrink the history to fit the budget before a model call. */
  async manage(call: LlmCall): Promise<void> {
    await this.history.manage(call);
  }
}
