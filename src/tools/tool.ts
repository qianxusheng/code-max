import type { ToolSpec, ToolCall, ToolOutput, ToolContext } from "./types.js";

/**
 * The seam everything plugs into.
 *
 * A tool owns BOTH its spec (what the model sees) and its handler (what runs).
 * Keeping them on one object means a tool's schema can never drift apart from
 * the code that executes it — you cannot register a handler without also
 * declaring the contract the model is shown.
 *
 * Adding a new capability to the agent = implement this interface + register
 * it. The registry, router, and run loop never change. This is the system's
 * one extension point.
 */
export interface Tool {
  /** What the model is shown for this tool. Stable for the tool's lifetime. */
  readonly spec: ToolSpec;

  /**
   * Execute a normalized call.
   *
   * Throw {@link RespondToModel} for recoverable failures (the message goes
   * back to the model). Throw {@link FatalToolError} (or let other errors
   * propagate) to abort the turn.
   */
  handle(call: ToolCall, ctx: ToolContext): Promise<ToolOutput>;
}
