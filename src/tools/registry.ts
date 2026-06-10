import type Anthropic from "@anthropic-ai/sdk";
import type { Kind } from "../policy/permissions.js";

/** A tool: the spec the model sees + the handler that runs. Kept on one object
 *  so the schema can never drift from the code that executes it. */
export interface Tool {
  spec: Anthropic.Tool;
  /** Risk class, used by the permission policy: read / edit / exec. */
  kind: Kind;
  run(input: unknown): Promise<string>;
}

const registry = new Map<string, Tool>();

/** Register a tool under its spec name. Duplicate names are a bug, so throw. */
export function register(tool: Tool): void {
  if (registry.has(tool.spec.name)) {
    throw new Error(`Tool already registered: ${tool.spec.name}`);
  }
  registry.set(tool.spec.name, tool);
}

/** Look up a tool by the name the model used. */
export function get(name: string): Tool | undefined {
  return registry.get(name);
}

/** Every registered spec, to hand to the API. */
export function specs(): Anthropic.Tool[] {
  return [...registry.values()].map((t) => t.spec);
}
