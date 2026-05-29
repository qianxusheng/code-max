import type { Tool } from "../tool.js";
import type { ToolCall, ToolContext, ToolOutput } from "../types.js";
import { RespondToModel } from "../errors.js";
import { parseArguments } from "../router.js";

/**
 * The simplest possible tool, implemented end-to-end, to demonstrate the
 * interface for real:
 *   - it owns its spec (name + description + JSON Schema), and
 *   - it parses its arguments and raises a recoverable error on bad input.
 *
 * Real tools (shell, read-file, apply-patch) follow exactly this shape.
 */
export const echoTool: Tool = {
  spec: {
    name: "echo",
    description: "Echo a message back. Useful as a connectivity/sanity check.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The text to echo back.",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },

  async handle(call: ToolCall, _ctx: ToolContext): Promise<ToolOutput> {
    const args = parseArguments(call);
    const message = args["message"];
    if (typeof message !== "string") {
      throw new RespondToModel('"message" is required and must be a string.');
    }
    return { content: message };
  },
};
