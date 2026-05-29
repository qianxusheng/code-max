import type { Tool } from "./tool.js";
import type { ToolSpec, ToolCall, ToolOutput, ToolContext } from "./types.js";
import { RespondToModel } from "./errors.js";

/**
 * The registry: the single source of truth for "what tools exist".
 *
 * Three jobs:
 *   1. register(tool)   — add a tool by name.
 *   2. buildSpecs()     — produce the list of specs shown to the model.
 *   3. dispatch(call)   — look up a call's target and execute it, converting
 *                         recoverable failures into tool results.
 *
 * Everything the model can do flows through here, and adding a tool never
 * requires touching dispatch — that's the point.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /**
   * Register a tool under its spec name. Throws on a duplicate name — a
   * collision is a programming error, not something to silently overwrite.
   */
  register(tool: Tool): void {
    const { name } = tool.spec;
    if (this.tools.has(name)) {
      throw new Error(`Tool already registered: "${name}"`);
    }
    this.tools.set(name, tool);
  }

  /** Convenience for registering several tools at once. */
  registerAll(tools: Iterable<Tool>): void {
    for (const tool of tools) this.register(tool);
  }

  /** The model-visible spec list, in registration order. */
  buildSpecs(): ToolSpec[] {
    return [...this.tools.values()].map((t) => t.spec);
  }

  /** Whether a tool with this name is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a normalized call.
   *
   * An unknown tool name is itself a recoverable failure: we report it back to
   * the model rather than crashing, since the model picked the name.
   *
   * {@link RespondToModel} thrown by a handler is caught and converted into a
   * normal {@link ToolOutput} (prefixed as an error) so the model can retry.
   * Any other error — including {@link FatalToolError} — propagates to abort
   * the turn.
   */
  async dispatch(call: ToolCall, ctx: ToolContext): Promise<ToolOutput> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      const known = [...this.tools.keys()].join(", ") || "(none)";
      return {
        content: `Error: unknown tool "${call.name}". Available tools: ${known}.`,
      };
    }

    try {
      return await tool.handle(call, ctx);
    } catch (err) {
      if (err instanceof RespondToModel) {
        return { content: `Error: ${err.message}` };
      }
      throw err;
    }
  }
}
