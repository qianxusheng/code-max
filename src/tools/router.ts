import type { ToolCall, ToolOutput, ToolContext } from "./types.js";
import type { ToolRegistry } from "./registry.js";
import { RespondToModel } from "./errors.js";

/**
 * A raw function call as it comes off the model's wire format. This is the ONE
 * place that knows about provider shapes; once normalized into a {@link ToolCall}
 * nothing downstream cares where it came from. Swap models → change only this.
 */
export interface RawFunctionCall {
  id: string;
  name: string;
  /** Arguments as a JSON string, exactly as the model emitted them. */
  arguments: string;
}

/**
 * Normalize a raw provider call into the neutral {@link ToolCall} the registry
 * and tools understand.
 *
 * We do not parse the arguments here on purpose — the payload carries the raw
 * JSON string, and each tool parses (and schema-validates) its own arguments.
 * What we DO guarantee is that the structural fields exist.
 */
export function buildToolCall(raw: RawFunctionCall): ToolCall {
  if (!raw.name) {
    throw new RespondToModel("Tool call is missing a tool name.");
  }
  return {
    id: raw.id,
    name: raw.name,
    payload: { kind: "function", arguments: raw.arguments ?? "" },
  };
}

/**
 * The "Act" entry point: normalize a raw call, then hand it to the registry.
 *
 * The router stays deliberately thin — normalization + delegation. All recovery
 * logic lives in the registry's dispatch.
 */
export async function route(
  registry: ToolRegistry,
  raw: RawFunctionCall,
  ctx: ToolContext,
): Promise<ToolOutput> {
  const call = buildToolCall(raw);
  return registry.dispatch(call, ctx);
}

/**
 * Helper for tools: parse a function payload's raw JSON arguments into an
 * object, raising a recoverable error (so the model can fix it) on bad JSON.
 */
export function parseArguments(call: ToolCall): Record<string, unknown> {
  const raw = call.payload.arguments.trim();
  if (raw === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RespondToModel(
      `Arguments for "${call.name}" are not valid JSON: ${raw}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RespondToModel(
      `Arguments for "${call.name}" must be a JSON object.`,
    );
  }
  return parsed as Record<string, unknown>;
}
