/**
 * The core contracts of the tool system.
 *
 * These types are provider-agnostic on purpose: the model's wire format is
 * normalized into a {@link ToolCall} exactly once, at the router boundary, so
 * that tools and the registry never touch a specific model's call shape.
 */

/**
 * A JSON Schema object describing a tool's parameters. This is the part of a
 * tool that the model sees. We keep it loosely typed for now — any object that
 * serializes to valid JSON Schema is acceptable.
 */
export type JSONSchema = Record<string, unknown>;

/**
 * What the model is shown for a single tool: its name, a human/model-readable
 * description, and the JSON Schema for its arguments.
 *
 * A tool owns its own spec (see {@link Tool}), so the schema the model sees can
 * never drift from the handler that executes the call.
 */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
}

/**
 * The shape of an invocation as it arrives from the model.
 *
 * Codex distinguishes `Function { args }` from `Custom { input }`. We start
 * with just the function shape (a JSON-string of arguments, as models emit it)
 * and leave room to add `custom` later as another variant of this union.
 */
export type ToolPayload = {
  kind: "function";
  /** Raw JSON string of arguments, exactly as the model produced it. */
  arguments: string;
};

/**
 * A normalized, provider-agnostic tool invocation.
 *
 * `id` is the call id the model assigned; it must be echoed back alongside the
 * result so the model can correlate the output with its request.
 */
export interface ToolCall {
  id: string;
  name: string;
  payload: ToolPayload;
}

/**
 * The result of executing a tool, handed back to the model.
 *
 * Kept minimal for now (text content). Richer outputs — images, structured
 * data — become additional optional fields later without changing the seam.
 */
export interface ToolOutput {
  content: string;
}

/**
 * Ambient services a tool may need at execution time (cwd, logger, sandbox,
 * etc.). Empty for now; grows as tools require it, without touching the
 * {@link Tool} interface signature shape.
 */
export interface ToolContext {
  /** Reserved for future ambient services. */
  readonly _?: never;
}
